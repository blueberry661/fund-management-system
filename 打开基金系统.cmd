@echo off
setlocal

set "EDGE_1=C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
set "EDGE_2=C:\Program Files\Microsoft\Edge\Application\msedge.exe"
set "EXT_DIR=C:\Users\Lang\Desktop\Fund Management System\dist"
set "PROFILE_DIR=C:\Users\Lang\.edge-profile-funds"
set "EDGE_EXE="

if not exist "%EXT_DIR%\manifest.json" (
  echo [ERROR] extension dir not found: %EXT_DIR%
  pause
  exit /b 1
)

if not exist "%PROFILE_DIR%" mkdir "%PROFILE_DIR%"

if exist "%EDGE_1%" set "EDGE_EXE=%EDGE_1%"
if not defined EDGE_EXE if exist "%EDGE_2%" set "EDGE_EXE=%EDGE_2%"

if not defined EDGE_EXE (
  echo [ERROR] Microsoft Edge not found
  pause
  exit /b 1
)

start "" "%EDGE_EXE%" --user-data-dir="%PROFILE_DIR%" --load-extension="%EXT_DIR%" --new-window edge://extensions/
exit /b 0
