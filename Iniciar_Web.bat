@echo off
echo Iniciando Plataforma Web (Herramientas)...

echo.
echo Iniciando Backend (FastAPI)...
start "Backend" cmd /k "cd backend && py -m uvicorn main:app --reload --port 8000"

echo.
echo Iniciando Frontend (Next.js)...
start "Frontend" cmd /c "cd frontend && npm run dev"

echo.
echo Esperando a que los servidores inicien...
timeout /t 5 /nobreak >nul

echo Abriendo navegador en http://localhost:3000
start http://localhost:3000

echo Proceso completado. Puedes minimizar esta ventana.
