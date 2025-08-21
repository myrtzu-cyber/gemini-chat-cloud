# Script PowerShell para executar migração SQL no PostgreSQL
# Usando psql via PowerShell

$env:PGPASSWORD = "G0RKN3hY6K3C2bUDTjCs1PI6itVYTTbA"
$host = "dpg-d2ivltruibrs73abk0h0-a.oregon-postgres.render.com"
$username = "gemini_user"
$database = "gemini_chat"
$sqlFile = "complete-migration.sql"

Write-Host "🚀 EXECUTANDO MIGRAÇÃO COMPLETA NO POSTGRESQL" -ForegroundColor Green
Write-Host "=============================================" -ForegroundColor Green
Write-Host ""
Write-Host "📊 Dados a migrar:" -ForegroundColor Yellow
Write-Host "   - Host: $host"
Write-Host "   - Database: $database"
Write-Host "   - User: $username"
Write-Host "   - SQL File: $sqlFile"
Write-Host ""

# Verificar se o arquivo SQL existe
if (-not (Test-Path $sqlFile)) {
    Write-Host "❌ Arquivo $sqlFile não encontrado!" -ForegroundColor Red
    exit 1
}

Write-Host "📁 Arquivo SQL encontrado: $(Get-Item $sqlFile | Select-Object Length, LastWriteTime)" -ForegroundColor Green
Write-Host ""

# Executar migração
Write-Host "🔄 Executando migração..." -ForegroundColor Yellow

try {
    # Comando psql
    $psqlCommand = "psql -h $host -U $username -d $database -f $sqlFile"
    
    Write-Host "Comando: $psqlCommand" -ForegroundColor Cyan
    Write-Host ""
    
    # Executar usando cmd
    cmd /c "psql -h $host -U $username -d $database -f $sqlFile"
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host ""
        Write-Host "✅ MIGRAÇÃO EXECUTADA COM SUCESSO!" -ForegroundColor Green
        Write-Host ""
        
        # Verificar resultados
        Write-Host "🔍 Verificando resultados..." -ForegroundColor Yellow
        $verifyCommand = "psql -h $host -U $username -d $database -c ""SELECT COUNT(*) as total_messages FROM messages WHERE chat_id = 'b9xzyx67w';"""
        cmd /c $verifyCommand
        
    } else {
        Write-Host ""
        Write-Host "❌ ERRO NA MIGRAÇÃO!" -ForegroundColor Red
        Write-Host "Exit code: $LASTEXITCODE"
    }
    
} catch {
    Write-Host "❌ ERRO: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host ""
Write-Host "🎯 PRÓXIMOS PASSOS:" -ForegroundColor Cyan
Write-Host "1. Verificar se psql está instalado: psql --version"
Write-Host "2. Se não estiver, usar método alternativo via API"
Write-Host "3. Testar aplicação em: https://gemini-chat-cloud.onrender.com"
