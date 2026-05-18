@echo off
title Sincronizador de Herramientas Web
echo ==================================================
echo   Sincronizando Base de Datos Local a la Nube
echo ==================================================
echo.
cd backend
py sync_to_cloud.py
echo.
echo Presiona cualquier tecla para cerrar esta ventana...
pause >nul
