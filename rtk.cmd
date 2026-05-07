@echo off
setlocal enabledelayedexpansion

rem Minimal RTK shim for this repo.
rem Passes through all arguments to the underlying command unchanged.
rem Usage: rtk <command> [args...]

if "%~1"=="" (
  echo Usage: rtk ^<command^> [args...]
  exit /b 1
)

%*

