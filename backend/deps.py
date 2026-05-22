import time
from collections import defaultdict

from fastapi import Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

import auth
import config
import models
from database import get_db

_login_attempts: dict[str, list[float]] = defaultdict(list)


def get_client_ip(request: Request) -> str:
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    if request.client:
        return request.client.host
    return "unknown"


def check_login_rate_limit(request: Request) -> None:
    ip = get_client_ip(request)
    now = time.time()
    window = config.LOGIN_WINDOW_SECONDS
    attempts = [t for t in _login_attempts[ip] if now - t < window]
    _login_attempts[ip] = attempts
    if len(attempts) >= config.LOGIN_MAX_ATTEMPTS:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Demasiados intentos. Espere unos minutos e intente de nuevo.",
        )
    attempts.append(now)
    _login_attempts[ip] = attempts


def get_token_from_request(request: Request) -> str | None:
    auth_header = request.headers.get("Authorization")
    if auth_header and auth_header.lower().startswith("bearer "):
        return auth_header[7:].strip()
    return request.cookies.get(config.COOKIE_NAME)


async def get_current_user(
    request: Request,
    db: Session = Depends(get_db),
) -> models.User:
    token = get_token_from_request(request)
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="No autenticado",
        )
    payload = auth.decode_access_token(token)
    if payload is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Credenciales inválidas",
        )
    username = payload.get("sub")
    if not username:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Credenciales inválidas",
        )
    user = db.query(models.User).filter(models.User.username == username).first()
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Usuario no encontrado",
        )
    return user


def require_permission(module_name: str):
    def permission_checker(
        current_user: models.User = Depends(get_current_user),
    ) -> models.User:
        if current_user.role == "superadmin":
            return current_user
        import json
        user_permissions = json.loads(current_user.permissions_json or "[]")
        if module_name not in user_permissions:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Sin permisos para este módulo",
            )
        return current_user
    return permission_checker
