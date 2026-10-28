@echo off
chcp 65001 >nul
title Smart Studio Presenter Pro - SSIRO Classes
color 0B
cls

echo ====================================================================
echo           SMART STUDIO PRESENTER PRO (SSIRO CLASSES)
echo ====================================================================
echo.
echo   Local PC App Mode:
echo   URL: http://localhost:5173/
echo.
:: WELCOME-CLEANUP: Removed Android Board & Mobile Connect banner instructions
echo ====================================================================
echo.
echo Starting Smart Studio App in Desktop Mode...

cd /d "%~dp0"

:: Check if server is already running on port 5173
netstat -ano | findstr :5173 >nul
if %errorlevel% neq 0 (
    echo [i] Starting high-performance offline server in background...
    start /min "Smart Studio Server" cmd /c "npx vite preview --port 5173 --host"
    timeout /t 2 /nobreak >nul
) else (
    echo [✓] Offline server is already running on port 5173.
)

:: Launch in native App Window mode (no browser address bar/tabs)
where msedge >nul 2>&1
if %errorlevel% equ 0 (
    echo [✓] Launching Native App via Microsoft Edge...
    start msedge --app=http://localhost:5173/ --start-maximized
    exit /b
)

where chrome >nul 2>&1
if %errorlevel% equ 0 (
    echo [✓] Launching Native App via Google Chrome...
    start chrome --app=http://localhost:5173/ --start-maximized
    exit /b
)

:: Fallback to default browser
start http://localhost:5173/
exit /b
