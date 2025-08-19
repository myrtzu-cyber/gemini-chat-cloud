@echo off
echo ========================================
echo    INSTALADOR GEMINI CHAT BACKEND
echo ========================================
echo.

echo [1/4] Verificando Node.js...
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Node.js não encontrado!
    echo Por favor, instale o Node.js de: https://nodejs.org/
    pause
    exit /b 1
)
echo ✅ Node.js encontrado!

echo.
echo [2/4] Instalando dependências do backend...
cd backend
npm install
if %errorlevel% neq 0 (
    echo ❌ Erro ao instalar dependências!
    pause
    exit /b 1
)
echo ✅ Dependências instaladas!

echo.
echo [3/4] Movendo arquivos do frontend...
cd ..
if not exist "frontend" mkdir frontend
move index.html frontend\ >nul 2>&1
move styles.css frontend\ >nul 2>&1
move script.js frontend\ >nul 2>&1
echo ✅ Arquivos movidos!

echo.
echo [4/4] Configuração concluída!
echo.
echo 🚀 Para iniciar o sistema:
echo    1. Abra um terminal na pasta do projeto
echo    2. Execute: cd backend
echo    3. Execute: npm start
echo    4. Acesse: http://localhost:3000
echo.
echo 📁 Estrutura criada:
echo    ├── frontend/     (interface web)
echo    ├── backend/      (servidor Node.js)
echo    └── database/     (banco SQLite)
echo.
pause
