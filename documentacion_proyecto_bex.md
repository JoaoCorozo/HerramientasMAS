# 📋 Documentación Completa del Proyecto: Plataforma de Herramientas BEX

> Documento generado el 22/05/2026 para traspaso a nueva IA.  
> Incluye arquitectura, tecnologías, módulos, API, base de datos y estado actual.

---

## 1. Resumen Ejecutivo

La **Plataforma de Herramientas BEX** es un sistema interno de productividad desarrollado para la empresa BEX. Existe en **dos versiones que coexisten**:

| Versión | Ubicación | Tecnología | Estado |
|---------|-----------|------------|--------|
| **Desktop (App)** | `C:\Users\jcorozo\Desktop\Scripts\Herramientas_App\` | Python + CustomTkinter | Producción |
| **Web (Plataforma)** | `C:\Users\jcorozo\Desktop\Plataforma_Herramientas_Web\` | Next.js + FastAPI | Producción |

Ambas versiones comparten los mismos módulos funcionales pero están desarrolladas de forma independiente.

---

## 2. Arquitectura General (Versión Web)

```
┌─────────────────────────────────────────────────────┐
│                    USUARIO                          │
└─────────────────┬───────────────────────────────────┘
                  │ http://localhost:3000
┌─────────────────▼───────────────────────────────────┐
│          FRONTEND - Next.js 16.2.6                  │
│          (React 19, TypeScript, Tailwind CSS v4)    │
│          Puerto: 3000                               │
└─────────────────┬───────────────────────────────────┘
                  │ fetch() → http://127.0.0.1:8000
┌─────────────────▼───────────────────────────────────┐
│          BACKEND - FastAPI (Python)                 │
│          Puerto: 8000                               │
│          CORS: allow_origins=["*"]                  │
└─────────────────┬───────────────────────────────────┘
                  │ SQLAlchemy ORM
┌─────────────────▼───────────────────────────────────┐
│  Base de datos: SQLite (local) ó PostgreSQL (Neon)  │
│  Archivo: backend/users.db                          │
│  La variable DATABASE_URL determina cuál se usa     │
└─────────────────────────────────────────────────────┘
```

### Cómo se inicia (Web)
Doble clic en `Iniciar_Web.bat` que:
1. Abre terminal para FastAPI: `py -m uvicorn main:app --reload --port 8000`
2. Abre terminal para Next.js: `npm run dev`
3. Abre el navegador en `http://localhost:3000` después de 6 segundos

---

## 3. Stack Tecnológico Detallado

### Frontend (Web)
| Tecnología | Versión | Uso |
|------------|---------|-----|
| **Next.js** | 16.2.6 con Turbopack | Framework React SSR/SSG |
| **React** | 19 | UI Library |
| **TypeScript** | 5.7.3 | Tipado estático |
| **Tailwind CSS** | v4.2.0 | Estilos utility-first |
| **tw-animate-css** | 1.3.3 | Animaciones CSS |
| **Radix UI** | Múltiples | Componentes accesibles (Dialog, Select, etc.) |
| **Lucide React** | ^0.564 | Iconos |
| **shadcn/ui** | (componentes locales) | Sistema de diseño en `components/ui/` |
| **xlsx** | ^0.18.5 | Lectura de Excel en el cliente |
| **next-themes** | ^0.4.6 | Instalado pero **NO USADO** (reemplazado) |

> ⚠️ **IMPORTANTE**: `next-themes` está en `package.json` pero fue reemplazado por un provider propio debido a incompatibilidad con React 19 (inyectaba `<script>` dentro de un componente).

### Backend (Web)
| Tecnología | Uso |
|------------|-----|
| **FastAPI** | Framework API REST |
| **Uvicorn** | Servidor ASGI |
| **SQLAlchemy** | ORM para base de datos |
| **openpyxl** | Lectura/escritura de archivos Excel |
| **PyJWT** | Generación y validación de tokens JWT |
| **passlib[bcrypt] + bcrypt==3.2.2** | Hash de contraseñas |
| **python-multipart** | Soporte para `multipart/form-data` (subida de archivos) |
| **psycopg2-binary** | Conector PostgreSQL |
| **smtplib** (stdlib) | Envío de correos electrónicos |

