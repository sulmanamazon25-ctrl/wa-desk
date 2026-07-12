@echo off
setlocal EnableExtensions
title WhatsApp AI Desktop

REM Always run from this folder (fixes: staying on C: after "cd D:\...")
cd /d "%~dp0"

if not exist "package.json" (
  echo ERROR: package.json not found.
  echo This file must stay inside: D:\whatsapp-ai-desktop
  pause
  exit /b 1
)

REM First-time: create .env from template (copy command is safe to repeat)
if not exist ".env" (
  if exist ".env.example" (
    copy /y ".env.example" ".env" >nul
    echo Created .env from .env.example — add your API keys inside .env
    echo.
  ) else (
    echo WARNING: .env.example missing. Create .env manually.
    echo.
  )
)

where npm >nul 2>nul
if errorlevel 1 (
  echo ERROR: npm not found in PATH.
  echo Install Node.js LTS and reopen this window.
  pause
  exit /b 1
)

echo Starting WhatsApp AI Desktop...
echo Project: %CD%
echo.

call npm run dev
set "EXITCODE=%ERRORLEVEL%"
echo.
if not "%EXITCODE%"=="0" (
  echo App exited with error code %EXITCODE%.
) else (
  echo App closed.
)
pause
endlocal & exit /b %EXITCODE%
