@echo off
setlocal enabledelayedexpansion

echo 🧪 Teste Rápido - Render e Node.js Portátil
echo ==========================================
echo.

REM Configuração
set "RENDER_URL=https://gemini-chat-cloud.onrender.com"
set "NODE_CMD=portable\node\node.exe"

echo 🔍 Verificando componentes...
echo.

REM Teste 1: Node.js portátil
echo 📦 Teste 1: Node.js Portátil
echo ---------------------------
if exist "%NODE_CMD%" (
    echo ✅ Node.js encontrado: %NODE_CMD%
    %NODE_CMD% --version
) else (
    echo ❌ Node.js não encontrado em: %NODE_CMD%
    echo 💡 Verifique se o diretório portable\node existe
    goto end
)

echo.

REM Teste 2: Python
echo 🐍 Teste 2: Python
echo ------------------
python --version >nul 2>&1
if errorlevel 1 (
    echo ❌ Python não encontrado
    echo 💡 Python é necessário para exportar dados locais
) else (
    echo ✅ Python encontrado
    python --version
)

echo.

REM Teste 3: Arquivos de script
echo 📁 Teste 3: Arquivos de Script
echo ------------------------------
if exist "verify-database-connection.js" (
    echo ✅ verify-database-connection.js
) else (
    echo ❌ verify-database-connection.js não encontrado
)

if exist "import-to-cloud.js" (
    echo ✅ import-to-cloud.js
) else (
    echo ❌ import-to-cloud.js não encontrado
)

if exist "export-database.py" (
    echo ✅ export-database.py
) else (
    echo ❌ export-database.py não encontrado
)

echo.

REM Teste 4: Conectividade com Render
echo 🌐 Teste 4: Conectividade Render
echo --------------------------------
echo Testando: %RENDER_URL%/api/health

REM Usar PowerShell para teste HTTP
powershell -Command "try { $response = Invoke-WebRequest -Uri '%RENDER_URL%/api/health' -TimeoutSec 10; Write-Host '✅ Render acessível - Status:' $response.StatusCode } catch { Write-Host '❌ Render não acessível:' $_.Exception.Message }"

echo.

REM Teste 5: Verificação completa com Node.js
echo 🔍 Teste 5: Verificação Database
echo --------------------------------
if exist "%NODE_CMD%" if exist "verify-database-connection.js" (
    echo Executando verificação de database...
    %NODE_CMD% verify-database-connection.js %RENDER_URL%
) else (
    echo ⚠️ Não é possível executar verificação - arquivos ausentes
)

echo.
echo 🎯 Resultado do Teste
echo ====================

if exist "%NODE_CMD%" if exist "verify-database-connection.js" (
    echo ✅ Ambiente pronto para migração
    echo.
    echo 💡 Próximos passos:
    echo 1. Execute: .\complete-migration.bat %RENDER_URL%
    echo 2. Ou execute comandos individuais:
    echo    %NODE_CMD% verify-database-connection.js %RENDER_URL%
    echo    python export-database.py
    echo    %NODE_CMD% import-to-cloud.js %RENDER_URL%
) else (
    echo ❌ Ambiente não está pronto
    echo 💡 Verifique os componentes marcados com ❌ acima
)

:end
echo.
pause
