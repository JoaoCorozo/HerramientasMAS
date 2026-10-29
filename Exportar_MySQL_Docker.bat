@echo off
setlocal EnableDelayedExpansion
cd /d "%~dp0"

if not exist ".env" (
  echo [ERROR] No existe .env en la raiz.
  pause
  exit /b 1
)

for /f "usebackq tokens=1,* delims==" %%A in (`.env`) do (
  set "k=%%A"
  set "v=%%B"
  if /i "!k!"=="MYSQL_ROOT_PASSWORD" set "MYSQL_ROOT_PASSWORD=!v!"
  if /i "!k!"=="MYSQL_DATABASE" set "MYSQL_DATABASE=!v!"
)

if "%MYSQL_ROOT_PASSWORD%"=="" (
  echo [ERROR] MYSQL_ROOT_PASSWORD no definido en .env
  pause
  exit /b 1
)
if "%MYSQL_DATABASE%"=="" set "MYSQL_DATABASE=herramientas"

set "OUT=respaldo_herramientas_%DATE:~-4%%DATE:~3,2%%DATE:~0,2%_%TIME:~0,2%%TIME:~3,2%.sql"
set "OUT=%OUT: =0%"

echo Exportando BD Docker a %OUT% ...
docker compose exec -T db mysqldump -u root -p"%MYSQL_ROOT_PASSWORD%" --databases %MYSQL_DATABASE% --single-transaction --routines --triggers > "%OUT%"
if errorlevel 1 (
  echo Fallo el dump.
  pause
  exit /b 1
)

echo.
echo Listo: %OUT%
echo Este archivo NO debe subirse a GitHub. Transfierelo por canal seguro a TI / el servidor.
pause
