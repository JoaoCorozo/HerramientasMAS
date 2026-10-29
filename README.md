# Herramientas LMS (BEX / MAS)

Plataforma web interna de herramientas (comparador Excel, RUT, capacitaciones, generador Moodle, análisis de resultados, compresor de videos, etc.).

## Stack

| Capa | Tecnología |
|------|------------|
| Frontend | Next.js (puerto 3000) |
| Backend | FastAPI + FFmpeg (puerto 8000) |
| Base de datos | MySQL 8.4 (volumen Docker `mysql_data`) |

## Despliegue Docker (servidor empresa)

Guía completa: [`DEPLOY_DOCKER.md`](DEPLOY_DOCKER.md)

```bash
cp .env.docker.example .env
# Editar .env (contraseñas, JWT, URL pública)

docker compose up -d --build
```

- App: `http://servidor:3000` (o dominio detrás de proxy)
- API health: `http://servidor:8000/api/health`
- Login inicial: `admin` + `BOOTSTRAP_ADMIN_PASSWORD` del `.env`

## Persistencia de datos

Los datos **no se borran** al hacer rebuild si no usas `-v`:

| Volumen Docker | Contenido |
|----------------|-----------|
| `mysql_data` | Usuarios, perfiles, cursos, capacitaciones, etc. |
| `compresor_input` / `compresor_output` | Videos del compresor |

```bash
docker compose down        # OK: conserva MySQL y volúmenes
docker compose down -v     # PELIGRO: borra la base de datos
```

### Migrar datos locales → Docker / servidor

1. Tener `backend/users.db` (SQLite local) y `.env` con `MYSQL_*`.
2. Contenedores arriba (`docker compose up -d`).
3. Ejecutar `Sincronizar_Local_a_Docker.bat` (o `py backend/sync_sqlite_to_mysql.py`).

Para respaldar MySQL del Docker:

```bash
docker compose exec db mysqldump -u root -p"$MYSQL_ROOT_PASSWORD" herramientas > respaldo_herramientas.sql
```

Restaurar en otro servidor:

```bash
docker compose exec -T db mysql -u root -p"$MYSQL_ROOT_PASSWORD" herramientas < respaldo_herramientas.sql
```

## Requisitos en el repo

- `cursos bex Moodle.xlsx` en la raíz (catálogo)
- Carpeta `compresor_video/carpeta para el video` (plantilla ZIP)

## Seguridad

**No versionar:** `.env`, `backend/users.db`, `backend/cookies.txt`, dumps SQL con datos reales.

Usar solo `.env.docker.example` como plantilla.
