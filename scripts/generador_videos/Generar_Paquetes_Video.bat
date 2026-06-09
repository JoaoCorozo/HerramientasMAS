@echo off
cd /d "%~dp0"
python generador_videos.py
if errorlevel 1 pause
