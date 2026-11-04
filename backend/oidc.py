"""Cliente OIDC (Authentik) — Authorization Code + PKCE-ready state firmado."""
from __future__ import annotations

import hashlib
import logging
import secrets
import time
from typing import Any
from urllib.parse import urlencode

import httpx
import jwt
from jwt import PyJWKClient

import auth
import config

logger = logging.getLogger("uvicorn.error")

_discovery_cache: dict[str, tuple[float, dict]] = {}
_DISCOVERY_TTL = 3600


def username_from_email(email: str) -> str:
    email = (email or "").strip().lower()
    if len(email) <= 50:
        return email
    digest = hashlib.sha1(email.encode("utf-8")).hexdigest()[:8]
    local = email.split("@")[0][:40]
    return f"{local}_{digest}"[:50]


def create_oidc_state(tenant: str) -> str:
    payload = {
        "tenant": tenant,
        "nonce": secrets.token_urlsafe(16),
        "exp": int(time.time()) + 600,
        "typ": "oidc_state",
    }
    return jwt.encode(payload, config.JWT_SECRET_KEY, algorithm=auth.ALGORITHM)


def parse_oidc_state(state: str) -> dict[str, Any]:
    try:
        payload = jwt.decode(state, config.JWT_SECRET_KEY, algorithms=[auth.ALGORITHM])
    except jwt.PyJWTError as exc:
        raise ValueError("state OIDC inválido o expirado") from exc
    if payload.get("typ") != "oidc_state" or not payload.get("tenant"):
        raise ValueError("state OIDC inválido")
    return payload


async def fetch_discovery(issuer: str) -> dict:
    now = time.time()
    cached = _discovery_cache.get(issuer)
    if cached and cached[0] > now:
        return cached[1]
    base = issuer.rstrip("/")
    url = f"{base}/.well-known/openid-configuration"
    async with httpx.AsyncClient(timeout=20.0, follow_redirects=True) as client:
        resp = await client.get(url)
        resp.raise_for_status()
        data = resp.json()
    _discovery_cache[issuer] = (now + _DISCOVERY_TTL, data)
    return data


async def build_authorize_url(tenant: str) -> tuple[str, str]:
    cfg = config.oidc_tenant_config(tenant)
    if not cfg:
        raise ValueError(f"Tenant OIDC no configurado: {tenant}")
    discovery = await fetch_discovery(cfg["issuer"])
    authorize = discovery.get("authorization_endpoint")
    if not authorize:
        raise ValueError("Authentik no publicó authorization_endpoint")
    state = create_oidc_state(tenant)
    params = {
        "response_type": "code",
        "client_id": cfg["client_id"],
        "redirect_uri": cfg["redirect_uri"],
        "scope": cfg["scopes"],
        "state": state,
    }
    return f"{authorize}?{urlencode(params)}", state


async def exchange_code(tenant: str, code: str) -> dict[str, Any]:
    cfg = config.oidc_tenant_config(tenant)
    if not cfg:
        raise ValueError(f"Tenant OIDC no configurado: {tenant}")
    discovery = await fetch_discovery(cfg["issuer"])
    token_url = discovery.get("token_endpoint")
    if not token_url:
        raise ValueError("Authentik no publicó token_endpoint")
    data = {
        "grant_type": "authorization_code",
        "code": code,
        "redirect_uri": cfg["redirect_uri"],
        "client_id": cfg["client_id"],
        "client_secret": cfg["client_secret"],
    }
    async with httpx.AsyncClient(timeout=20.0) as client:
        resp = await client.post(token_url, data=data)
        if resp.status_code >= 400:
            logger.warning("OIDC token error %s: %s", resp.status_code, resp.text[:500])
            resp.raise_for_status()
        tokens = resp.json()

    id_token = tokens.get("id_token")
    if not id_token:
        raise ValueError("Respuesta OIDC sin id_token")

    jwks_uri = discovery.get("jwks_uri")
    if not jwks_uri:
        raise ValueError("Authentik no publicó jwks_uri")

    jwks_client = PyJWKClient(jwks_uri, cache_keys=True)
    signing_key = jwks_client.get_signing_key_from_jwt(id_token)
    # Authentik a veces publica iss con o sin barra final: aceptar ambas
    issuer = cfg["issuer"]
    issuer_candidates = {issuer, issuer.rstrip("/"), issuer.rstrip("/") + "/"}
    claims = None
    last_err: Exception | None = None
    for iss in issuer_candidates:
        try:
            claims = jwt.decode(
                id_token,
                signing_key.key,
                algorithms=["RS256", "ES256"],
                audience=cfg["client_id"],
                issuer=iss,
                options={"verify_at_hash": False},
            )
            break
        except jwt.PyJWTError as exc:
            last_err = exc
    if claims is None:
        raise ValueError(f"id_token inválido: {last_err}") from last_err
    return {"claims": claims, "tokens": tokens, "config": cfg}


def email_allowed(email: str, allowed_domains: list[str]) -> bool:
    if not allowed_domains:
        return True
    email = (email or "").strip().lower()
    if "@" not in email:
        return False
    domain = email.split("@", 1)[1]
    return domain in allowed_domains
