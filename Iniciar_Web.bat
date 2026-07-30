@echo off
title Plataforma Herramientas BEX
cd /d "%~dp0"

if not exist "logs" mkdir "logs"

echo ===================================================
echo   Plataforma Web (Herramientas) - una sola ventana
echo ===================================================
echo.

echo [1/4] Dependencias del backend...
pushd backend
py -m pip install -q -r requirements.txt
if errorlevel 1 (
  echo ERROR: no se pudieron instalar las dependencias de Python.
  pause
  exit /b 1
)
popd

echo [2/4] Arrancando Backend y Frontend en segundo plano...
echo      Compresor MP4 = motor Python dentro del backend (necesita ffmpeg).
echo      Logs en carpeta logs\
echo.

start /b "Backend" cmd /c "cd /d %~dp0backend && set DATABASE_URL=sqlite:///./users.db && set APP_ENV=development && set JWT_SECRET_KEY=dev-local-cambiar-en-produccion && set BOOTSTRAP_ADMIN_PASSWORD=admin123 && set CORS_ORIGINS=http://localhost:3000,http://127.0.0.1:3000 && py -m uvicorn main:app --reload --port 8000 > %~dp0logs\backend.log 2>&1"
start /b "Frontend" cmd /c "cd /d %~dp0frontend && npm run dev > %~dp0logs\frontend.log 2>&1"

echo [3/4] Esperando 8 segundos a que arranquen...
timeout /t 8 /nobreak >nul

echo [4/4] Abriendo navegador...
start http://localhost:3000

echo.
echo ===================================================
echo  Listo. Deja ESTA ventana abierta mientras uses la app.
echo.
echo  Frontend:  http://localhost:3000
echo  Backend:   http://127.0.0.1:8000
echo.
echo  Logs:
echo    logs\backend.log
echo    logs\frontend.log
echo.
echo  Compresor: FFmpeg en PATH o en
echo    compresor_video\bin\ffmpeg.exe
echo.
echo  Presiona una tecla para DETENER los servidores y salir.
echo ===================================================
echo.
pause >nul

echo.
echo Deteniendo servidores...
call :kill_port 8000
call :kill_port 3000

echo Listo.
timeout /t 2 /nobreak >nul
exit /b 0

:kill_port
set "PORT=%~1"
for /f "tokens=5" %%a in ('netstat -ano 2^>nul ^| findstr /R /C:":%PORT% .*LISTENING"') do (
  taskkill /F /PID %%a /T >nul 2>&1
)
exit /b 0
