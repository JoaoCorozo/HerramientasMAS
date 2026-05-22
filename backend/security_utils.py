import base64
import hashlib
import html
import re
from pathlib import Path

from fastapi import HTTPException, UploadFile, status

from config import APP_ENCRYPTION_KEY, MAX_UPLOAD_BYTES, VALID_MODULES

_FILENAME_UNSAFE = re.compile(r"[^a-zA-Z0-9._-]+")


def safe_upload_filename(original: str | None) -> str:
    name = Path(original or "upload.xlsx").name
    if name in (".", "..") or ".." in name:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Nombre de archivo no válido.",
        )
    stem, dot, ext = name.rpartition(".")
    if not dot:
        stem, ext = name, "xlsx"
    ext = ext.lower()
    if ext not in ("xlsx", "xls"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Solo se permiten archivos Excel (.xlsx, .xls).",
        )
    safe_stem = _FILENAME_UNSAFE.sub("_", stem)[:80] or "upload"
    return f"{safe_stem}.{ext}"


async def read_upload_limited(file: UploadFile) -> bytes:
    chunks: list[bytes] = []
    total = 0
    while True:
        chunk = await file.read(1024 * 1024)
        if not chunk:
            break
        total += len(chunk)
        if total > MAX_UPLOAD_BYTES:
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail=f"El archivo supera el límite de {MAX_UPLOAD_BYTES // (1024 * 1024)} MB.",
            )
        chunks.append(chunk)
    return b"".join(chunks)


def escape_html(value) -> str:
    return html.escape(str(value) if value is not None else "", quote=True)


def _fernet():
    try:
        from cryptography.fernet import Fernet
    except ImportError:
        return None
    if not APP_ENCRYPTION_KEY:
        return None
    derived = base64.urlsafe_b64encode(
        hashlib.sha256(APP_ENCRYPTION_KEY.encode("utf-8")).digest()
    )
    return Fernet(derived)


def encrypt_value(plain: str) -> str:
    if not plain:
        return plain
    f = _fernet()
    if f is None:
        return plain
    return "enc:" + f.encrypt(plain.encode("utf-8")).decode("ascii")


def decrypt_value(stored: str) -> str:
    if not stored or not isinstance(stored, str):
        return stored or ""
    if not stored.startswith("enc:"):
        return stored
    f = _fernet()
    if f is None:
        return ""
    try:
        return f.decrypt(stored[4:].encode("ascii")).decode("utf-8")
    except Exception:
        return ""


def protect_smtp_config(cfg: dict) -> dict:
    if not isinstance(cfg, dict):
        return cfg
    out = dict(cfg)
    pwd = out.get("password")
    if pwd and not str(pwd).startswith("enc:"):
        out["password"] = encrypt_value(str(pwd))
    return out


def expose_smtp_config(cfg: dict, include_secret: bool = False) -> dict:
    if not isinstance(cfg, dict):
        return cfg
    out = dict(cfg)
    pwd = out.get("password", "")
    if include_secret:
        out["password"] = decrypt_value(str(pwd)) if pwd else ""
    elif pwd:
        out["password"] = ""
        out["password_configured"] = True
    return out


def smtp_config_for_mailer(cfg: dict) -> dict:
    if not isinstance(cfg, dict):
        return cfg
    out = dict(cfg)
    if out.get("password"):
        out["password"] = decrypt_value(str(out["password"]))
    return out


def validate_permissions(permissions: list[str]) -> list[str]:
    invalid = [p for p in permissions if p not in VALID_MODULES]
    if invalid:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Permisos no válidos: {', '.join(invalid)}",
        )
    return permissions


def validate_role(role: str) -> str:
    from config import VALID_ROLES
    if role not in VALID_ROLES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Rol no válido.",
        )
    return role


def generic_error_detail(exc: Exception, context: str = "operación") -> str:
    from config import IS_PRODUCTION
    if IS_PRODUCTION:
        return f"Error en la {context}. Contacte al administrador."
    return f"Error en la {context}: {exc}"
