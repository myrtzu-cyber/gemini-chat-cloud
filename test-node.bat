@echo off
setlocal enabledelayedexpansion

echo 🧪 Testing Node.js Detection Script
echo ===================================
echo.

REM Initialize Node.js variables
set "NODE_CMD="
set "NPM_CMD="
set "NODE_VERSION="

echo ℹ️  Checking for system Node.js...
node --version >nul 2>&1
if not errorlevel 1 (
    set "NODE_CMD=node"
    set "NPM_CMD=npm"
    for /f "tokens=*" %%i in ('node --version') do set NODE_VERSION=%%i
    echo ✅ Found system Node.js version: !NODE_VERSION!
) else (
    echo ⚠️  System Node.js not found in PATH
    
    echo ℹ️  Checking for portable Node.js...
    if exist "portable\node\node.exe" (
        echo ✅ Found portable\node\node.exe
        set "NODE_CMD=portable\node\node.exe"
        
        REM Check for npm variants
        if exist "portable\node\npm.cmd" (
            set "NPM_CMD=portable\node\npm.cmd"
            echo ✅ Found npm.cmd
        ) else if exist "portable\node\npm" (
            set "NPM_CMD=portable\node\npm"
            echo ✅ Found npm
        ) else if exist "portable\node\npm.bat" (
            set "NPM_CMD=portable\node\npm.bat"
            echo ✅ Found npm.bat
        ) else (
            echo ❌ npm not found in portable directory
            echo ℹ️  Contents of portable\node\:
            if exist "portable\node\" (
                dir /b "portable\node\"
            ) else (
                echo    Directory does not exist
            )
            pause
            exit /b 1
        )
        
        for /f "tokens=*" %%i in ('portable\node\node.exe --version') do set NODE_VERSION=%%i
        echo ✅ Portable Node.js version: !NODE_VERSION!
    ) else (
        echo ❌ portable\node\node.exe not found
        echo ℹ️  Current directory contents:
        dir /b
        echo.
        echo ℹ️  Checking if portable directory exists:
        if exist "portable\" (
            echo ✅ portable\ directory exists
            echo ℹ️  Contents of portable\:
            dir /b "portable\"
        ) else (
            echo ❌ portable\ directory does not exist
        )
        pause
        exit /b 1
    )
)

echo.
echo 🎉 Node.js Detection Results:
echo ==============================
echo Node.js Command: !NODE_CMD!
echo NPM Command: !NPM_CMD!
echo Version: !NODE_VERSION!
echo.

echo ℹ️  Testing Node.js execution...
!NODE_CMD! --version
if errorlevel 1 (
    echo ❌ Failed to execute Node.js
) else (
    echo ✅ Node.js execution successful
)

echo.
echo ℹ️  Testing NPM execution...
!NPM_CMD! --version
if errorlevel 1 (
    echo ❌ Failed to execute NPM
) else (
    echo ✅ NPM execution successful
)

echo.
echo ✅ Node.js detection test completed!
echo.
pause
