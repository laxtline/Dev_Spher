@echo off
cd /d "%~dp0Website"
"runtime\python.exe" launch.py
if errorlevel 1 pause
