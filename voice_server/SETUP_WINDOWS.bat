@echo off
setlocal
cd /d "%~dp0"
title JORDAN Core V0.11 - Setup

echo === JORDAN CORE V0.11 / SPARK V2 ===
where py >nul 2>nul
if errorlevel 1 (
  echo Python nao encontrado. Instale Python 3.11 ou 3.12 e tente novamente.
  pause
  exit /b 1
)

if not exist ".venv\Scripts\activate.bat" py -m venv .venv
call .venv\Scripts\activate
python -m pip install --upgrade pip
pip install -r requirements.txt
if errorlevel 1 (
  echo.
  echo Falha ao instalar dependencias.
  pause
  exit /b 1
)

echo.
echo Dependencias instaladas.
echo A Spark V2 neural cloud nao precisa de eSpeak.
echo O nucleo LOCAL Kokoro pode precisar do eSpeak NG para pronuncia/fonetica no Windows.
echo Se quiser o fallback local completo, instale eSpeak NG:
echo https://github.com/espeak-ng/espeak-ng/releases
echo.
echo Tentando preparar os embeddings locais Spark V2...
python scripts\build_voice.py
if errorlevel 1 (
  echo [AVISO] Nao consegui preconstruir a voz local. O servidor ainda pode usar a voz cloud se o .env estiver configurado.
) else (
  echo [OK] Fallback local Spark V2 preparado.
)
echo.
echo Setup concluido.
echo 1. Execute CONFIGURE_AGENT_CORE.bat
echo 2. Execute RUN_VOICE_SERVER.bat
pause
