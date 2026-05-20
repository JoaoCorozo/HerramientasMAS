@echo off
echo ===================================================
echo   Iniciando Plataforma Web (Herramientas)
echo ===================================================
echo.

echo Iniciando Backend (FastAPI)...
start "Backend (FastAPI)" cmd /k "cd /d %~dp0backend && set DATABASE_URL=sqlite:///./users.db && py -m uvicorn main:app --reload --port 8000"

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
echo ===================================================
echo.
pause
