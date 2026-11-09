@echo off
cd /d "%~dp0"
where py >nul 2>nul
if %errorlevel% equ 0 (
  py -3 Start-CodeLab.py
) else (
  python Start-CodeLab.py
)
if errorlevel 1 pause
