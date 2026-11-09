@echo off
rem Builds Kairos for a physical iPhone from Windows via EAS (cloud).
rem Every step that needs a password (Expo, Apple) asks you in this window;
rem the rest runs on its own. .cmd instead of .ps1 so PowerShell's script
rem policy doesn't block npx.

cd /d "%~dp0.."

echo.
echo === 1/4  Expo: inicia sesion con tu cuenta ===
call npx.cmd --yes eas-cli whoami >nul 2>&1 || call npx.cmd --yes eas-cli login || goto :fail

echo.
echo === 2/4  Vincular el proyecto a tu cuenta de Expo ===
call npx.cmd --yes eas-cli init --non-interactive --force || goto :fail

echo.
echo === 3/4  Registrar tu iPhone (abre el enlace o QR en el iPhone) ===
call npx.cmd --yes eas-cli device:create || goto :fail

echo.
echo === 4/4  Build de iOS (preview: app completa, sin Metro) ===
echo Si es la primera vez, te pedira tu Apple ID para los certificados.
call npx.cmd --yes eas-cli build --platform ios --profile preview || goto :fail

echo.
echo Listo: abre en el iPhone el enlace de instalacion que aparece arriba.
pause
exit /b 0

:fail
echo.
echo Algo fallo en el paso anterior. Copia el error y pasaselo a Claude.
pause
exit /b 1
