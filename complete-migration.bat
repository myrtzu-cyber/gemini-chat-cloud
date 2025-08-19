@echo off
setlocal enabledelayedexpansion

echo 🚀 Migração Completa - Local para Cloud
echo =======================================
echo.

REM Configuração
set "RENDER_URL=https://gemini-chat-cloud.onrender.com"
if not "%1"=="" set "RENDER_URL=%1"

echo 🌐 URL Cloud: %RENDER_URL%
echo.

echo 📋 Processo de Migração:
echo 1. Verificar conexão database na cloud
echo 2. Exportar dados locais
echo 3. Importar dados para cloud
echo 4. Verificar migração
echo.

REM Passo 1: Verificar conexão database
echo 🔍 Passo 1: Verificando conexão database...
echo ==========================================
node verify-database-connection.js %RENDER_URL%

if errorlevel 1 (
    echo.
    echo ❌ Problemas na conexão database detectados
    echo 💡 Verifique configuração DATABASE_URL no Render
    echo.
    pause
    goto end
)

echo.
echo ✅ Conexão database verificada!
echo.

REM Passo 2: Exportar dados locais
echo 📦 Passo 2: Exportando dados locais...
echo ======================================
python export-database.py

if errorlevel 1 (
    echo.
    echo ❌ Falha ao exportar dados locais
    echo 💡 Verifique se Python está instalado e database local existe
    echo.
    pause
    goto end
)

echo.
echo ✅ Dados locais exportados!
echo.

REM Encontrar arquivo de export mais recente
for /f "delims=" %%i in ('dir /b /o-d database_export_*.json 2^>nul') do (
    set "EXPORT_FILE=%%i"
    goto found_export
)

echo ❌ Nenhum arquivo de export encontrado
echo 💡 Execute: python export-database.py
pause
goto end

:found_export
echo 📁 Arquivo de export: %EXPORT_FILE%
echo.

REM Passo 3: Importar dados para cloud
echo 📤 Passo 3: Importando dados para cloud...
echo ==========================================
node import-to-cloud.js %RENDER_URL% %EXPORT_FILE%

if errorlevel 1 (
    echo.
    echo ❌ Falha ao importar dados para cloud
    echo 💡 Verifique conexão e configuração
    echo.
    pause
    goto end
)

echo.
echo ✅ Dados importados para cloud!
echo.

REM Passo 4: Verificação final
echo 🔍 Passo 4: Verificação final...
echo ================================
node test-database-persistence.js %RENDER_URL%

if errorlevel 1 (
    echo.
    echo ⚠️ Alguns testes falharam, mas migração pode ter funcionado
    echo 💡 Teste manualmente: %RENDER_URL%
) else (
    echo.
    echo ✅ Verificação final passou!
)

echo.
echo 🎉 Migração Concluída!
echo =====================
echo.
echo 📊 Resumo:
echo ✅ Database conectado na cloud
echo ✅ Dados locais exportados
echo ✅ Dados importados para cloud
echo ✅ Verificação realizada
echo.
echo 🌐 Acesse sua aplicação: %RENDER_URL%
echo 📱 Versão mobile: %RENDER_URL%/mobile
echo 🧪 Testes: %RENDER_URL%/test-deployment.html
echo.

:end
echo.
echo 💡 Próximos passos:
echo 1. Teste a aplicação na cloud
echo 2. Verifique se todos os chats estão lá
echo 3. Configure domínio personalizado (opcional)
echo 4. Configure backup automático (opcional)
echo.
pause