### Desktop (App)
| Tecnología | Uso |
|------------|-----|
| **Python 3.x** | Lenguaje base |
| **CustomTkinter** | Framework GUI moderno sobre Tkinter |
| **openpyxl** | Manipulación de Excel |
| **smtplib** (stdlib) | Envío de correos |

---

## 4. Base de Datos

### Esquema SQLite/PostgreSQL

#### Tabla `users`
```sql
id              INTEGER     PRIMARY KEY AUTOINCREMENT
username        VARCHAR(50) UNIQUE, INDEXED
hashed_password VARCHAR(255)
role            VARCHAR(20) DEFAULT 'user'  -- 'superadmin' | 'user'
permissions_json VARCHAR(500) DEFAULT '[]'  -- JSON: ["comparador","rut","textos",...]
```

#### Tabla `app_data`
```sql
id           INTEGER     PRIMARY KEY AUTOINCREMENT
username     VARCHAR(50) INDEXED           -- A qué usuario pertenece el dato
module_name  VARCHAR(50) INDEXED           -- 'capacitaciones' | 'enlaces' | 'recordatorios' | 'smtp_config'
payload_json TEXT                          -- JSON con los datos del módulo
```

### Base de Datos Dual (Local vs Nube)
El archivo `database.py` funciona así:
```python
DEFAULT_URL = "postgresql://neondb_owner:...@ep-silent-leaf-acaw6aak.sa-east-1.aws.neon.tech/neondb?sslmode=require"
SQLALCHEMY_DATABASE_URL = os.getenv("DATABASE_URL", DEFAULT_URL)
```
- **Con `DATABASE_URL=sqlite:///./users.db`** (seteado en `Iniciar_Web.bat`): usa **SQLite local**
- **Sin esa variable** (deploy en producción): usa **PostgreSQL en Neon.tech** (cloud)

### Módulos disponibles (permisos)
```
comparador | rut | textos | capacitaciones | enlaces | recordatorios
```

### Usuario Admin por defecto
- **Usuario**: `admin`
- **Contraseña**: `admin123`
- **Rol**: `superadmin` (acceso a todo)

---

## 5. Autenticación y Seguridad

- **Tipo**: JWT Bearer Token
- **Algoritmo**: HS256
- **Expiración**: 24 horas
- **Secret Key**: `super_secret_key_change_in_production` ⚠️ (cambiar en producción)
- **Flujo**:
  1. `POST /api/auth/login` con `username` + `password` (form-data)
  2. Responde `{ access_token, token_type: "bearer" }`
  3. El frontend guarda el token en `localStorage` y lo envía en cada request como `Authorization: Bearer <token>`

---

## 6. API Endpoints Completos (Backend FastAPI)

### Autenticación
| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | `/api/auth/login` | Login, retorna JWT |
| GET | `/api/auth/me` | Datos del usuario autenticado |

### Gestión de Usuarios (solo superadmin)
| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/api/users` | Listar todos los usuarios |
| POST | `/api/users` | Crear usuario |
| PUT | `/api/users/{id}` | Actualizar usuario |
| DELETE | `/api/users/{id}` | Eliminar usuario |

### Normalizadores
| Método | Ruta | Permiso | Descripción |
|--------|------|---------|-------------|
| POST | `/api/rut/normalizar` | `rut` | Normaliza RUT chileno (con/sin puntos, con/sin guión) |
| POST | `/api/nombres/normalizar` | `textos` | Normaliza texto (mayúsculas/minúsculas/título) |

### Base de Datos JSON (módulos con persistencia)
| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/api/db/{module_name}` | Lee datos del módulo del usuario actual |
| POST | `/api/db/{module_name}` | Guarda datos del módulo del usuario actual |

`module_name` válidos: `capacitaciones`, `enlaces`, `recordatorios`, `smtp_config`

### Comparador de Datos Excel
| Método | Ruta | Permiso | Descripción |
|--------|------|---------|-------------|
| POST | `/api/excel/hojas` | `comparador` | Lista las hojas de un Excel subido |
| POST | `/api/comparador` | `comparador` | Compara dos archivos Excel, devuelve `.xlsx` con resultados |

