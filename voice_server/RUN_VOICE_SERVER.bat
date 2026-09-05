@echo off
cd /d "%~dp0"
title JORDAN CORE V0.11 - Voice V2 + Autonomous Agent
if not exist ".venv\Scripts\activate.bat" (
  echo Ambiente Python nao encontrado. Execute SETUP_WINDOWS.bat primeiro.
  pause
  exit /b 1
)
call .venv\Scripts\activate
if not exist ".env" (
  echo [AVISO] .env nao encontrado.
  echo [AVISO] A Spark V2 tentara o nucleo local, mas o cerebro autonomo ficara indisponivel.
  echo [AVISO] Execute CONFIGURE_AGENT_CORE.bat para ativar o Agent Core e a voz neural cloud.
  echo.
) else (
  echo [OK] Configuracao privada encontrada.
  echo [INFO] Iniciando JORDAN Spark V2 + Agent Core...
  echo.
)
python -m uvicorn server.app:app --host 0.0.0.0 --port 8787
pause
