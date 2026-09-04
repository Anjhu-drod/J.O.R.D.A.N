@echo off
setlocal
cd /d "%~dp0"
title JORDAN Autonomous Agent Core - Configuracao

echo === JORDAN AUTONOMOUS AGENT CORE ===
echo.
echo A chave fica SOMENTE neste PC em voice_server\.env.
echo O arquivo .env esta bloqueado pelo .gitignore e nao deve ir para o GitHub.
echo.
set /p JORDAN_KEY="Cole sua OPENAI_API_KEY e pressione Enter: "
if "%JORDAN_KEY%"=="" (
  echo.
  echo Nenhuma chave informada. Nada foi alterado.
  pause
  exit /b 1
)

> .env echo OPENAI_API_KEY=%JORDAN_KEY%
>> .env echo JORDAN_MODEL=gpt-5.6-sol

echo.
echo Agent Core configurado para gpt-5.6-sol.
echo Agora execute RUN_VOICE_SERVER.bat.
pause
