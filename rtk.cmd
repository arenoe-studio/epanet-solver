@echo off
rem Minimal RTK shim for environments where RTK isn't installed.
rem Pass-through only: rtk <cmd> [args...]
setlocal
if "%~1"=="" (
  echo Usage: rtk ^<command^> [args...]
  exit /b 1
)
%*
