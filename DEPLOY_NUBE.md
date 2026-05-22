# Despliegue en la nube (Vercel + Render + Neon)

Arquitectura recomendada (la misma lógica que en local, con datos en PostgreSQL):

| Componente | Servicio | Rol |
|------------|----------|-----|
| Frontend | **Vercel** | Next.js, proxy `/api` → backend |
| Backend | **Render** (Docker) | FastAPI siempre activo + recordatorios 9:00 |
| Base de datos | **Neon** | PostgreSQL (`DATABASE_URL`) |

## 1. Base de datos (Neon)

1. Crea o usa tu proyecto en [Neon](https://neon.tech).
2. Copia la connection string (`postgresql://...?sslmode=require`).
3. **Rota la contraseña** si alguna vez estuvo en el repositorio.

## 2. Backend en Render

1. Conecta el repo `HerramientasMAS` en [Render](https://render.com).
2. Crea **Web Service** → **Deploy from Git** → usa el `Dockerfile` de la raíz (o importa `render.yaml`).
3. Variables de entorno obligatorias:

| Variable | Ejemplo / notas |
|----------|-----------------|
| `APP_ENV` | `production` |
| `DATABASE_URL` | Connection string de Neon |
| `JWT_SECRET_KEY` | Clave larga aleatoria (Render puede generarla) |
| `APP_ENCRYPTION_KEY` | Otra clave larga (cifrado SMTP) |
| `CORS_ORIGINS` | `https://tu-app.vercel.app` |
| `PUBLIC_FRONTEND_URL` | `https://tu-app.vercel.app` (se añade a CORS) |
| `MATRIZ_CURSOS_PATH` | `/app/MATRIZ_CURSOS_BEX.xlsx` (ya va en la imagen Docker) |

4. **No** uses `BOOTSTRAP_ADMIN_PASSWORD` en producción. Crea el admin con sync desde local o panel tras primer login.
5. Comprueba: `https://tu-api.onrender.com/api/health` → `"status":"ok"` y `"matriz_cursos":true`.

### Recordatorios por correo

El envío a las 9:00 requiere que el proceso **no se apague**. En Render, plan **Starter** (o superior) evita que el servicio duerma. En plan free el worker puede detenerse.

## 3. Frontend en Vercel

1. Importa el repo; **Root Directory** = `frontend`.
2. Variables:

| Variable | Valor |
|----------|--------|
| `BACKEND_URL` | `https://tu-api.onrender.com` (sin barra final) |
| `NEXT_PUBLIC_API_URL` | *(dejar vacío)* |

3. Deploy. La app usará `https://tu-app.vercel.app/api/...` vía proxy (cookies HttpOnly en el mismo dominio).

4. Tras el deploy, abre la URL y prueba login.

## 4. Sincronizar datos local → nube

En `backend/.env` (no subir a git):

```env
POSTGRES_DATABASE_URL=postgresql://...@neon.tech/neondb?sslmode=require
```

Ejecuta `Sincronizar_a_la_Nube.bat` o:

```bash
cd backend
py sync_to_cloud.py
```

Para bajar de la nube a tu PC: `Sincronizar_de_la_Nube_a_Local.bat`.

## 5. Excels grandes (> ~4 MB en Vercel)

El proxy de Vercel limita el tamaño del body. Si fallan comparador/generador:

1. En **Vercel**: `NEXT_PUBLIC_API_URL=https://tu-api.onrender.com`
2. En **Render**: `CROSS_SITE_AUTH=true` y `CORS_ORIGINS=https://tu-app.vercel.app`

Así el navegador llama al API directo con cookies cross-site (`SameSite=None; Secure`).

## 6. Checklist post-deploy

- [ ] `/api/health` OK en Render
- [ ] Login en Vercel
- [ ] Permiso `generador` en usuarios que lo necesiten
- [ ] Cambiar contraseña de `admin`
- [ ] Probar generador con un Excel de dotación
- [ ] SMTP de recordatorios guardado (contraseña cifrada en BD)

## 7. Local sigue igual

`Iniciar_Web.bat` usa SQLite y variables de desarrollo; no afecta la nube.
