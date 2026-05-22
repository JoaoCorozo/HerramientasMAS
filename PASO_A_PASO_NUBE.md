# Opción C — Paso a paso (en tu PC)

## Paso 1 — Conectar Neon en `backend/.env` ← ESTÁS AQUÍ

1. Abre [Neon](https://console.neon.tech) → tu proyecto → **Connection string**.
2. En la carpeta `backend`, copia `.env.example` y renómbralo a **`.env`**.
3. Pega la URL en:
   ```env
   POSTGRES_DATABASE_URL=postgresql://....?sslmode=require
   ```
4. Guarda el archivo.
5. En terminal:
   ```powershell
   cd C:\Users\jcorozo\Desktop\Plataforma_Herramientas_Web\backend
   py scripts\generate_deploy_vars.py
   ```
6. Se creará `deploy-vars.local.txt` en la raíz (para copiar a Render/Vercel más adelante).

**Cuando termines, dime:** `Paso 1 listo`

---

## Paso 2 — Subir datos locales a Neon

- Ejecutar `Sincronizar_a_la_Nube.bat` o `py sync_to_cloud.py` desde `backend`.

**Dime:** `Paso 2 listo` o pega el error.

---

## Paso 3 — Subir código a GitHub

- Commit + push de los cambios (Dockerfile, seguridad, deploy).

**Dime:** `Paso 3 listo`

---

## Paso 4 — Crear backend en Render

- Usar `deploy-vars.local.txt` → bloque RENDER.
- Deploy Docker, probar `/api/health`.

**Dime:** URL de Render (ej. `https://xxx.onrender.com`)

---

## Paso 5 — Crear frontend en Vercel

- Root: `frontend`, variables del bloque VERCEL.
- Actualizar CORS en Render con la URL de Vercel.

**Dime:** URL de Vercel

---

## Paso 6 — Probar login en la nube
