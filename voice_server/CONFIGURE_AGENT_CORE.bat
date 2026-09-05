@echo off
setlocal
cd /d "%~dp0"
title JORDAN Core V0.11 - Configuracao

echo === JORDAN CORE V0.11 ===
echo.
echo A chave fica SOMENTE neste PC em voice_server\.env.
echo O arquivo .env esta bloqueado pelo .gitignore e nao deve ir para o GitHub.
echo A mesma chave ativa o Agent Core e, no modo AUTO, a voz neural Spark V2.
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
>> .env echo JORDAN_REASONING_EFFORT=high
>> .env echo JORDAN_TTS_PROVIDER=auto
>> .env echo JORDAN_TTS_MODEL=gpt-4o-mini-tts
>> .env echo JORDAN_TTS_VOICE=coral

echo.
echo JORDAN Core configurado.
echo Agent Core: gpt-5.6-sol / reasoning high.
echo Voice Core: Spark V2 / AUTO (cloud com fallback local).
echo Agora execute RUN_VOICE_SERVER.bat.
pause
