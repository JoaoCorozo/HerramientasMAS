# Despliegue con Docker + MySQL

Stack local/servidor:

| Servicio   | Imagen / build      | Puerto por defecto |
|------------|---------------------|--------------------|
| `frontend` | Next.js standalone  | 3000               |
| `backend`  | FastAPI (uvicorn)   | 8000               |
| `db`       | MySQL 8.4           | 3306               |

El navegador entra por el **frontend** (`http://servidor:3000`). Las rutas `/api/*` se proxifican al backend dentro de la red Docker (`BACKEND_URL=http://backend:8000`).

> **Nota:** el Compresor MP4 corre **dentro del backend** (FFmpeg en la imagen + plantilla ZIP). Los videos de entrada/salida viven en volúmenes Docker (`compresor_input` / `compresor_output`). En la UI usa **Descargar ZIP** para bajar el paquete.

## 1. Requisitos

- Docker Engine + Docker Compose v2
- Archivo `cursos bex Moodle.xlsx` en la raíz del repo (ya va en la imagen del backend)

## 2. Configurar variables

```bash
cp .env.docker.example .env
```

Edita `.env` y define al menos:

- `MYSQL_ROOT_PASSWORD`, `MYSQL_PASSWORD` (sin caracteres `@ : / # ?` si puedes evitarlos)
- `JWT_SECRET_KEY` y `APP_ENCRYPTION_KEY` (p. ej. `openssl rand -hex 32`)
- `PUBLIC_FRONTEND_URL` y `CORS_ORIGINS` con la URL real del servidor (`https://tu-dominio.com`)
- `BOOTSTRAP_ADMIN_PASSWORD` solo para el **primer** arranque

## 3. Levantar

```bash
docker compose up -d --build
```

Comprobar:

```bash
docker compose ps
curl http://localhost:8000/api/health
```

Abrir: `http://localhost:3000` (o tu dominio).

Login inicial: usuario `admin` + la clave de `BOOTSTRAP_ADMIN_PASSWORD`.

Después del primer login: cambia la contraseña del admin y **quita** `BOOTSTRAP_ADMIN_PASSWORD` del `.env`, luego `docker compose up -d` de nuevo.

## 4. MySQL externo (opcional)

Si ya tienes un MySQL en el servidor, comenta o elimina el servicio `db` del compose y define en el backend (vía `.env` / environment):

```env
MYSQL_HOST=tu-mysql-host
MYSQL_PORT=3306
MYSQL_DATABASE=herramientas
MYSQL_USER=herramientas
MYSQL_PASSWORD=tu_password
```

O una sola URL:

```env
DATABASE_URL=mysql+pymysql://usuario:password@host:3306/herramientas?charset=utf8mb4
```

También vale el esquema `mysql://...` (el backend lo convierte a `mysql+pymysql://`).

## 5. HTTPS / proxy inverso

Delante de Docker (Nginx, Caddy, Traefik) apunta el dominio al puerto del **frontend** (3000).

Ejemplo Nginx:

```nginx
location / {
  proxy_pass http://127.0.0.1:3000;
  proxy_http_version 1.1;
  proxy_set_header Host $host;
  proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
  proxy_set_header X-Forwarded-Proto $scheme;
  client_max_body_size 100m;
}
```

Ajusta `PUBLIC_FRONTEND_URL` / `CORS_ORIGINS` a `https://tu-dominio.com`.

## 6. Comandos útiles

```bash
docker compose logs -f backend
docker compose logs -f frontend
docker compose down          # para contenedores (conserva datos MySQL)
docker compose down -v       # ¡borra el volumen mysql_data!
```

## 7. Migración desde SQLite / PostgreSQL

Las tablas se crean solas al arrancar (`create_all`). Para copiar datos existentes usa los scripts `backend/sync_to_cloud.py` / exportación manual, o importa un dump SQL a MySQL.
