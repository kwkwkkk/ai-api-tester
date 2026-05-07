@echo off
setlocal
cd /d %~dp0

echo [AI API Tester] Checking dependencies...
if not exist node_modules (
  echo [AI API Tester] Installing dependencies...
  call npm install
  if errorlevel 1 (
    echo.
    echo npm install failed.
    pause
    exit /b 1
  )
)

echo.
echo [AI API Tester] Starting server...
echo Open http://localhost:3210 in your browser
echo.
call npm start
