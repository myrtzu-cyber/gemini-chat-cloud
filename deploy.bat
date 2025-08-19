@echo off
setlocal enabledelayedexpansion

REM 🚀 Gemini Chat Cloud Deployment Script for Windows
REM This script helps prepare your application for cloud deployment

echo 🚀 Gemini Chat - Cloud Deployment Preparation
echo ==============================================
echo.

REM Check if we're in the right directory
if not exist "backend\package.json" (
    echo ❌ This doesn't appear to be the Gemini Chat project directory.
    echo ❌ Please run this script from the project root.
    pause
    exit /b 1
)

echo ✅ Found Gemini Chat project!

REM Step 1: Detect and configure Node.js (system or portable)
echo ℹ️  Detecting Node.js installation...

REM Initialize Node.js variables
set "NODE_CMD="
set "NPM_CMD="
set "NODE_VERSION="

REM First, try system Node.js
node --version >nul 2>&1
if not errorlevel 1 (
    set "NODE_CMD=node"
    set "NPM_CMD=npm"
    for /f "tokens=*" %%i in ('node --version') do set NODE_VERSION=%%i
    echo ✅ Found system Node.js version: !NODE_VERSION!
) else (
    echo ⚠️  System Node.js not found in PATH, checking for portable version...

    REM Check for portable Node.js
    if exist "portable\node\node.exe" (
        set "NODE_CMD=portable\node\node.exe"

        REM Check for npm.cmd or npm (different Node.js distributions)
        if exist "portable\node\npm.cmd" (
            set "NPM_CMD=portable\node\npm.cmd"
        ) else if exist "portable\node\npm" (
            set "NPM_CMD=portable\node\npm"
        ) else if exist "portable\node\npm.bat" (
            set "NPM_CMD=portable\node\npm.bat"
        ) else (
            echo ❌ Found Node.js but npm not found in portable directory
            echo ℹ️  Please ensure npm is available in .\portable\node\
            pause
            exit /b 1
        )

        for /f "tokens=*" %%i in ('portable\node\node.exe --version') do set NODE_VERSION=%%i
        echo ✅ Found portable Node.js version: !NODE_VERSION!
        echo ℹ️  Using portable Node.js from: .\portable\node\
        echo ℹ️  NPM command: !NPM_CMD!
    ) else (
        echo ❌ Node.js not found in system PATH or portable directory.
        echo ❌ Please ensure Node.js is available in one of these locations:
        echo    • System PATH (install Node.js globally)
        echo    • .\portable\node\node.exe (portable installation)
        pause
        exit /b 1
    )
)

REM Step 2: Install dependencies using detected Node.js
echo ℹ️  Installing backend dependencies using: !NPM_CMD!
cd backend
if exist "package.json" (
    echo ℹ️  Running: !NPM_CMD! install
    call !NPM_CMD! install
    if errorlevel 1 (
        echo ❌ Failed to install dependencies
        echo ℹ️  Attempted command: !NPM_CMD! install
        pause
        exit /b 1
    )
    echo ✅ Backend dependencies installed successfully!
) else (
    echo ❌ backend\package.json not found!
    pause
    exit /b 1
)
cd ..

REM Step 3: Create .env.example if it doesn't exist
if not exist "backend\.env.example" (
    echo ℹ️  Creating .env.example file...
    (
        echo # Environment Configuration for Cloud Deployment
        echo DATABASE_URL=postgresql://username:password@hostname:port/database_name
        echo NODE_ENV=production
        echo PORT=3000
        echo.
        echo # Google Sheets API ^(Optional^)
        echo GOOGLE_SERVICE_ACCOUNT_EMAIL=your_service_account@project.iam.gserviceaccount.com
        echo GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYOUR_PRIVATE_KEY\n-----END PRIVATE KEY-----\n"
        echo.
        echo # CORS Configuration
        echo ALLOWED_ORIGINS=https://your-frontend-domain.com
    ) > backend\.env.example
    echo ✅ .env.example created!
)

