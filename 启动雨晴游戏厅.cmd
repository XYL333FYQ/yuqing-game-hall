@echo off
setlocal EnableExtensions
cd /d "%~dp0"

title Yuqing Game Hall
set "GAME_HOST=127.0.0.1"

where node >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Node.js was not found. Install Node.js 20 or newer.
  pause
  exit /b 1
)

where corepack >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Corepack was not found. Reinstall Node.js or run: corepack enable
  pause
  exit /b 1
)

set "GAME_PORT="
for /f "delims=" %%P in ('node "%~dp0scripts\find-open-port.mjs" 5173 5299') do set "GAME_PORT=%%P"
if not defined GAME_PORT (
  echo [ERROR] No free port was found between 5173 and 5299.
  pause
  exit /b 1
)
set "GAME_URL=http://%GAME_HOST%:%GAME_PORT%/"

cls
echo ============================================================
echo                    YUQING GAME HALL
echo ============================================================
echo.
echo  OPEN URL : %GAME_URL%
echo  STOP     : Close this window or press Ctrl+C.
echo.
echo  One hall includes Fruit Party and every integrated game.
echo  The browser will open automatically when ready.
echo ------------------------------------------------------------
echo.

if not exist "node_modules\" (
  echo [FIRST RUN] Installing dependencies. Please wait...
  call corepack pnpm install --frozen-lockfile
  if errorlevel 1 (
    echo [ERROR] Dependency installation failed.
    pause
    exit /b 1
  )
)

if /i not "%NO_OPEN%"=="1" start "" /b node "%~dp0scripts\open-when-ready.mjs" "%GAME_URL%" 120000

call corepack pnpm run prepare-assets
if errorlevel 1 (
  echo [ERROR] Local asset preparation failed.
  pause
  exit /b 1
)

echo READY URL: %GAME_URL%
echo ============================================================
call npm run dev:launcher -- --port %GAME_PORT% --strictPort
set "GAME_EXIT=%ERRORLEVEL%"

echo.
if not "%GAME_EXIT%"=="0" echo [ERROR] The game hall stopped with exit code %GAME_EXIT%.
if /i not "%NO_PAUSE%"=="1" pause
exit /b %GAME_EXIT%
