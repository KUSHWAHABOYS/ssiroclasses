@echo off
title Smart Studio Presenter Pro - Launcher
echo ========================================================
echo     Smart Studio Presenter Pro (Decoding Indology)
echo ========================================================
echo.
echo Starting Smart Studio App in Desktop Mode...
echo.

cd /d "%~dp0"

:: Start the background local server if not already running
netstat -ano | findstr :5173 >nul
if %errorlevel% neq 0 (
    echo Starting local high-performance offline server...
    start /min "Smart Studio Server" npm run preview -- --port 5173 --host
    timeout /t 2 /nobreak >nul
)

:: Launch in native App Window mode (no browser tabs/bars)
where msedge >nul 2>&1
if %errorlevel% equ 0 (
    start msedge --app=http://localhost:5173/ --start-maximized
    exit /b
)

where chrome >nul 2>&1
if %errorlevel% equ 0 (
    start chrome --app=http://localhost:5173/ --start-maximized
    exit /b
)

:: Fallback to default browser
start http://localhost:5173/
exit /b
