@echo off
setlocal enabledelayedexpansion

echo ===================================================
echo   Iniciando Plataforma Web (Herramientas)
echo ===================================================
echo.

set INSTALL_DEPS=0
if "%1"=="/install" set INSTALL_DEPS=1
if "%1"=="--install" set INSTALL_DEPS=1

if "!INSTALL_DEPS!"=="1" (
    echo [1/3] Instalando dependencias del Backend...
    py -m pip install -r backend/requirements.txt
) else (
    echo [1/3] Omitiendo instalacion de dependencias de Python (usa "Iniciar_Web.bat /install" para forzar).
)

echo [2/3] Iniciando Backend (FastAPI)...
start "Backend (FastAPI)" cmd /k "cd backend && set DATABASE_URL=sqlite:///./users.db && py -m uvicorn main:app --reload --port 8000"

if not exist "frontend\node_modules\" (
    echo.
    echo [3/3] frontend\node_modules no encontrado. Instalando dependencias del Frontend...
    cd frontend && call npm install && cd ..
) else (
    if "!INSTALL_DEPS!"=="1" (
        echo.
        echo [3/3] Forzando instalacion de dependencias del Frontend...
        cd frontend && call npm install && cd ..
    ) else (
        echo [3/3] Dependencias del Frontend ya instaladas.
    )
)

echo.
echo Iniciando Frontend (Next.js dev)...
start "Frontend (Next.js)" cmd /k "cd frontend && npm run dev"

echo.
echo ===================================================
echo   Servidores iniciados en segundo plano.
echo   Esperando 5 segundos para abrir el navegador...
echo ===================================================
timeout /t 5 /nobreak >nul

echo.
echo Abriendo navegador en http://localhost:3000
start http://localhost:3000
echo.
echo ===================================================
echo   ¡Listo! Si ves una pagina en blanco o desactualizada,
echo   por favor realiza una recarga forzada en tu navegador:
echo   Presiona CTRL + F5 (o CMD + SHIFT + R en Mac)
echo ===================================================
echo.
echo Puedes minimizar esta ventana.


