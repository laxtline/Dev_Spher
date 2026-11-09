@echo off
cd /d "%~dp0"
if exist "runtime\python.exe" (
  "runtime\python.exe" merge_packs.py
) else (
  python merge_packs.py
)
pause
