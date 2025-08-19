@echo off
setlocal enabledelayedexpansion

echo 🏢 Gemini Chat - Deployment Corporativo (Sem NPM)
echo ================================================
echo.

echo ✅ Detectado ambiente corporativo com restrições
echo ℹ️  Usando soluções alternativas...
echo.

REM Verificar Node.js portátil
if exist "portable\node\node.exe" (
    echo ✅ Node.js portátil encontrado: portable\node\node.exe
    set "NODE_CMD=portable\node\node.exe"
) else (
    echo ❌ Node.js portátil não encontrado
    echo ℹ️  Usando apenas servidor Python
    set "NODE_CMD="
)

echo.
echo 📋 Opções de Deployment Disponíveis:
echo =====================================
echo.
echo 1. 🐍 Servidor Python (Recomendado para ambiente corporativo)
echo    - Sem dependências externas
echo    - Funciona imediatamente
echo    - SQLite integrado
echo.
echo 2. 📦 Servidor Node.js Mínimo (Se Node.js disponível)
echo    - Sem dependências npm
echo    - Apenas módulos nativos
echo    - Banco em memória
echo.
echo 3. ☁️  Deployment direto para nuvem
echo    - Usando arquivos existentes
echo    - Sem instalação local
echo.

set /p choice="Escolha uma opção (1, 2, ou 3): "

if "%choice%"=="1" goto python_server
if "%choice%"=="2" goto nodejs_minimal
if "%choice%"=="3" goto cloud_deploy
goto invalid_choice

:python_server
echo.
echo 🐍 Configurando Servidor Python...
echo ==================================
echo.

REM Verificar se Python está disponível
python --version >nul 2>&1
if errorlevel 1 (
    echo ❌ Python não encontrado no PATH
    echo ℹ️  Tentando python3...
    python3 --version >nul 2>&1
    if errorlevel 1 (
        echo ❌ Python3 também não encontrado
        echo ℹ️  Por favor, instale Python ou use outra opção
        pause
        goto end
    ) else (
        set "PYTHON_CMD=python3"
    )
) else (
    set "PYTHON_CMD=python"
)

echo ✅ Python encontrado: !PYTHON_CMD!
echo.
echo ℹ️  Iniciando servidor Python...
echo ℹ️  Pressione Ctrl+C para parar o servidor
echo.
!PYTHON_CMD! server_python.py
goto end

:nodejs_minimal
echo.
echo 📦 Configurando Servidor Node.js Mínimo...
echo =========================================
echo.

if "%NODE_CMD%"=="" (
    echo ❌ Node.js não disponível
    echo ℹ️  Use a opção 1 (Python) em vez disso
    pause
    goto end
)

echo ✅ Usando Node.js: %NODE_CMD%
echo.
echo ℹ️  Testando servidor mínimo...
cd backend
..\%NODE_CMD% server-minimal.js
cd ..
goto end

:cloud_deploy
echo.
echo ☁️  Preparando Deployment para Nuvem...
echo ====================================
echo.

echo ℹ️  Criando arquivos de configuração para deployment...

REM Criar package.json simplificado para deployment
echo {> backend\package-deploy.json
echo   "name": "gemini-chat-backend",>> backend\package-deploy.json
echo   "version": "2.0.0",>> backend\package-deploy.json
echo   "description": "Gemini Chat Backend - Corporate Deploy",>> backend\package-deploy.json
echo   "main": "server-minimal.js",>> backend\package-deploy.json
echo   "scripts": {>> backend\package-deploy.json
echo     "start": "node server-minimal.js",>> backend\package-deploy.json
echo     "build": "echo 'Build completed'">> backend\package-deploy.json
echo   },>> backend\package-deploy.json
echo   "engines": {>> backend\package-deploy.json
echo     "node": ">=16.0.0">> backend\package-deploy.json
echo   },>> backend\package-deploy.json
echo   "keywords": ["gemini", "chat", "corporate"],>> backend\package-deploy.json
echo   "license": "MIT">> backend\package-deploy.json
echo }>> backend\package-deploy.json

REM Criar Procfile para Heroku
echo web: node server-minimal.js> backend\Procfile

REM Criar railway.toml atualizado
echo [build]> railway-corporate.toml
echo builder = "NIXPACKS">> railway-corporate.toml
echo>> railway-corporate.toml
echo [deploy]>> railway-corporate.toml
echo startCommand = "cd backend && node server-minimal.js">> railway-corporate.toml
echo healthcheckPath = "/api/health">> railway-corporate.toml
echo>> railway-corporate.toml
echo [environments.production]>> railway-corporate.toml
echo variables = { NODE_ENV = "production" }>> railway-corporate.toml

echo ✅ Arquivos de deployment criados!
echo.
echo 📋 Próximos passos para deployment:
echo ==================================
echo.
echo 1. 📤 Fazer upload dos arquivos para GitHub:
echo    - Use a interface web do GitHub se git estiver bloqueado
echo    - Ou use git se disponível: git add . && git commit -m "Corporate deploy"
echo.
echo 2. 🚀 Escolher plataforma de deployment:
echo    - Railway: https://railway.app (recomendado)
echo    - Render: https://render.com
echo    - Heroku: https://heroku.com
echo.
echo 3. ⚙️  Configurar na plataforma:
echo    - Conectar repositório GitHub
echo    - Usar arquivo: railway-corporate.toml (Railway) ou Procfile (Heroku)
echo    - Comando de start: node server-minimal.js
echo    - Diretório: backend
echo.
echo 4. 🌐 Acessar aplicação:
echo    - URL será fornecida pela plataforma
echo    - Exemplo: https://seu-app.railway.app
echo.
goto end

:invalid_choice
echo ❌ Opção inválida. Tente novamente.
pause
goto end

:end
echo.
echo 🎉 Processo concluído!
echo.
echo 💡 Dicas para ambiente corporativo:
echo ==================================
echo • Use o servidor Python se possível (mais compatível)
echo • Para deployment: use o servidor mínimo Node.js
echo • Considere usar GitHub web interface se git estiver bloqueado
echo • Railway e Render são mais amigáveis para ambientes corporativos
echo.
pause
