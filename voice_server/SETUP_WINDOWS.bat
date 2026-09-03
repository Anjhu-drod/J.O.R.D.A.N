@echo off
title JORDAN Voice V1 - Setup
cd /d "%~dp0"
echo === JORDAN VOICE V1 ===
where py >nul 2>nul
if errorlevel 1 (
  echo Python nao encontrado. Instale Python 3.11 ou 3.12 e tente novamente.
  pause
  exit /b 1
)
py -m venv .venv
call .venv\Scripts\activate
python -m pip install --upgrade pip
pip install -r requirements.txt
echo.
echo Agora e necessario ter eSpeak NG instalado no Windows.
echo Releases oficiais: https://github.com/espeak-ng/espeak-ng/releases
echo.
python scripts\build_voice.py
python scripts\generate_samples.py
echo.
echo PRONTO. Abra a pasta samples para ouvir a JORDAN.
pause
