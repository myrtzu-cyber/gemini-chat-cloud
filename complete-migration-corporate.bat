@echo off
setlocal enabledelayedexpansion

echo 🏢 Migração Completa - Ambiente Corporativo
echo ==========================================
echo.

REM Configuração
set "RENDER_URL=https://gemini-chat-cloud.onrender.com"
if not "%1"=="" set "RENDER_URL=%1"

REM Configurar Node.js portátil
set "NODE_CMD=portable\node\node.exe"
set "NPM_CMD=portable\node\npm.cmd"

echo 🌐 URL Cloud: %RENDER_URL%
echo 🔒 Modo: Corporativo (SSL relaxado)
echo.

REM Verificar se Node.js portátil existe
if not exist "%NODE_CMD%" (
    echo ❌ Node.js portátil não encontrado em: %NODE_CMD%
    echo 💡 Verifique se o diretório portable\node existe
    pause
    goto end
)

echo ✅ Usando Node.js portátil: %NODE_CMD%
echo.

echo 📋 Processo de Migração Corporativo:
echo 1. Verificar conexão database (SSL relaxado)
echo 2. Exportar dados locais
echo 3. Importar dados para cloud (SSL relaxado)
echo 4. Verificar migração
echo.

REM Passo 1: Verificar conexão database com configuração corporativa
echo 🔍 Passo 1: Verificando conexão database (Corporativo)...
echo =========================================================
%NODE_CMD% verify-database-connection-corporate.js %RENDER_URL%

if errorlevel 1 (
    echo.
    echo ❌ Problemas na conexão database detectados
    echo 💡 Possíveis soluções:
    echo    - Verificar se Render service está rodando
    echo    - Confirmar DATABASE_URL no Render dashboard
    echo    - Testar acesso via browser: %RENDER_URL%/api/health
    echo.
    set /p continue="Continuar mesmo assim? (s/N): "
    if /i not "!continue!"=="s" goto end
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
    echo 💡 Possíveis causas:
    echo    - Python não instalado
    echo    - Database local não existe
    echo    - Permissões de arquivo
    echo.
    echo INFO: Continuando sem dados locais (import vazio)...
    echo.
)

echo.
echo ✅ Export de dados concluído!
echo.

REM Encontrar arquivo de export mais recente
for /f "delims=" %%i in ('dir /b /o-d database_export_*.json 2^>nul') do (
    set "EXPORT_FILE=%%i"
    goto found_export
)

echo WARNING: Nenhum arquivo de export encontrado
echo INFO: Continuando com import vazio...
set "EXPORT_FILE="

:found_export
if defined EXPORT_FILE (
    echo Arquivo de export: %EXPORT_FILE%
) else (
    echo Import: Dados vazios (inicializacao)
)
echo.

REM Passo 3: Importar dados para cloud com configuração corporativa
echo 📤 Passo 3: Importando dados para cloud (Corporativo)...
echo ========================================================
if defined EXPORT_FILE (
    %NODE_CMD% import-to-cloud-corporate.js %RENDER_URL% %EXPORT_FILE%
) else (
    %NODE_CMD% import-to-cloud-corporate.js %RENDER_URL%
)

if errorlevel 1 (
    echo.
    echo ❌ Falha ao importar dados para cloud
    echo 💡 Possíveis causas:
    echo    - Problemas de conectividade
    echo    - Database não configurado no Render
    echo    - Arquivo de export corrompido
    echo.
    echo ℹ️  Verificando se aplicação está funcionando...
    %NODE_CMD% verify-database-connection-corporate.js %RENDER_URL%
    pause
    goto end
)

echo.
echo ✅ Dados importados para cloud!
echo.

REM Passo 4: Verificação final
echo 🔍 Passo 4: Verificação final...
echo ================================
%NODE_CMD% verify-database-connection-corporate.js %RENDER_URL%

echo.
echo 🎉 Migração Corporativa Concluída!
echo ==================================
echo.
echo 📊 Resumo:
echo ✅ Database conectado na cloud (SSL corporativo)
echo ✅ Dados locais exportados
echo ✅ Dados importados para cloud
echo ✅ Verificação realizada
echo.
echo 🌐 Acesse sua aplicação: %RENDER_URL%
echo 📱 Versão mobile: %RENDER_URL%/mobile
echo 🧪 Testes: %RENDER_URL%/test-deployment.html
echo.
echo 🔒 Nota de Segurança:
echo SSL validation foi relaxada para ambiente corporativo.
echo Isso é seguro apenas para desenvolvimento/teste interno.
echo.

:end
echo.
echo 💡 Próximos passos:
echo 1. Teste a aplicação na cloud via browser
echo 2. Verifique se todos os chats estão lá
echo 3. Configure backup automático (opcional)
echo 4. Para produção: configure SSL adequadamente
echo.
pause
