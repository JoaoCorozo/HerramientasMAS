# Paso a paso — Configuración Docker (equipo TI)

Repo: https://github.com/MAS-Consultores/herramientas-lms  
App: frontend Next.js + backend FastAPI + MySQL 8.4

---

## Requisitos previos

- Servidor Linux o Windows con **Docker Engine + Docker Compose v2**
- Acceso al repo `MAS-Consultores/herramientas-lms`
- Puertos libres (o reasignables): **3000** (web), **8000** (API), **3306** (MySQL, solo si debe publicarse)
- (Opcional) Proxy inverso Nginx/Caddy con HTTPS

---

## Paso 1 — Clonar el repositorio

```bash
git clone https://github.com/MAS-Consultores/herramientas-lms.git
cd herramientas-lms
```

Comprobar que existan:

- `cursos bex Moodle.xlsx` (raíz)
- `compresor_video/carpeta para el video/`
- `docker-compose.yml`, `Dockerfile`, `frontend/Dockerfile`

---

## Paso 2 — Crear el archivo `.env`

```bash
cp .env.docker.example .env
```

Editar `.env` con valores de **producción** (no reutilizar secretos de un PC de desarrollo):

```env
APP_ENV=production

MYSQL_ROOT_PASSWORD=<contraseña_root_fuerte>
MYSQL_DATABASE=herramientas
MYSQL_USER=herramientas
MYSQL_PASSWORD=<contraseña_mysql_fuerte>
MYSQL_PORT=3306

JWT_SECRET_KEY=<openssl rand -hex 32>
APP_ENCRYPTION_KEY=<openssl rand -hex 32>

BOOTSTRAP_ADMIN_PASSWORD=<clave_temporal_admin>
ADMIN_MASTER_USER=admin

PUBLIC_FRONTEND_URL=https://herramientas.tudominio.cl
CORS_ORIGINS=https://herramientas.tudominio.cl

FRONTEND_PORT=3000
BACKEND_PORT=8000

CROSS_SITE_AUTH=false
```

### Notas para TI

| Variable | Regla |
|----------|--------|
| `PUBLIC_FRONTEND_URL` / `CORS_ORIGINS` | Misma URL pública con la que abrirán el navegador (con `https://` si hay certificado) |
| `MYSQL_*_PASSWORD` | Preferir sin caracteres `@ : / # ?` |
| `JWT_SECRET_KEY` / `APP_ENCRYPTION_KEY` | Aleatorios y distintos entre sí |
| `BOOTSTRAP_ADMIN_PASSWORD` | Solo para crear el primer usuario `admin`; luego se elimina del `.env` |
| `.env` | **No** se sube a GitHub |

Generar secretos (Linux):

```bash
openssl rand -hex 32
```

---

## Paso 3 — Levantar la plataforma

```bash
docker compose up -d --build
```

Esperar a que los contenedores estén healthy:

```bash
docker compose ps
```

Debe verse algo como:

- `db` → healthy  
- `backend` → healthy  
- `frontend` → running  

---

## Paso 4 — Verificar

```bash
curl http://127.0.0.1:8000/api/health
```

Respuesta esperada (ejemplo):

```json
{"status":"ok","env":"production","database":"configured","database_dialect":"mysql",...}
```

Abrir en el navegador:

- Directo: `http://IP-SERVIDOR:3000`
- O el dominio configurado en el proxy

Login inicial:

- Usuario: `admin`
- Clave: la de `BOOTSTRAP_ADMIN_PASSWORD`

---

## Paso 5 — Seguridad post-arranque (obligatorio)

1. Entrar como `admin` y **cambiar la contraseña**.
2. Quitar o comentar `BOOTSTRAP_ADMIN_PASSWORD` en el `.env`.
3. Recargar backend:

```bash
docker compose up -d
```

4. Crear usuarios reales y asignar permisos de módulos desde **Admin → Usuarios**.

---

## Paso 6 — Proxy HTTPS (recomendado)

Apuntar el dominio al **frontend** (puerto `FRONTEND_PORT`, por defecto 3000).

Ejemplo Nginx:

```nginx
server {
  listen 443 ssl;
  server_name herramientas.tudominio.cl;

  # ssl_certificate ...;
  # ssl_certificate_key ...;

  client_max_body_size 500m;   # videos / Excels grandes

  location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }
}
```

Luego alinear el `.env`:

```env
PUBLIC_FRONTEND_URL=https://herramientas.tudominio.cl
CORS_ORIGINS=https://herramientas.tudominio.cl
```

```bash
docker compose up -d
```

Con `CROSS_SITE_AUTH=false`, el login usa cookies same-site vía rutas `/api` del frontend (no hace falta exponer el 8000 a Internet).

---

## Paso 7 — Cargar datos existentes (si aplica)

### Opción A — Dump MySQL entregado por el área funcional

```bash
# Contenedores ya arriba
docker compose exec -T db mysql -u root -p"$MYSQL_ROOT_PASSWORD" < respaldo_herramientas.sql
docker compose restart backend
```

### Opción B — Migración desde SQLite local (`users.db`)

1. Colocar `backend/users.db` en el servidor (copia segura).
2. Asegurar `.env` con `MYSQL_PASSWORD` y MySQL publicado en `MYSQL_PORT`.
3. Ejecutar:

```bash
cd backend
pip install pymysql sqlalchemy python-dotenv   # si hace falta en el host
py sync_sqlite_to_mysql.py                    # o: python sync_sqlite_to_mysql.py
cd ..
docker compose restart backend
```

En Windows del desarrollador también existe `Sincronizar_Local_a_Docker.bat`.

---

## Paso 8 — Persistencia (importante)

| Acción | ¿Se pierden datos? |
|--------|--------------------|
| `docker compose up -d --build` | No |
| `docker compose down` | No (volúmenes intactos) |
| `docker compose down -v` | **Sí** — borra MySQL y archivos del compresor |

Volúmenes relevantes: `mysql_data`, `compresor_input`, `compresor_output`.

Respaldo periódico:

```bash
docker compose exec -T db mysqldump -u root -p"$MYSQL_ROOT_PASSWORD" --databases herramientas --single-transaction > respaldo_herramientas.sql
```

---

## Paso 9 — Actualizar la aplicación (nuevas versiones)

```bash
cd herramientas-lms
git pull
docker compose up -d --build
```

Los datos en MySQL se mantienen.

---

## Comandos útiles de soporte

```bash
docker compose logs -f backend
docker compose logs -f frontend
docker compose logs -f db
docker compose restart backend
docker compose ps
```

---

## Checklist final TI

- [ ] Repo clonado  
- [ ] `.env` creado (no en Git)  
- [ ] `docker compose up -d --build` OK  
- [ ] `/api/health` responde `mysql` + `ok`  
- [ ] Login `admin` funciona  
- [ ] Contraseña admin cambiada y `BOOTSTRAP_ADMIN_PASSWORD` quitado  
- [ ] URL pública / CORS alineados  
- [ ] (Opcional) HTTPS + `client_max_body_size` alto  
- [ ] (Opcional) Datos migrados / dump restaurado  
- [ ] Respaldo MySQL programado  

---

## Contacto funcional

Ante dudas de negocio/módulos (permisos, catálogo Moodle, compresor), coordinar con el área usuaria de la plataforma. Detalle técnico ampliado: `DEPLOY_DOCKER.md`.
