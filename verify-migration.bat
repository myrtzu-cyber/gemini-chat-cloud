@echo off
setlocal enabledelayedexpansion

echo 🔍 Verificação de Migração - Gemini Chat
echo ========================================
echo.

REM Configuração
set "RENDER_URL=https://gemini-chat-cloud.onrender.com"
set "NODE_CMD=portable\node\node.exe"

echo 🌐 URL: %RENDER_URL%
echo.

echo 📊 Verificando dados migrados...
echo.

REM Verificar conexão e stats
echo 1. Testando conexão database...
%NODE_CMD% verify-database-connection-corporate.js %RENDER_URL%

echo.
echo 2. Verificando via browser...
echo.
echo 💡 Teste estes endpoints no seu navegador:
echo.
echo 📊 Stats (quantos chats):
echo    %RENDER_URL%/api/stats
echo.
echo 📝 Lista de chats:
echo    %RENDER_URL%/api/chats
echo.
echo 🏠 Frontend principal:
echo    %RENDER_URL%/
echo.
echo 📱 Versão mobile:
echo    %RENDER_URL%/mobile
echo.

echo 🎯 Resultado Esperado:
echo =====================
echo.
echo ✅ Stats deve mostrar: total_chats: 1
echo ✅ Lista de chats deve mostrar 1 chat
echo ✅ Frontend deve carregar e mostrar o chat
echo.

pause
