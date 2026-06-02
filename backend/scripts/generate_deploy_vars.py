"""
Genera deploy-vars.local.txt en la raíz del proyecto para copiar variables a Render/Vercel.
Lee backend/.env (POSTGRES_DATABASE_URL). No imprime secretos en consola.
"""
import secrets
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
BACKEND = ROOT / "backend"
ENV_FILE = BACKEND / ".env"
OUT_FILE = ROOT / "deploy-vars.local.txt"


def load_env_file(path: Path) -> dict[str, str]:
    data: dict[str, str] = {}
    if not path.is_file():
        return data
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        data[key.strip()] = value.strip().strip('"').strip("'")
    return data


def main() -> int:
    env = load_env_file(ENV_FILE)
    postgres = env.get("POSTGRES_DATABASE_URL", "")

    if not postgres:
        print("[Paso 1] Falta POSTGRES_DATABASE_URL en backend/.env")
        print("  1. Copia backend/.env.example -> backend/.env")
        print("  2. Pega la connection string de Neon")
        print("  3. Vuelve a ejecutar: py scripts/generate_deploy_vars.py")
        return 1

    jwt_key = env.get("JWT_SECRET_KEY") or secrets.token_urlsafe(48)
    enc_key = env.get("APP_ENCRYPTION_KEY") or secrets.token_urlsafe(48)

    render_url = env.get("RENDER_API_URL", "https://TU-API.onrender.com")
    vercel_url = env.get("VERCEL_APP_URL", "https://TU-APP.vercel.app")
    cors = env.get("CORS_ORIGINS", vercel_url)

    content = f"""# Generado automáticamente — NO subir a git
# Copia cada bloque al panel correspondiente (Render / Vercel)

========== RENDER (Web Service > Environment) ==========
APP_ENV=production
DATABASE_URL={postgres}
JWT_SECRET_KEY={jwt_key}
APP_ENCRYPTION_KEY={enc_key}
MATRIZ_CURSOS_PATH=/app/cursos bex Moodle.xlsx
CORS_ORIGINS={cors}
PUBLIC_FRONTEND_URL={vercel_url}
CROSS_SITE_AUTH=false
# NO usar BOOTSTRAP_ADMIN_PASSWORD en producción

========== VERCEL (Project > Settings > Environment Variables) ==========
# Root Directory del proyecto: frontend
BACKEND_URL={render_url}
NEXT_PUBLIC_API_URL=

========== DESPUÉS DEL PRIMER DEPLOY ==========
# Actualiza en backend/.env y vuelve a generar este archivo:
# RENDER_API_URL=https://xxxx.onrender.com
# VERCEL_APP_URL=https://xxxx.vercel.app
# Luego actualiza CORS_ORIGINS y PUBLIC_FRONTEND_URL en Render con la URL real de Vercel

========== SYNC LOCAL -> NUBE (en tu PC) ==========
POSTGRES_DATABASE_URL=<ya está en backend/.env>

========== COMPROBACIÓN ==========
Health: {{RENDER_API_URL}}/api/health
Login: {{VERCEL_APP_URL}}
"""
    OUT_FILE.write_text(content, encoding="utf-8")
    print(f"[OK] Creado: {OUT_FILE}")
    print("Abre ese archivo y copia las variables a Render y Vercel.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