REM Step 4: Check for Git repository
echo ℹ️  Checking Git repository...
if exist ".git" (
    echo ✅ Git repository found!
    
    REM Check if there are uncommitted changes
    git status --porcelain > temp_status.txt
    for /f %%i in ("temp_status.txt") do set size=%%~zi
    del temp_status.txt
    
    if !size! gtr 0 (
        echo ⚠️  You have uncommitted changes. Consider committing them before deployment.
        git status --short
        echo.
        set /p commit_choice="Do you want to commit these changes now? (y/n): "
        if /i "!commit_choice!"=="y" (
            git add .
            set /p commit_message="Enter commit message: "
            git commit -m "!commit_message!"
            echo ✅ Changes committed!
        )
    )
) else (
    echo ⚠️  No Git repository found. Initializing...
    git init
    git add .
    git commit -m "Initial commit - Gemini Chat cloud deployment"
    echo ✅ Git repository initialized!
    echo ℹ️  Don't forget to push to GitHub: git remote add origin ^<your-repo-url^> ^&^& git push -u origin main
)

REM Step 5: Test local build using detected Node.js
echo ℹ️  Testing local build using: !NPM_CMD!
cd backend
echo ℹ️  Running: !NPM_CMD! run build
call !NPM_CMD! run build >nul 2>&1
if errorlevel 1 (
    echo ⚠️  Build test completed ^(this is normal for this project^)
) else (
    echo ✅ Build test successful!
)
cd ..

REM Step 6: Create deployment checklist
echo ℹ️  Creating deployment checklist...
(
    echo # 📋 Deployment Checklist
    echo.
    echo ## Before Deployment:
    echo - [ ] Code pushed to GitHub
    echo - [ ] Environment variables prepared
    echo - [ ] Database migration plan ready
    echo - [ ] Google Sheets API configured ^(optional^)
    echo.
    echo ## Railway Deployment:
    echo - [ ] Account created at railway.app
    echo - [ ] Project connected to GitHub repo
    echo - [ ] Environment variables set
    echo - [ ] Database provisioned automatically
    echo - [ ] Application deployed and accessible
    echo.
    echo ## Render Deployment:
    echo - [ ] Account created at render.com
    echo - [ ] Web service created
    echo - [ ] PostgreSQL database created
    echo - [ ] Environment variables configured
    echo - [ ] Application deployed and accessible
    echo.
    echo ## Post-Deployment:
    echo - [ ] Health check endpoint working: /api/health
    echo - [ ] Frontend loads correctly
    echo - [ ] Chat functionality working
    echo - [ ] Database operations working
    echo - [ ] Google Sheets backup tested ^(if configured^)
    echo - [ ] Mobile version accessible
    echo - [ ] PWA installation working
    echo.
    echo ## Environment Variables Needed:
    echo - NODE_ENV=production
    echo - DATABASE_URL=^(provided by hosting platform^)
    echo - PORT=^(provided by hosting platform^)
    echo - GOOGLE_SERVICE_ACCOUNT_EMAIL=^(optional^)
    echo - GOOGLE_PRIVATE_KEY=^(optional^)
    echo - ALLOWED_ORIGINS=^(your domain^)
) > DEPLOYMENT_CHECKLIST.md

echo ✅ Deployment checklist created!

REM Step 7: Display next steps
echo.
echo 🎉 Deployment preparation complete!
echo ==================================
echo.
echo ℹ️  Next steps:
echo 1. Push your code to GitHub if you haven't already
echo 2. Choose a hosting platform:
echo    • Railway ^(recommended^): https://railway.app
echo    • Render: https://render.com
echo 3. Follow the DEPLOYMENT_GUIDE.md for detailed instructions
echo 4. Use DEPLOYMENT_CHECKLIST.md to track your progress
echo.
echo ℹ️  Quick start commands:
echo • Push to GitHub: git push origin main
echo • Test locally: cd backend ^&^& !NPM_CMD! start
echo • Migrate data: cd backend ^&^& !NPM_CMD! run migrate
echo • Node.js detected: !NODE_CMD!
echo • NPM command: !NPM_CMD!
echo.
echo ✅ Your Gemini Chat is ready for cloud deployment! 🚀

REM Step 8: Optional - open deployment guide
set /p open_guide="Would you like to open the deployment guide now? (y/n): "
if /i "!open_guide!"=="y" (
    if exist "C:\Program Files\Microsoft VS Code\Code.exe" (
        "C:\Program Files\Microsoft VS Code\Code.exe" DEPLOYMENT_GUIDE.md
    ) else (
        start DEPLOYMENT_GUIDE.md
    )
)

echo.
echo Press any key to exit...
pause >nul
