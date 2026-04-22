@echo off
setlocal

REM Minimal RTK shim for this repo.
REM Passes through to PowerShell so aliases like `ls` work in this environment.

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0rtk.ps1" %*