**Parámetros de `/api/comparador`** (multipart/form-data):
- `file1`, `file2` — Archivos Excel
- `tipo_reporte` — `"diferencias"` | `"coincidencias"` | `"ambos"`
- `c_ini1`, `c_fin1` — Rango de columnas Excel (letra), ej: `"A"`, `"C"`
- `f_ini1`, `f_fin1` — Rango de filas (número)
- `hoja1`, `hoja2` — Nombre de hoja o `"Activa (Por defecto)"`

### Generador de Cargas (Módulo Principal)
| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | `/api/excel/inspect` | Inspecciona un Excel y retorna todas sus hojas con sus encabezados |
| POST | `/api/excel/preview` | Genera previsualización de las 10 primeras filas del CSV de salida |
| POST | `/api/excel/generar-carga` | Procesa el Excel completo y retorna un `.zip` con CSVs por perfil |

**Parámetros de `/api/excel/preview` y `/api/excel/generar-carga`** (multipart/form-data):
- `file` — Archivo Excel de dotación
- `sheet_name` — Nombre de la hoja a procesar
- `grupo` — Nombre del grupo de inducción (se rellena en columnas `group1`, `group2`, etc.)
- `mapping` — JSON string con mapeo de columnas. Ejemplo:
  ```json
  {
    "username": {"type": "column", "value": "RUN"},
    "auth":     {"type": "fixed",  "value": "saml2"},
    "suspended":{"type": "fixed",  "value": "0"},
    "firstname":{"type": "column", "value": "NOMBRE"}
  }
  ```

---

## 7. Módulo Generador de Cargas (Descripción Detallada)

Es el módulo más complejo. Genera archivos CSV listos para importar en Moodle, separados por perfil/departamento.

### Flujo del Wizard (4 pasos en el Frontend)

```
Paso 1: Subir Excel
   │  → Llama a /api/excel/inspect
   │  → Devuelve: { sheets: { "Hoja1": ["col1","col2",...], ... } }
   ▼
Paso 2: Seleccionar hoja + columnas de salida Moodle
   │  → Usuario elige cuáles de los 26 campos Moodle quiere incluir
   │  → Sistema pre-selecciona 9 "recomendadas"
   ▼
Paso 3: Configurar mapeo columna por columna
   │  → Para cada campo Moodle, el usuario elige:
   │     - "Columna Excel": selecciona cuál columna del Excel mapea
   │     - "Valor Manual Fijo": escribe un valor fijo (ej: "saml2", "0")
   │  → Mapeos guardados en localStorage para persistencia
   ▼
Paso 4: Previsualizar → Generar ZIP
   → Llama a /api/excel/preview → Tabla de 10 filas por perfil
   → Llama a /api/excel/generar-carga → Descarga .zip con 1 CSV por perfil
```

### Normalizaciones que aplica el Backend
| Campo | Transformación |
|-------|----------------|
| `username`, `password` | RUT limpiado: quita puntos, guiones, espacios. Si termina en K, la pone minúscula |
| `firstname`, `lastname` | `.upper().strip()` |
| `email` | `.upper().strip()` |
| `department` | `.upper().strip()` (este campo determina el perfil) |
| `auth` | Generalmente se pone como valor fijo `"saml2"` |
| `suspended` | Generalmente valor fijo `"0"` |

