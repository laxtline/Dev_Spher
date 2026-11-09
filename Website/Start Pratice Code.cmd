@echo off
cd /d "%~dp0"
if exist "Pratice Code.exe" (
  start "" "%~dp0Pratice Code.exe"
  exit /b
)
if exist "runtime\python.exe" (
  "runtime\python.exe" launch.py
) else (
  python launch.py
)
if errorlevel 1 pause
