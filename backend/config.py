import os
from pathlib import Path

try:
    from dotenv import load_dotenv

    load_dotenv(Path(__file__).parent / ".env")
    load_dotenv(Path(__file__).parent.parent / ".env")
except ImportError:
    pass

APP_ENV = os.getenv("APP_ENV", "development")
IS_PRODUCTION = APP_ENV == "production"

SQLALCHEMY_DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./users.db")

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

VALID_ROLES = frozenset({"user", "superadmin"})
VALID_MODULES = frozenset({
    "comparador", "rut", "textos", "capacitaciones",
    "enlaces", "recordatorios", "generador",
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
COOKIE_SECURE = IS_PRODUCTION or CROSS_SITE_AUTH

APP_ENCRYPTION_KEY = os.getenv("APP_ENCRYPTION_KEY", JWT_SECRET_KEY)
