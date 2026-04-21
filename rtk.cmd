@echo off
setlocal
set PS_SCRIPT=%~dp0rtk.ps1
powershell -NoProfile -ExecutionPolicy Bypass -File "%PS_SCRIPT%" %*
exit /b %ERRORLEVEL%

