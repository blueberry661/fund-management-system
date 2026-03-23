@echo off
setlocal

set "ROOT=%~dp0"

where python >nul 2>&1
if errorlevel 1 (
  echo [ERROR] Python not found. Please install Python 3 first.
  pause
  exit /b 1
)

powershell -NoProfile -ExecutionPolicy Bypass -File "%ROOT%scripts\start_fund_web.ps1"
exit /b 0
