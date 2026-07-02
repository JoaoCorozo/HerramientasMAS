@echo off
echo ===================================================
echo   Iniciando Plataforma Web (Herramientas)
echo ===================================================
echo.

echo Iniciando Backend (FastAPI)...
start "Backend (FastAPI)" cmd /k "cd /d %~dp0backend && py -m pip install -q -r requirements.txt && set DATABASE_URL=sqlite:///./users.db && set APP_ENV=development && set JWT_SECRET_KEY=dev-local-cambiar-en-produccion && set BOOTSTRAP_ADMIN_PASSWORD=admin123 && set CORS_ORIGINS=http://localhost:3000,http://127.0.0.1:3000 && py -m uvicorn main:app --reload --port 8000"

echo Iniciando Compresor de videos (PowerShell)...
start "Compresor MP4" cmd /k "cd /d %~dp0compresor_video && set COMPRESOR_NO_BROWSER=1 && powershell.exe -NoProfile -ExecutionPolicy Bypass -File server\server.ps1"

echo Iniciando Frontend (Next.js)...
start "Frontend (Next.js)" cmd /k "cd /d %~dp0frontend && npm run dev"

echo.
echo Esperando 6 segundos para que los servidores arranquen...
timeout /t 6 /nobreak >nul

echo Abriendo navegador en http://localhost:3000
start http://localhost:3000

echo.
echo ===================================================
echo Listo. Si la pagina no carga, espera 10 segundos mas
echo y recarga con CTRL+F5.
echo Cambie BOOTSTRAP_ADMIN_PASSWORD y la clave de admin tras el primer acceso.
echo ===================================================
echo.
pause
