@echo off
setlocal
cd /d "%~dp0"

if not exist "backend\users.db" (
  echo [ERROR] No existe backend\users.db
  pause
  exit /b 1
)

if not exist ".env" (
  echo [ERROR] No existe .env en la raiz. Copia .env.docker.example a .env primero.
  pause
  exit /b 1
)

echo Leyendo MYSQL_* desde .env y sincronizando SQLite -^> MySQL Docker...
cd backend
py sync_sqlite_to_mysql.py
if errorlevel 1 (
  echo Fallo la sincronizacion.
  pause
  exit /b 1
)

cd ..
echo Reiniciando backend Docker...
docker compose restart backend
echo.
echo Listo. Abre http://localhost:3001 e inicia sesion con tus usuarios locales.
pause
