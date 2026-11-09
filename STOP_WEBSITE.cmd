@echo off
cd /d "%~dp0Website"
"runtime\python.exe" launch.py --stop
if errorlevel 1 pause