### Lógica de Perfiles y Cursos (MATRIZ_CURSOS_BEX.xlsx)
- El archivo `MATRIZ_CURSOS_BEX.xlsx` vive en la **raíz del proyecto** (`C:\...\Plataforma_Herramientas_Web\`)
- Cada **hoja** del Excel = un **perfil** (ej: "VIGILANTE", "ADMINISTRATIVO")
- La columna A de cada hoja (desde fila 3) = lista de cursos asignados a ese perfil
- Al generar, si el `department` del colaborador coincide con un nombre de hoja (normalizado), se añaden columnas `group1`, `course1`, `group2`, `course2`... con el nombre del grupo y los cursos

### Formato del CSV de salida
- Codificación: **UTF-8 con BOM** (`utf-8-sig`) — compatible con Excel español
- Separador: **punto y coma** (`;`)
- Nombre: `script_{PERFIL_NORMALIZADO}.csv`
- Todo empaquetado en `Cargas_Induccion_YYYYMMDD_HHMMSS.zip`

### Campos Moodle disponibles (26 total)
```
username, institution, password, middlename, department, address, aim,
phone1, firstname, phone2, alternatename, msn, description, company,
lastname, role, yahoo, email, suspended, auth, skype, icq,
country, city, firstnamephonetic, lastnamephonetic
```

---

## 8. Sistema de Temas y Paletas (Frontend Web)

### Problema Resuelto
`next-themes` inyecta un `<script>` dentro de un componente React, lo que React 19 prohíbe. Se reemplazó con un provider propio.

### Implementación Actual

**Archivos involucrados:**
- `frontend/components/theme-provider.tsx` — Context provider propio
- `frontend/app/layout.tsx` — Inline script en `<head>` para FOUC prevention
- `frontend/components/app-sidebar.tsx` — UI del selector
- `frontend/app/globals.css` — Variables CSS para temas y paletas

**Cómo funciona:**
1. Al cargar la página, un `<script>` inline en `<head>` lee `localStorage` y aplica la clase `.dark` o `.light` al `<html>` ANTES del primer render (evita parpadeo)
2. El `ThemeProvider` en React lee también `localStorage` y mantiene el estado de React sincronizado
3. El botón en el sidebar llama a `setTheme()` o `setPalette()` que actualizan `localStorage` + `classList` del `<html>`

**localStorage keys:**
- `app-theme` → `"dark"` | `"light"`
- `app-palette` → `"azul"` | `"violeta"` | `"verde"` | `"naranja"` | `"rosa"` | `"cyan"` | `"rojo"` | `"ambar"`

**CSS:**
- Las paletas funcionan con `data-palette="nombre"` en el elemento `<html>`
- El modo oscuro con clase `.dark` en `<html>`
- La especificidad CSS: `.dark[data-palette="violeta"]` sobreescribe a `.dark` para los colores primarios

### Paletas disponibles (8)
| ID | Color | HEX aprox |
|----|-------|-----------|
| `azul` (default) | 🔵 Azul | #4f7fff |
| `violeta` | 🟣 Violeta | #9747ff |
| `verde` | 🟢 Verde | #22c87a |
| `naranja` | 🟠 Naranja | #ff8c30 |
| `rosa` | 🌸 Rosa | #f43f8f |
| `cyan` | 🩵 Cyan | #06b6d4 |
| `rojo` | 🔴 Rojo | #ef4444 |
| `ambar` | 🟡 Ámbar | #f59e0b |

---

## 9. Sistema de Recordatorios y Correos (Backend)

### Funcionamiento
Al iniciar FastAPI (`@app.on_event("startup")`), se lanza un **background loop** (`asyncio`) que:
1. Se despierta cada **60 segundos**
2. Si la hora actual es ≥ 09:00, busca tareas pendientes de todos los usuarios
3. Para cada usuario con tareas vencidas (fecha ≤ hoy), agrupa las tareas por `correo_notificacion`
4. Consulta la configuración SMTP del usuario (`smtp_config` en `app_data`)
5. Envía un **email HTML consolidado** con todas las tareas pendientes
6. Marca cada tarea como `notificado: true` para no reenviarla

### Configuración SMTP
Se guarda en `app_data` con `module_name = "smtp_config"`:
```json
{
  "host": "smtp.gmail.com",
  "port": 587,
  "username": "correo@empresa.com",
  "password": "contraseña_app",
  "use_tls": true,
  "sender_name": "Plataforma BEX",
  "sender_email": "correo@empresa.com"
}
```

---

## 10. Estructura de Archivos del Proyecto

### Plataforma Web (`C:\Users\jcorozo\Desktop\Plataforma_Herramientas_Web\`)
```
Plataforma_Herramientas_Web/
├── Iniciar_Web.bat              ← Script de inicio (lanza backend + frontend)
├── Sincronizar_a_la_Nube.bat    ← Sube datos locales a Neon PostgreSQL
├── Sincronizar_de_la_Nube_a_Local.bat ← Baja datos de Neon a SQLite local
├── MATRIZ_CURSOS_BEX.xlsx       ← Mapeo Perfil → Cursos (para Generador)
├── .git/                        ← Repositorio: https://github.com/JoaoCorozo/HerramientasMAS.git
│
├── backend/
│   ├── main.py                  ← Todos los endpoints FastAPI (854 líneas)
│   ├── models.py                ← Modelos SQLAlchemy (User, AppData)
│   ├── database.py              ← Config de BD (SQLite local ó PostgreSQL Neon)
│   ├── auth.py                  ← JWT + bcrypt
│   ├── requirements.txt         ← Dependencias Python
│   ├── users.db                 ← Base de datos SQLite local
│   ├── sync_to_cloud.py         ← Script de sincronización → Neon
│   ├── sync_from_cloud.py       ← Script de sincronización ← Neon
│   └── migrate_joao.py          ← Script de migración inicial
│
└── frontend/
    ├── package.json             ← Dependencias Node.js
    ├── next.config.mjs          ← Config Next.js (ignoreBuildErrors: true)
    ├── app/
    │   ├── globals.css          ← Variables CSS, temas, 8 paletas de color
    │   ├── layout.tsx           ← Root layout: ThemeProvider, AuthProvider, inline script
    │   ├── page.tsx             ← Módulo Comparador de Datos (ruta /)
    │   ├── generador/page.tsx   ← Módulo Generador de Cargas (ruta /generador)
    │   ├── rut/page.tsx         ← Módulo Normalizador RUT
    │   ├── textos/page.tsx      ← Módulo Normalizador Textos
    │   ├── capacitaciones/      ← Módulo Capacitaciones
    │   ├── enlaces/             ← Módulo Enlaces de Interés
    │   ├── recordatorios/       ← Módulo Calendario & Tareas
    │   ├── login/               ← Página de login
    │   └── admin/usuarios/      ← Panel de administración de usuarios
    └── components/
        ├── app-sidebar.tsx      ← Barra lateral: nav, selector de paleta, tema
        ├── theme-provider.tsx   ← Provider propio de temas (NO usa next-themes)
        ├── auth-provider.tsx    ← Context de autenticación JWT
        ├── file-upload-card.tsx ← Componente de subida de archivos
        ├── results-panel.tsx    ← Panel de resultados del comparador
        └── ui/                  ← Componentes shadcn/ui (Button, Input, etc.)
```

### App Desktop (`C:\Users\jcorozo\Desktop\Scripts\Herramientas_App\`)
```
Herramientas_App/
├── Iniciar_Herramientas.bat     ← Lanza: pyw main_herramientas.py
├── main_herramientas.py         ← App principal CustomTkinter (509 líneas)
├── modulo_comparador.py         ← Módulo comparador de datos
├── modulo_capacitaciones.py     ← Módulo capacitaciones
├── modulo_enlaces.py            ← Módulo enlaces
├── modulo_recordatorios.py      ← Módulo recordatorios (más complejo, 48KB)
├── theme_config.json            ← Config de tema guardada localmente
├── capacitaciones_db.json       ← BD local de capacitaciones
└── requirements.txt             ← customtkinter, openpyxl, etc.
```

---

## 11. Módulos de la Plataforma

| Módulo | Ruta Web | Descripción |
|--------|----------|-------------|
| **Comparador de Datos** | `/` | Compara 2 archivos Excel. Configura rangos de columnas/filas. Genera reporte de diferencias y/o coincidencias |
| **Normalizador RUT** | `/rut` | Normaliza RUTs chilenos en 3 formatos: con puntos y guión, sin puntos con guión, sin puntos sin guión |
| **Normalizador Textos** | `/textos` | Convierte texto a mayúsculas, minúsculas o título |
| **Capacitaciones** | `/capacitaciones` | CRUD de capacitaciones del equipo. Persistencia en BD por usuario |
| **Enlaces de Interés** | `/enlaces` | CRUD de enlaces útiles. Persistencia en BD por usuario |
| **Calendario & Tareas** | `/recordatorios` | Gestión de tareas con fechas. Envío automático de recordatorios por email a las 9:00 AM |
| **Generador de Cargas** | `/generador` | Wizard de 4 pasos para generar CSVs de inducción Moodle a partir de Excel de dotación |
| **Admin Usuarios** | `/admin/usuarios` | Solo superadmin. CRUD completo de usuarios con permisos granulares |

---

## 12. Repositorio GitHub

- **URL**: `https://github.com/JoaoCorozo/HerramientasMAS.git`
- **Rama principal**: `main`
- **Scripts de sincronización**:
  - `Sincronizar_a_la_Nube.bat` → Ejecuta `backend/sync_to_cloud.py`
  - `Sincronizar_de_la_Nube_a_Local.bat` → Ejecuta `backend/sync_from_cloud.py`

### Commits recientes relevantes
```
feat: add 8-palette color selector with persistent storage in sidebar
fix: replace next-themes with custom provider to fix React 19 script tag warning
fix: simplify Iniciar_Web.bat to minimal reliable batch script
feat: dynamic theme switching on web and optimized startup script
feat: Generador de Cargas - wizard completo con preview de 10 filas
```

---

## 13. Variables de Entorno y Configuración

### Backend
| Variable | Valor local | Descripción |
|----------|-------------|-------------|
| `DATABASE_URL` | `sqlite:///./users.db` | Seteada en `Iniciar_Web.bat` para uso local |
| Sin variable | PostgreSQL Neon (hardcoded en `database.py`) | Para producción/nube |

### Frontend
| Variable | Valor | Descripción |
|----------|-------|-------------|
| `NEXT_PUBLIC_API_URL` | No definida (usa default) | Si no existe, usa `http://127.0.0.1:8000` |

### Seguridad (⚠️ Cambiar en producción)
- **JWT Secret**: `"super_secret_key_change_in_production"` (en `auth.py` línea 6)
- **Admin default**: `admin` / `admin123`

---

## 14. Problemas Conocidos y Soluciones Aplicadas

| Problema | Causa | Solución |
|----------|-------|----------|
| `next-themes` error de script tag | React 19 no permite `<script>` en componentes | Reemplazado por provider propio en `theme-provider.tsx` |
| `Iniciar_Web.bat` se cerraba | Sintaxis `===` inválida en batch Windows | Reescrito con sintaxis `==` estándar |
| TypeScript error en `ResultsPanel` | Prop `status` recibía `"error"/"success"` en vez de `"waiting"/"complete"` | Mapeado en `page.tsx` antes de pasar |
| FOUC (parpadeo de tema) | El tema se aplica después del primer render | Script inline en `<head>` con `dangerouslySetInnerHTML` |
| Error 404 en `/api/excel/generar-carga` | Ruta no existía | Implementado endpoint completo en `main.py` |

---

## 15. Notas para la IA Receptora

### Contexto del desarrollador
- El desarrollador principal es **Joao Coronzo** (usuario: `jcorozo`)
- El sistema es para uso interno en la empresa **BEX** (Chile)
- El idioma de la aplicación es **español**
- Se usa **Python `py`** (no `python3`) como comando en Windows

### Convenciones del código
- Todos los textos de UI en **español**
- El comparador usa comparación **case-insensitive** (normaliza a lowercase)
- Los CSVs generados usan **punto y coma (;)** como separador (estándar Excel español)
- Los archivos temp se crean en `tempfile.mkdtemp()` y se limpian con `shutil.rmtree()`

### Archivos críticos que NO deben modificarse sin cuidado
1. `backend/database.py` — Contiene credenciales de Neon PostgreSQL
2. `MATRIZ_CURSOS_BEX.xlsx` — Determina los cursos por perfil (debe estar en raíz del proyecto)
3. `backend/users.db` — BD local con usuarios y datos
4. `backend/auth.py` — El SECRET_KEY debe cambiarse en producción

### Cómo probar localmente
1. Cierra todas las terminales CMD con título "Backend" o "Frontend"
2. Doble clic en `Iniciar_Web.bat`
3. Espera que abra el navegador
4. Login con `admin` / `admin123`
5. Hacer `Ctrl+F5` si se ve versión antigua (limpia caché)

---

*Fin del documento de traspaso — Generado el 22/05/2026*
