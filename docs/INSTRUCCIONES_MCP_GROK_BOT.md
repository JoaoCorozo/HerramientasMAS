# Instrucciones TI — MCP para Grok Bot

Guía para activar el servidor MCP de la Plataforma Herramientas LMS y que **Grok Bot** pueda usarlo.

## Resumen

| Ítem | Valor |
|------|--------|
| Endpoint | `/mcp/` (Streamable HTTP) |
| Auth | Header `Authorization: Bearer <MCP_API_KEY>` |
| Código | `backend/mcp_server.py` (montado desde `backend/main.py`) |
| Requisito crítico | URL **HTTPS pública en internet** |

Grok Bot corre en la nube y **no puede** alcanzar:

- `localhost`
- URLs solo Netbird/VPN (ej. `https://herramientaslms.netbird.grupomasconsultores.cl`)

Hay que publicar `/mcp/` (idealmente solo esa ruta) en un dominio HTTPS accesible desde internet.

---

## 1. Actualizar el código en el servidor

```bash
cd /ruta/al/repo
git pull origin main
# o: git pull mas main
```

Commit de referencia: *Agregar servidor MCP remoto para Grok Bot*.

---

## 2. Variables de entorno

En el `.env` de la raíz (Docker) o el que use `docker compose`:

```env
MCP_ENABLED=true
MCP_API_KEY=REEMPLAZAR_POR_SECRETO_LARGO
```

Generar un secreto, por ejemplo:

```bash
openssl rand -hex 32
```

**No** subir la API key a git. Entregarla al equipo por canal seguro.

Plantillas: `.env.docker.example`, `backend/.env.example`.

---

## 3. Rebuild del backend

```bash
docker compose up -d --build backend
```

Comprobar salud:

```bash
curl -fsS http://127.0.0.1:8000/api/health
```

En la respuesta JSON debe aparecer algo como:

```json
"mcp_enabled": true,
"mcp_path": "/mcp/"
```

Si `mcp_enabled` es `false`, falta `MCP_ENABLED` / `MCP_API_KEY` o el contenedor no recibió esas vars.

---

## 4. Proxy HTTPS público (Nginx)

Publicar **solo** `/mcp/` hacia el backend (puerto host del backend, por defecto `8000`):

```nginx
location /mcp/ {
  proxy_pass http://127.0.0.1:8000/mcp/;
  proxy_http_version 1.1;
  proxy_set_header Host $host;
  proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
  proxy_set_header X-Forwarded-Proto $scheme;
  proxy_set_header Authorization $http_authorization;
  proxy_buffering off;
}
```

Certificado TLS válido (Let's Encrypt u otro).

Ejemplos de URL válida:

- `https://mcp-herramientaslms.tudominio-publico.cl/mcp/`
- o el mismo dominio público corporativo, con `location /mcp/`

La app completa puede seguir solo en Netbird; Grok Bot solo necesita `/mcp/`.

Recargar Nginx tras el cambio.

---

## 5. Prueba rápida desde fuera de la VPN

Desde un equipo **sin** Netbird:

```bash
curl -i -X POST "https://URL-PUBLICA/mcp/" \
  -H "Authorization: Bearer TU_MCP_API_KEY" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream"
```

- Sin Bearer → no debe dejar usar herramientas (401 / auth required).
- Con Bearer → no debe ser timeout / connection refused.

Si solo responde dentro de Netbird, Grok Bot seguirá fallando.

---

## 6. Entregar al equipo de producto

1. URL HTTPS pública final (con `/mcp/` al final).
2. Confirmación de `MCP_ENABLED=true` y rebuild hecho.
3. Valor de `MCP_API_KEY` por canal seguro.

Ellos conectan Grok Bot con un mensaje del estilo:

```text
Add a custom MCP server called plataforma-lms at https://URL-PUBLICA/mcp/ with header Authorization Bearer TU_MCP_API_KEY
```

Luego en el chat:

```text
@plataforma-lms lista los módulos de la plataforma
```

---

## Tools expuestas (referencia)

- `platform_health`
- `list_modules`
- `normalize_rut`
- `normalize_textos`
- `list_induction_profiles`
- `search_moodle_courses`
- `courses_for_induction_profile`
- `matriz_summary`

Son sobre todo lectura / normalización; no sustituyen el login de usuarios de la web.

---

## Checklist TI

- [ ] `git pull` del repo
- [ ] `MCP_ENABLED=true` y `MCP_API_KEY` en `.env`
- [ ] `docker compose up -d --build backend`
- [ ] `/api/health` muestra `"mcp_enabled": true`
- [ ] Nginx (u otro) publica `/mcp/` por HTTPS **público**
- [ ] Prueba `curl` desde fuera de Netbird
- [ ] Entregar URL + API key al equipo

---

## Referencias en el repo

- Código: `backend/mcp_server.py`
- Compose: `docker-compose.yml` (`MCP_ENABLED`, `MCP_API_KEY`)
- Deploy general: `DEPLOY_DOCKER.md` (sección HTTPS / proxy)
- Contexto dev: `CURSOR_CONTEXTO.md` (apartado MCP / Grok Bot)
