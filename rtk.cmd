@echo off
setlocal
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0rtk.ps1" %*
exit /b %errorlevel%

