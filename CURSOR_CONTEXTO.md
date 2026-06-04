# Contexto para Cursor — Plataforma de Herramientas BEX (Web)

> **Última actualización:** junio 2026  
> **Repo GitHub:** https://github.com/JoaoCorozo/HerramientasMAS  
> **Documentación extendida:** `documentacion_proyecto_bex.md`, `docs/MANUAL_USUARIO_PLATAFORMA_BEX.md`

Este archivo es el punto de entrada para un compañero (o una IA en Cursor) que continúe el desarrollo en **otro equipo**. Léelo antes de tocar código.

---

## 1. Qué es este proyecto

Sistema web interno de BEX para herramientas de productividad: comparar Excels, normalizar RUT/textos, gestionar capacitaciones, enlaces, calendario de tareas con correos, y **generador de cargas Moodle** (CSV por perfil de inducción).

| Capa | Tecnología | Carpeta |
|------|------------|---------|
| Frontend | Next.js 16, React 19, TypeScript, Tailwind v4, shadcn/Radix | `frontend/` |
| Backend | FastAPI, Python 3.11, SQLAlchemy | `backend/` |
| BD local | SQLite `backend/users.db` | variable `DATABASE_URL` |
| BD producción | PostgreSQL (Neon) | misma variable en Render |

Existe también una **app de escritorio** (CustomTkinter) en otra carpeta; **no es este repo**.

---

## 2. Arranque en un PC nuevo

### Requisitos
- Python 3.11+ (`py` en Windows)
- Node.js 18+ y npm
- Git

### Pasos
```bash
git clone https://github.com/JoaoCorozo/HerramientasMAS.git
cd HerramientasMAS   # o Plataforma_Herramientas_Web según carpeta local

# Backend
cd backend
pip install -r requirements.txt
copy .env.example .env    # ajustar si hace falta

# Frontend
cd ../frontend
npm install
```

**Windows (recomendado):** doble clic en `Iniciar_Web.bat` en la raíz.

- Frontend: http://localhost:3000  
- Backend: http://127.0.0.1:8000  
- API docs: http://127.0.0.1:8000/docs  

**Credenciales locales por defecto:** `admin` / `admin123` (creado al primer arranque con `BOOTSTRAP_ADMIN_PASSWORD`).

### Proxy API
En local, `frontend/lib/api.ts` usa rutas relativas `/api/...`. Next reescribe a `:8000` vía `frontend/next.config.mjs`. Las cookies de sesión van con `credentials: "include"`.

---

## 3. Estructura del repositorio

```
/
├── backend/
│   ├── main.py              # FastAPI: todos los endpoints
│   ├── models.py            # User, AppData, MoodleCourse, InductionProfile, ProfileCourse
│   ├── database.py          # Engine SQLite/PostgreSQL
│   ├── auth.py, deps.py     # JWT, permisos por módulo
│   ├── matriz_db.py         # Catálogo y perfiles en BD (generador)
│   ├── matriz_cursos.py     # Lectura Excel (catálogo + hojas perfil)
│   ├── paths.py               # Resuelve «cursos bex Moodle.xlsx»
│   └── scripts/             # utilidades (deploy, build excel, permisos)
├── frontend/
│   ├── app/                 # Páginas (App Router)
│   │   ├── page.tsx         # Comparador
│   │   ├── rut/, textos/, capacitaciones/, enlaces/
│   │   ├── recordatorios/   # Calendario & tareas
│   │   ├── generador/       # Wizard 4 pasos + perfiles
│   │   └── admin/usuarios/
│   ├── components/          # UI + auth-provider, sidebar, generador-profile-manager
│   ├── lib/api.ts           # fetch al backend
│   └── public/mail-composer-prefill.js  # Script para sitio externo BEX
├── docs/                    # Manual, capturas, integración Mail Composer
├── cursos bex Moodle.xlsx   # Catálogo Moodle (id, shortname) — va en Docker
├── Dockerfile, render.yaml  # Deploy backend Render
├── Iniciar_Web.bat
└── CURSOR_CONTEXTO.md       # Este archivo
```

---

## 4. Módulos y permisos

Cada usuario tiene `permissions_json`: lista de módulos permitidos. El superadmin ve todo.

| Módulo (`moduleName`) | Ruta frontend | Descripción breve |
|----------------------|---------------|-------------------|
| `comparador` | `/` | Comparar dos Excels |
| `rut` | `/rut` | Normalizar RUT chileno |
| `textos` | `/textos` | Normalizar nombres/textos |
| `capacitaciones` | `/capacitaciones` | Tabla de videos/capacitaciones |
| `enlaces` | `/enlaces` | Catálogo de enlaces |
| `recordatorios` | `/recordatorios` | Calendario de tareas + SMTP |
| `generador` | `/generador` | CSV de carga Moodle por perfil |

Datos por usuario en tabla `app_data` (`module_name` + `payload_json`): capacitaciones, enlaces, recordatorios, smtp_config.

---

## 5. Generador de cargas (estado actual — importante)

### Arquitectura actual (2026)
- **Catálogo Moodle** (`id` → `shortname`): tabla `moodle_courses`, seed desde `cursos bex Moodle.xlsx` en raíz.
- **Perfiles de inducción**: tablas `induction_profiles` + `profile_courses`. **Se gestionan en la app**, no en hojas Excel sueltas.
- Al arrancar el backend: `ensure_matriz_seeded(db)` si las tablas están vacías.
- La columna **PERFIL DE INDUCCIÓN** en la dotación debe coincidir con el **nombre del perfil** en BD (normalización sin acentos/mayúsculas).

