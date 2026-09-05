@echo off
cd /d "%~dp0"
title JORDAN V0.12 - Spark V2 Local Voice Core
if not exist ".venv\Scripts\activate.bat" (
  echo Ambiente Python nao encontrado. Execute SETUP_WINDOWS.bat primeiro.
  pause
  exit /b 1
)
call .venv\Scripts\activate
echo [INFO] Iniciando apenas o JORDAN Spark V2 Voice Core local...
echo [INFO] O Manual Core roda no navegador e NAO precisa deste servidor.
echo.
python -m uvicorn server.app:app --host 0.0.0.0 --port 8787
pause
