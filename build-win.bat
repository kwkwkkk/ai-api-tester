@echo off
setlocal
cd /d %~dp0

echo [AI API Tester Electron] Installing dependencies...
set NODE_OPTIONS=--use-system-ca
set ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/
call npm install
if errorlevel 1 (
  echo.
  echo npm install failed.
  pause
  exit /b 1
)

echo.
echo [AI API Tester Electron] Building Windows portable app...
call npm run dist:win

if errorlevel 1 (
  echo.
  echo Build failed.
  pause
  exit /b 1
)

echo.
echo Build completed. Check the dist folder.
pause
