@echo off
echo 🏢 Configurando NPM para Ambiente Corporativo
echo =============================================
echo.

set "NPM_CMD=portable\node\npm.cmd"

echo ℹ️  Configurações atuais do NPM:
%NPM_CMD% config list

echo.
echo ℹ️  Configurando registries alternativos e configurações corporativas...

REM Configurar registry alternativo (Taobao - mais rápido na China/Ásia)
%NPM_CMD% config set registry https://registry.npmmirror.com/

REM Configurar timeout maior
%NPM_CMD% config set fetch-timeout 300000
%NPM_CMD% config set fetch-retry-mintimeout 20000
%NPM_CMD% config set fetch-retry-maxtimeout 120000

REM Desabilitar verificação SSL se necessário (apenas para testes)
%NPM_CMD% config set strict-ssl false

REM Configurar cache em diretório local
%NPM_CMD% config set cache "%CD%\npm-cache"

REM Configurar diretório temporário local
%NPM_CMD% config set tmp "%CD%\npm-tmp"

REM Configurar prefix local para evitar permissões globais
%NPM_CMD% config set prefix "%CD%\npm-global"

echo.
echo ✅ Configurações aplicadas!
echo.
echo ℹ️  Novas configurações:
%NPM_CMD% config list

echo.
echo ℹ️  Para configurar proxy manualmente (se necessário):
echo %NPM_CMD% config set proxy http://proxy-server:port
echo %NPM_CMD% config set https-proxy http://proxy-server:port
echo.
echo ℹ️  Para resetar configurações:
echo %NPM_CMD% config delete proxy
echo %NPM_CMD% config delete https-proxy
echo %NPM_CMD% config set registry https://registry.npmjs.org/
echo.
pause
