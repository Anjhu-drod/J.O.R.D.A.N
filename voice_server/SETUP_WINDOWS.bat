@echo off
setlocal
cd /d "%~dp0"
title JORDAN Voice Core V0.12 - Setup

echo === JORDAN V0.12 / SPARK V2 LOCAL ===
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
echo O cerebro Manual Core nao usa Python, API ou chave.
echo Este ambiente Python existe somente para a voz Spark V2 local.
echo.
echo O Kokoro pode precisar do eSpeak NG para pronuncia/fonetica no Windows.
echo Se necessario, instale eSpeak NG:
echo https://github.com/espeak-ng/espeak-ng/releases
echo.
echo Tentando preparar os embeddings locais Spark V2...
python scripts\build_voice.py
if errorlevel 1 (
  echo [AVISO] Nao consegui preconstruir a voz local. O servidor tentara reconstruir na primeira fala.
) else (
  echo [OK] Spark V2 local preparada.
)
echo.
echo Setup concluido.
echo Agora execute RUN_VOICE_SERVER.bat apenas quando quiser a voz neural local.
echo O Manual Core funciona mesmo sem abrir esse BAT.
pause
