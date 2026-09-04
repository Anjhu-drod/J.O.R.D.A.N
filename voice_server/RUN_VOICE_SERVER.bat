@echo off
cd /d "%~dp0"
title JORDAN CORE - Voice + Autonomous Agent
if not exist ".venv\Scripts\activate.bat" (
  echo Ambiente Python nao encontrado. Execute SETUP_WINDOWS.bat primeiro.
  pause
  exit /b 1
)
call .venv\Scripts\activate
if not exist ".env" (
  echo [INFO] Agent Core sem .env. A voz funcionara normalmente, mas o cerebro autonomo usara fallback local.
  echo [INFO] Para ativar: execute CONFIGURE_AGENT_CORE.bat.
  echo.
)
python -m uvicorn server.app:app --host 0.0.0.0 --port 8787
pause
