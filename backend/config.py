import os
from pathlib import Path
from urllib.parse import quote_plus

try:
    from dotenv import load_dotenv

    load_dotenv(Path(__file__).parent / ".env")
    load_dotenv(Path(__file__).parent.parent / ".env")
except ImportError:
    pass

APP_ENV = os.getenv("APP_ENV", "development")
IS_PRODUCTION = APP_ENV == "production"


def _build_database_url() -> str:
    explicit = os.getenv("DATABASE_URL")
    if explicit:
        return explicit
    mysql_host = os.getenv("MYSQL_HOST")
    if mysql_host:
        user = quote_plus(os.getenv("MYSQL_USER", "herramientas"))
        password = quote_plus(os.getenv("MYSQL_PASSWORD", ""))
        database = os.getenv("MYSQL_DATABASE", "herramientas")
        port = os.getenv("MYSQL_PORT", "3306")
        return (
            f"mysql+pymysql://{user}:{password}@{mysql_host}:{port}/{database}"
            f"?charset=utf8mb4"
        )
    return "sqlite:///./users.db"


SQLALCHEMY_DATABASE_URL = _build_database_url()

JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY")
if not JWT_SECRET_KEY:
    if IS_PRODUCTION:
        raise RuntimeError("JWT_SECRET_KEY es obligatoria en producción (APP_ENV=production).")
    JWT_SECRET_KEY = "dev-only-change-before-deploy"

BOOTSTRAP_ADMIN_PASSWORD = os.getenv("BOOTSTRAP_ADMIN_PASSWORD", "")
ADMIN_MASTER_USER = os.getenv("ADMIN_MASTER_USER", "admin")

_cors_raw = os.getenv(
    "CORS_ORIGINS",
    "http://localhost:3000,http://127.0.0.1:3000",
)
CORS_ORIGINS = [o.strip() for o in _cors_raw.split(",") if o.strip()]

PUBLIC_FRONTEND_URL = os.getenv("PUBLIC_FRONTEND_URL", "").rstrip("/")
if PUBLIC_FRONTEND_URL and PUBLIC_FRONTEND_URL not in CORS_ORIGINS:
    CORS_ORIGINS.append(PUBLIC_FRONTEND_URL)

MAX_UPLOAD_BYTES = int(os.getenv("MAX_UPLOAD_BYTES", str(20 * 1024 * 1024)))
MAX_VIDEO_UPLOAD_BYTES = int(os.getenv("MAX_VIDEO_UPLOAD_BYTES", str(500 * 1024 * 1024)))
MAX_VIDEO_BATCH_BYTES = int(os.getenv("MAX_VIDEO_BATCH_BYTES", str(2 * 1024 * 1024 * 1024)))
# Compresor MP4: 0 = sin límite por archivo (solo limitado por disco local)
COMPRESOR_VIDEO_MAX_BYTES = int(os.getenv("COMPRESOR_VIDEO_MAX_BYTES", "0"))

VALID_ROLES = frozenset({"user", "superadmin"})
VALID_MODULES = frozenset({
    "comparador", "rut", "textos", "capacitaciones",
    "enlaces", "recordatorios", "generador", "consulta_cursos",
    "compresor_video", "evaluaciones_moodle",
    "analisis_resultados",
})
VALID_DB_MODULES = frozenset({
    "capacitaciones", "enlaces", "recordatorios", "smtp_config",
})

LOGIN_MAX_ATTEMPTS = int(os.getenv("LOGIN_MAX_ATTEMPTS", "10"))
LOGIN_WINDOW_SECONDS = int(os.getenv("LOGIN_WINDOW_SECONDS", "300"))

COOKIE_NAME = "access_token"
COOKIE_MAX_AGE = 60 * 60 * 24

# True si el frontend llama al API por otro dominio (sin proxy Next.js)
CROSS_SITE_AUTH = os.getenv("CROSS_SITE_AUTH", "").lower() in ("1", "true", "yes")
COOKIE_SAMESITE = "none" if (IS_PRODUCTION and CROSS_SITE_AUTH) else "lax"
# Cookie Secure: con HTTPS o CROSS_SITE debe ser true.
# Si PUBLIC_FRONTEND_URL es http:// (IP:puerto sin TLS), Secure=false aunque APP_ENV=production;
# si no, el navegador ignora la cookie y el login falla con "Error obteniendo usuario".
_public_https = PUBLIC_FRONTEND_URL.startswith("https://")
_public_http = PUBLIC_FRONTEND_URL.startswith("http://")
_cookie_secure_env = os.getenv("COOKIE_SECURE", "").strip().lower()
if _cookie_secure_env in ("0", "false", "no"):
    COOKIE_SECURE = False
