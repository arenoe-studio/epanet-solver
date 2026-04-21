@echo off
setlocal EnableExtensions

rem Minimal RTK shim for this repo/workspace.
rem Goal: let commands be prefixed with `rtk` as required by AGENTS.md.
rem This shim is a passthrough; it does not implement token filtering.

if "%~1"=="" exit /b 0

if /I "%~1"=="proxy" shift & goto :run_remaining
if /I "%~1"=="test" shift & goto :run_remaining

if /I "%~1"=="read" goto :read_file
if /I "%~1"=="ls" goto :list_dir
if /I "%~1"=="find" goto :find_files
if /I "%~1"=="grep" goto :grep_files

goto :run_full

:run_remaining
%*
exit /b %ERRORLEVEL%

:read_file
shift
if "%~1"=="" exit /b 2
type "%~1"
exit /b %ERRORLEVEL%

:list_dir
shift
if "%~1"=="" (
  cmd /c dir /a
) else (
  cmd /c dir /a "%~1"
)
exit /b %ERRORLEVEL%

:find_files
shift
if "%~1"=="" exit /b 2
cmd /c dir /s /b "*%~1*"
exit /b %ERRORLEVEL%

:grep_files
shift
if "%~1"=="" exit /b 2
where rg >nul 2>&1
if %ERRORLEVEL%==0 (
  rg --no-heading -n %*
) else (
  findstr /n /s %*
)
exit /b %ERRORLEVEL%

:run_full
%*
exit /b %ERRORLEVEL%
