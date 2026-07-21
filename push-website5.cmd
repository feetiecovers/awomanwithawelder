@echo off
setlocal

powershell.exe -ExecutionPolicy Bypass -NoProfile -File "%~dp0push-website5.ps1" %*

endlocal
