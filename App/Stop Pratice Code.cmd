@echo off
cd /d "%~dp0"
if exist "runtime\python.exe" (
  "runtime\python.exe" launch.py --stop
) else (
  python launch.py --stop
)
if errorlevel 1 pause
