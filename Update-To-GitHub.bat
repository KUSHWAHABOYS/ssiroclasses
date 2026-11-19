@echo off
chcp 65001 >nul
title Smart Studio — GitHub Update Utility
echo ========================================================
echo       Smart Studio Presenter Pro — GitHub Update
echo ========================================================
echo.
cd /d "D:\Smart-Studio-Project"

echo [1/3] प्रोजेक्ट बिल्ड हो रहा है (Building)...
call npm run build
if %errorlevel% neq 0 (
    echo.
    echo [ERROR] बिल्ड में त्रुटि आई। कृपया कोड की जाँच करें।
    pause
    exit /b %errorlevel%
)

echo.
echo [2/3] बदलाव गिट में जोड़े जा रहे हैं...
git add .

set /p COMMIT_MSG="बदलाव का विवरण लिखें (या सिर्फ Enter दबाएँ): "
if "%COMMIT_MSG%"=="" set COMMIT_MSG="Update: %date% %time%"

git commit -m "%COMMIT_MSG%"

echo.
echo [3/3] GitHub पर अपलोड (Push) किया जा रहा है...
git push origin main
if %errorlevel% equ 0 (
    echo.
    echo ========================================================
    echo  [सफल] GitHub पर कोड सफलता से अपडेट हो गया है!
    echo  GitHub Actions 1 मिनट में लाइव वेबसाइट अपडेट कर देगा:
    echo  https://kushwahaboys.github.io/ssiroclasses/
    echo ========================================================
) else (
    echo.
    echo [ERROR] पुश में समस्या आई। इंटरनेट कनेक्शन या लॉगिन जाँचें।
)
echo.
pause