### Archivos clave
- `backend/matriz_db.py` — seed, CRUD, `courses_for_perfil()`
- `frontend/components/generador-profile-manager.tsx` — UI perfiles
- `frontend/app/generador/page.tsx` — wizard 4 pasos; preview con scroll interno en tabla

### APIs generador
- `GET /api/excel/matriz-info` — resumen BD
- `GET|POST|PUT|DELETE /api/generador/perfiles`
- `GET /api/generador/cursos?search=`
- `POST /api/generador/sync-catalogo`
- `POST /api/excel/inspect`, `/preview`, `/generar-carga`

### CSV de salida
- UTF-8 con BOM, separador `;`
- Columnas Moodle + `group1`, `course1`, … según perfil
- ZIP con un CSV por perfil

> **Obsoleto:** `MATRIZ_CURSOS_BEX.xlsx` ya no está en la raíz; no reintroducir sin motivo.

---

## 6. Calendario & tareas + Mail Composer

Ruta: `frontend/app/recordatorios/page.tsx`

Cada tarea guarda (obligatorio para mail):
- `curso` (ID Moodle), `grupo`, `asunto`, `cuerpo_mail`
- Opcional: título, notas, ruta local, correo recordatorio 9:00

Botón **Abrir Mail Composer (campos listos)** construye URL hacia:
`https://www.gestiondepersonasbex.cl/api/mail_composer.php?key=...&courseid=...&grupo=...&asunto=...&cuerpo=...`

- Lógica URL: `frontend/lib/mail-composer.ts`
- **No envía correos** desde la plataforma; solo abre el composer con datos.
- Para que el sitio externo **rellene campos**, hay que agregar en su `mail_composer.php`:
  ```html
  <script src="https://TU-PLATAFORMA/mail-composer-prefill.js" defer></script>
  ```
  Ver `docs/integracion_mail_composer.md` y `frontend/public/mail-composer-prefill.js`.

Recordatorios SMTP: worker en background en `backend/main.py` (9:00 AM, correos consolidados).

---

## 7. Autenticación

- Login: `POST /api/auth/login` → cookie JWT httpOnly
- Sesión: `GET /api/auth/me`
- Permisos: decorador `require_permission("modulo")` en `backend/deps.py`
- Frontend: `components/auth-provider.tsx` redirige a `/login` si no hay sesión

---

## 8. Despliegue

| Servicio | Qué despliega |
|----------|----------------|
| **Vercel** | `frontend/` (ver `frontend/vercel.json`) |
| **Render** | Backend Docker (`Dockerfile` copia `cursos bex Moodle.xlsx`) |

Variables críticas producción: `DATABASE_URL`, `JWT_SECRET_KEY`, `CORS_ORIGINS`, `PUBLIC_FRONTEND_URL`, `MATRIZ_CURSOS_PATH=/app/cursos bex Moodle.xlsx`.

Guías: `DEPLOY_NUBE.md`, `PASO_A_PASO_NUBE.md`. Plantilla vars: `deploy-vars.local.example` (generar con `backend/scripts/generate_deploy_vars.py`).

---

## 9. Convenciones al programar

1. **Minimal diff** — no refactorizar módulos ajenos al ticket.
2. **Reutilizar** patrones existentes (shadcn, `apiFetch`, SQLAlchemy en `matriz_db.py`).
3. **No commitear:** `backend/users.db`, `backend/.env`, `deploy-vars.local.txt`, `backend/cookies.txt`, CSVs/Excels de prueba (excepto `cursos bex Moodle.xlsx`).
4. **Commits en español**, estilo natural del equipo.
5. **Temas UI:** usar `theme-provider.tsx` propio; **no** reactivar `next-themes` (incompatible React 19).
6. **Excel grande:** backend con openpyxl/xlrd; frontend puede usar proxy Next o `NEXT_PUBLIC_API_URL` directo al backend.

---

## 10. Problemas frecuentes

| Síntoma | Causa / solución |
|---------|------------------|
| 404 en `/api/textos/normalizar` | Backend viejo; reiniciar con `Iniciar_Web.bat` |
| Generador sin `course1`/`group1` | Perfil no coincide con PERFIL DE INDUCCIÓN o BD vacía → reiniciar backend para seed |
| Perfiles vacíos en UI pero matriz-info muestra 9 | Backend sin ruta `/api/generador/perfiles` → reiniciar backend |
| Mail Composer abre vacío | Falta script `mail-composer-prefill.js` en gestiondepersonasbex.cl |
| Puertos ocupados | Cerrar terminales Backend/Frontend anteriores |
| Login falla en prod | Revisar `CORS_ORIGINS` y cookies cross-site (`CROSS_SITE_AUTH`) |

---

## 11. Comandos útiles

```bash
# Backend dev
cd backend && py -m uvicorn main:app --reload --port 8000

# Frontend dev
cd frontend && npm run dev

# Seed manual catálogo/perfiles
cd backend && py -c "from database import SessionLocal; from matriz_db import ensure_matriz_seeded; db=SessionLocal(); ensure_matriz_seeded(db); db.close()"

# Health check
curl http://127.0.0.1:8000/api/health
```

---

## 12. Para la IA en Cursor

Al iniciar una tarea:
1. Leer este archivo y, si hace falta, `documentacion_proyecto_bex.md`.
2. Identificar si el cambio es frontend (`frontend/app/...`), backend (`backend/main.py` o módulos), o ambos.
3. Probar en local antes de proponer deploy.
4. No crear commits ni push salvo que el usuario lo pida explícitamente.
5. Responder y documentar en **español**.
