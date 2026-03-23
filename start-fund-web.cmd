@echo off
setlocal

set "ROOT=%~dp0"
set "URL=http://127.0.0.1:8765/"

netstat -ano | findstr ":8765" >nul
if errorlevel 1 (
  start "Fund Web Server" /min cmd /c "cd /d ""%ROOT%"" && python scripts\fund_web_server.py > fund-web-server.log 2>&1"
  timeout /t 2 /nobreak >nul
)

start "" "%URL%"
exit /b 0
