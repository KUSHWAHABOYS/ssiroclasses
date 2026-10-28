@echo off
chcp 65001 >nul
title Stop Smart Studio Server
color 0C
cls

echo ====================================================================
echo             STOP SMART STUDIO PRESENTER PRO SERVER
echo ====================================================================
echo.
echo Stopping local server on port 5173...

for /f "tokens=5" %%a in ('netstat -ano ^| findstr :5173') do (
    taskkill /PID %%a /F >nul 2>&1
)

echo.
echo [✓] Smart Studio Server stopped.
echo.
pause