elif _cookie_secure_env in ("1", "true", "yes"):
    COOKIE_SECURE = True
elif CROSS_SITE_AUTH or _public_https:
    COOKIE_SECURE = True
elif _public_http:
    COOKIE_SECURE = False
else:
    COOKIE_SECURE = IS_PRODUCTION

APP_ENCRYPTION_KEY = os.getenv("APP_ENCRYPTION_KEY") or JWT_SECRET_KEY

# --- OIDC / Authentik (Google como IdP detrás de Authentik) ---
# Cliente único (herramientas-lms) o por tenant: OIDC_{KEY}_ISSUER / CLIENT_ID / SECRET.
# Redirect debe coincidir EXACTO con Authentik (hoy: .../auth/callback).
OIDC_TENANTS = [
    t.strip().lower()
    for t in os.getenv("OIDC_TENANTS", "lms").split(",")
    if t.strip()
]
# No hacer rstrip del path: Authentik registra /auth/callback exacto
OIDC_REDIRECT_URI = (os.getenv("OIDC_REDIRECT_URI") or "").strip()
OIDC_SCOPES = os.getenv("OIDC_SCOPES", "openid email profile")
OIDC_AUTO_CREATE_USERS = os.getenv("OIDC_AUTO_CREATE_USERS", "true").lower() in (
    "1",
    "true",
    "yes",
)
OIDC_DEFAULT_PERMISSIONS = [
    p.strip()
    for p in os.getenv("OIDC_DEFAULT_PERMISSIONS", "").split(",")
    if p.strip() and p.strip() in VALID_MODULES
]
OIDC_LOCAL_LOGIN_ENABLED = os.getenv("OIDC_LOCAL_LOGIN_ENABLED", "true").lower() in (
    "1",
    "true",
    "yes",
)
OIDC_TENANT_LABELS = {
    "lms": os.getenv("OIDC_LMS_LABEL", "Google"),
    "mas": os.getenv("OIDC_MAS_LABEL", "MAS"),
    "roi": os.getenv("OIDC_ROI_LABEL", "ROI"),
}


def oidc_tenant_config(tenant: str) -> dict | None:
    """Devuelve issuer/client_id/secret/domains para un tenant, o None si incompleto."""
    key = (tenant or "").strip().lower()
    if not key:
        return None
    prefix = f"OIDC_{key.upper()}_"
    # Issuer: conservar barra final si Authentik la publica (el claim iss es exacto)
    issuer = (os.getenv(f"{prefix}ISSUER") or os.getenv("OIDC_ISSUER") or "").strip()
    client_id = (os.getenv(f"{prefix}CLIENT_ID") or os.getenv("OIDC_CLIENT_ID") or "").strip()
    client_secret = (
        os.getenv(f"{prefix}CLIENT_SECRET") or os.getenv("OIDC_CLIENT_SECRET") or ""
    ).strip()
    domains_raw = os.getenv(f"{prefix}ALLOWED_DOMAINS") or os.getenv("OIDC_ALLOWED_DOMAINS") or ""
    allowed_domains = [d.strip().lower().lstrip("@") for d in domains_raw.split(",") if d.strip()]
    if not (issuer and client_id and client_secret and OIDC_REDIRECT_URI):
        return None
    return {
        "id": key,
        "label": OIDC_TENANT_LABELS.get(key, key.upper()),
        "issuer": issuer,
        "client_id": client_id,
        "client_secret": client_secret,
        "allowed_domains": allowed_domains,
        "redirect_uri": OIDC_REDIRECT_URI,
        "scopes": OIDC_SCOPES,
    }


def oidc_configured_tenants() -> list[dict]:
    """Lista botones SSO. Si todos comparten el mismo client_id, un solo botón."""
    seen_clients: set[str] = set()
    out: list[dict] = []
    for t in OIDC_TENANTS:
        cfg = oidc_tenant_config(t)
        if not cfg:
            continue
        if cfg["client_id"] in seen_clients:
            continue
        seen_clients.add(cfg["client_id"])
        out.append({"id": cfg["id"], "label": cfg["label"]})
    return out


OIDC_ENABLED = bool(oidc_configured_tenants())
