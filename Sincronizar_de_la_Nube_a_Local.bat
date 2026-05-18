@echo off
title Descargar Datos de la Nube a Local
echo ==================================================
echo   Sincronizando Datos de la Nube a tu PC Local
echo ==================================================
echo.
cd backend
py sync_from_cloud.py
echo.
echo Presiona cualquier tecla para cerrar esta ventana...
pause >nul
