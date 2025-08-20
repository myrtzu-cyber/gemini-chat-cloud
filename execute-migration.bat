@echo off
echo 🚀 EXECUTANDO MIGRAÇÃO DIRETA
echo ================================

echo.
echo 📊 Conectando ao PostgreSQL do Render...
echo.

REM Executar SQL via PowerShell e Invoke-RestMethod para PostgreSQL
powershell -Command "
$connectionString = 'postgresql://gemini_user:G0RKN3hY6K3C2bUDTjCs1PI6itVYTTbA@dpg-d2ivltruibrs73abk0h0-a.oregon-postgres.render.com/gemini_chat'
$sqlFile = Get-Content -Path 'migration.sql' -Raw

Write-Host '📝 SQL a ser executado:'
Write-Host $sqlFile

Write-Host ''
Write-Host '⚠️  Para executar no PostgreSQL:'
Write-Host '1. Acesse dashboard.render.com'
Write-Host '2. Clique no database gemini-chat-db'
Write-Host '3. Clique em Connect'
Write-Host '4. Cole o SQL acima'
Write-Host '5. Execute'
"

echo.
echo ✅ Instruções exibidas!
echo 💡 Consulte o arquivo migration.sql para o SQL completo
pause
