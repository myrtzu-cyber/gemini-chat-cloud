@echo off
setlocal enabledelayedexpansion

echo 📦 Instalação Manual de Dependências - Ambiente Corporativo
echo ==========================================================
echo.

set "NPM_CMD=portable\node\npm.cmd"
set "NODE_CMD=portable\node\node.exe"

echo ℹ️  Criando diretórios locais...
if not exist "backend\node_modules" mkdir "backend\node_modules"
if not exist "npm-cache" mkdir "npm-cache"
if not exist "npm-tmp" mkdir "npm-tmp"

cd backend

echo ℹ️  Tentativa 1: Instalação com registry alternativo...
..\%NPM_CMD% install --registry https://registry.npmmirror.com/ --cache ..\npm-cache --tmp ..\npm-tmp --no-audit --no-fund --prefer-offline

if errorlevel 1 (
    echo ⚠️  Tentativa 1 falhou. Tentando registry alternativo 2...
    ..\%NPM_CMD% install --registry https://registry.yarnpkg.com/ --cache ..\npm-cache --tmp ..\npm-tmp --no-audit --no-fund --prefer-offline
)

if errorlevel 1 (
    echo ⚠️  Tentativa 2 falhou. Tentando instalação individual...
    
    echo ℹ️  Instalando express...
    ..\%NPM_CMD% install express@^4.18.2 --registry https://registry.npmmirror.com/ --cache ..\npm-cache --no-audit --no-fund
    
    echo ℹ️  Instalando cors...
    ..\%NPM_CMD% install cors@^2.8.5 --registry https://registry.npmmirror.com/ --cache ..\npm-cache --no-audit --no-fund
    
    echo ℹ️  Instalando body-parser...
    ..\%NPM_CMD% install body-parser@^1.20.2 --registry https://registry.npmmirror.com/ --cache ..\npm-cache --no-audit --no-fund
    
    echo ℹ️  Instalando helmet...
    ..\%NPM_CMD% install helmet@^7.1.0 --registry https://registry.npmmirror.com/ --cache ..\npm-cache --no-audit --no-fund
    
    echo ℹ️  Instalando compression...
    ..\%NPM_CMD% install compression@^1.7.4 --registry https://registry.npmmirror.com/ --cache ..\npm-cache --no-audit --no-fund
    
    echo ℹ️  Instalando dotenv...
    ..\%NPM_CMD% install dotenv@^16.3.1 --registry https://registry.npmmirror.com/ --cache ..\npm-cache --no-audit --no-fund
)

if errorlevel 1 (
    echo ❌ Instalação via NPM falhou. Tentando método alternativo...
    echo.
    echo ℹ️  Criando package.json mínimo para desenvolvimento local...
    
    REM Criar um package.json mínimo que funciona apenas com módulos nativos
    echo {> package-minimal.json
    echo   "name": "gemini-chat-backend",>> package-minimal.json
    echo   "version": "2.0.0",>> package-minimal.json
    echo   "main": "server-minimal.js",>> package-minimal.json
    echo   "scripts": {>> package-minimal.json
    echo     "start": "node server-minimal.js">> package-minimal.json
    echo   }>> package-minimal.json
    echo }>> package-minimal.json
    
    echo ✅ Package.json mínimo criado!
    echo ℹ️  Você pode usar o servidor Python como alternativa:
    echo    python ..\server_python.py
) else (
    echo ✅ Dependências instaladas com sucesso!
)

cd ..

echo.
echo ℹ️  Verificando instalação...
if exist "backend\node_modules" (
    echo ✅ Diretório node_modules criado
    dir /b "backend\node_modules" | find /c /v "" > temp_count.txt
    set /p module_count=<temp_count.txt
    del temp_count.txt
    echo ✅ !module_count! módulos instalados
) else (
    echo ⚠️  node_modules não encontrado
)

echo.
echo 🎯 Próximos passos:
echo 1. Se a instalação funcionou: npm start no diretório backend
echo 2. Se falhou: use o servidor Python como alternativa
echo 3. Para deployment: considere usar o servidor Python que já funciona
echo.
pause
