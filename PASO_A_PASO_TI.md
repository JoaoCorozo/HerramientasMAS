# Paso a paso TI — Generar credenciales seguras (`.env`)

Repo: https://github.com/MAS-Consultores/herramientas-lms  

Esta guía indica **cómo generar** las credenciales de producción.  
**No reutilizar** secretos de un PC de desarrollo. El archivo `.env` **no se sube a GitHub**.

---

## Qué credenciales hay que generar

| Variable | Para qué sirve | Cómo debe ser |
|----------|----------------|---------------|
| `MYSQL_ROOT_PASSWORD` | Root del MySQL del contenedor | Contraseña aleatoria fuerte |
| `MYSQL_PASSWORD` | Usuario de la app (`herramientas`) | Contraseña aleatoria fuerte **distinta** a la de root |
| `JWT_SECRET_KEY` | Firma de sesiones / tokens | 64 caracteres hex (32 bytes) |
| `APP_ENCRYPTION_KEY` | Cifrado de datos sensibles en BD | 64 caracteres hex (32 bytes), **distinta** al JWT |
| `BOOTSTRAP_ADMIN_PASSWORD` | Solo crea el primer usuario `admin` | Contraseña temporal fuerte; **eliminar del `.env` después del primer login** |

Valores fijos (no son secretos; no hace falta “generarlos”):

```env
APP_ENV=production
MYSQL_DATABASE=herramientas
MYSQL_USER=herramientas
MYSQL_PORT=3306
ADMIN_MASTER_USER=admin
FRONTEND_PORT=3000
BACKEND_PORT=8000
CROSS_SITE_AUTH=false
```

URL pública (definir según el servidor, no inventar secretos):

```env
PUBLIC_FRONTEND_URL=https://tu-dominio-o-ip
CORS_ORIGINS=https://tu-dominio-o-ip
```

Usar la misma URL en ambas. Si aún no hay dominio: `http://IP-DEL-SERVIDOR:3000`.

---

## Paso 1 — Generar `JWT_SECRET_KEY` y `APP_ENCRYPTION_KEY`

Ejecutar **dos veces** (un valor para JWT y otro para encryption). Deben ser **distintos**.

### Linux / macOS / Git Bash / WSL

```bash
openssl rand -hex 32
openssl rand -hex 32
```

Ejemplo de salida (no copies estos; genera los tuyos):

```text
a1b2c3d4e5f6...   → JWT_SECRET_KEY
9f8e7d6c5b4a...   → APP_ENCRYPTION_KEY
```

### Windows PowerShell (sin OpenSSL)

```powershell
# JWT_SECRET_KEY
-join ((1..32) | ForEach-Object { '{0:x2}' -f (Get-Random -Maximum 256) })

# APP_ENCRYPTION_KEY (ejecutar de nuevo)
-join ((1..32) | ForEach-Object { '{0:x2}' -f (Get-Random -Maximum 256) })
```

Alternativa criptográficamente más robusta en PowerShell:

```powershell
function New-HexSecret([int]$bytes = 32) {
  $data = New-Object byte[] $bytes
  [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($data)
  ($data | ForEach-Object { $_.ToString('x2') }) -join ''
}
New-HexSecret   # JWT_SECRET_KEY
New-HexSecret   # APP_ENCRYPTION_KEY
```

### Python (cualquier SO con Python)

```bash
python -c "import secrets; print(secrets.token_hex(32)); print(secrets.token_hex(32))"
```

La primera línea → `JWT_SECRET_KEY`  
La segunda → `APP_ENCRYPTION_KEY`

---

## Paso 2 — Generar contraseñas MySQL y admin

Reglas:

- Mínimo **20 caracteres**
- Mezcla de mayúsculas, minúsculas y números
- **Evitar** en lo posible: `@ : / # ? %` (pueden romper URLs de conexión)
- `MYSQL_ROOT_PASSWORD` ≠ `MYSQL_PASSWORD` ≠ `BOOTSTRAP_ADMIN_PASSWORD`

### Linux / Git Bash / WSL

```bash
# Root MySQL
openssl rand -base64 24 | tr -d '/+=' | cut -c1-24

# Usuario herramientas
openssl rand -base64 24 | tr -d '/+=' | cut -c1-24

# Admin temporal (bootstrap)
openssl rand -base64 18 | tr -d '/+=' | cut -c1-20
```

### Windows PowerShell

```powershell
function New-AppPassword([int]$len = 24) {
  $chars = (48..57 + 65..90 + 97..122) | ForEach-Object { [char]$_ }
  -join ((1..$len) | ForEach-Object { $chars | Get-Random })
}
New-AppPassword 24   # MYSQL_ROOT_PASSWORD
New-AppPassword 24   # MYSQL_PASSWORD
New-AppPassword 20   # BOOTSTRAP_ADMIN_PASSWORD
```

### Python

```bash
python -c "import secrets,string; a=string.ascii_letters+string.digits; print(''.join(secrets.choice(a) for _ in range(24))); print(''.join(secrets.choice(a) for _ in range(24))); print(''.join(secrets.choice(a) for _ in range(20)))"
```

Orden de las tres líneas:

1. `MYSQL_ROOT_PASSWORD`  
2. `MYSQL_PASSWORD`  
3. `BOOTSTRAP_ADMIN_PASSWORD`

---

## Paso 3 — Armar el `.env` con lo generado

En el servidor, dentro del repo clonado:

```bash
cp .env.docker.example .env
```

Editar `.env` y dejarlo así (pegando **solo** los valores que generaron):

```env
APP_ENV=production

MYSQL_ROOT_PASSWORD=<pegado_paso_2_1>
MYSQL_DATABASE=herramientas
MYSQL_USER=herramientas
MYSQL_PASSWORD=<pegado_paso_2_2>
MYSQL_PORT=3306

JWT_SECRET_KEY=<pegado_paso_1_jwt>
APP_ENCRYPTION_KEY=<pegado_paso_1_encryption>

BOOTSTRAP_ADMIN_PASSWORD=<pegado_paso_2_3>
ADMIN_MASTER_USER=admin

PUBLIC_FRONTEND_URL=https://tu-dominio-o-ip
CORS_ORIGINS=https://tu-dominio-o-ip

FRONTEND_PORT=3000
BACKEND_PORT=8000

CROSS_SITE_AUTH=false
```

### Checklist de seguridad del `.env`

- [ ] JWT y Encryption son distintos  
- [ ] Las 3 contraseñas (root, mysql, admin) son distintas  
- [ ] Ningún valor es el de ejemplo (`cambia_*`, `AdminTemporal123!`)  
- [ ] Ningún valor es el de un PC de desarrollo  
- [ ] `.env` está solo en el servidor (permisos restringidos; no en Git)  
- [ ] `PUBLIC_FRONTEND_URL` y `CORS_ORIGINS` coinciden con la URL real de acceso  

Permisos recomendados (Linux):

```bash
chmod 600 .env
```

---

## Paso 4 — Guardar credenciales de forma segura

1. Guardar el `.env` (o un extracto) en el **gestor de secretos** de la empresa (Vault, 1Password, Bitwarden empresarial, ticket cifrado, etc.).
2. Entregar al área funcional, por canal privado:
   - URL de la app  
   - Usuario: `admin`  
   - Clave temporal: valor de `BOOTSTRAP_ADMIN_PASSWORD`  
3. **No** enviar el `.env` completo por correo/Teams sin cifrado si la política lo prohíbe.

---

## Paso 5 — Tras el primer arranque (obligatorio)

Cuando la app ya esté arriba (`docker compose up -d --build`):

1. Login con `admin` + `BOOTSTRAP_ADMIN_PASSWORD`.
2. Cambiar la contraseña del admin desde la aplicación.
3. **Eliminar o comentar** la línea `BOOTSTRAP_ADMIN_PASSWORD` del `.env`.
4. Aplicar:

```bash
docker compose up -d
```

Así se cierra la clave temporal del bootstrap.

---

## Paso 6 — Rotación (si hubo filtración o salida de personal)

Generar de nuevo con los pasos 1–2 y actualizar el `.env`:

| Si rotas… | Efecto |
|-----------|--------|
| `JWT_SECRET_KEY` | Todos deben volver a iniciar sesión |
| `APP_ENCRYPTION_KEY` | Puede invalidar datos cifrados con la clave anterior; coordinar con desarrollo |
| `MYSQL_PASSWORD` / root | Actualizar `.env` y recrear/ajustar el servicio `db` según política Docker |
| Contraseña de `admin` | Cambiarla en la UI (preferible) |

---

## Resumen rápido

```text
1. openssl rand -hex 32          → JWT_SECRET_KEY
2. openssl rand -hex 32          → APP_ENCRYPTION_KEY  (otro valor)
3. 3 contraseñas aleatorias      → MYSQL_ROOT, MYSQL_PASSWORD, BOOTSTRAP_ADMIN
4. Pegar en .env + URL pública
5. chmod 600 .env
6. Tras primer login: quitar BOOTSTRAP_ADMIN_PASSWORD
```

Arranque de la app y volúmenes: ver `DEPLOY_DOCKER.md`.
