# 🚀 Script de Migração Completo - Mestre Gemini
# ===============================================

Write-Host "🚀 INICIANDO MIGRAÇÃO PARA RENDER" -ForegroundColor Green
Write-Host "=================================" -ForegroundColor Green
Write-Host ""

# Configuração
$APP_URL = "https://gemini-chat-cloud.onrender.com"
$TIMEOUT = 30

Write-Host "🔗 URL do App: $APP_URL" -ForegroundColor Cyan
Write-Host ""

# Função para testar se app está online
function Test-AppOnline {
    param($url)
    try {
        Write-Host "🧪 Testando se app está online..." -ForegroundColor Yellow
        $response = Invoke-WebRequest -Uri "$url/api/health" -TimeoutSec $TIMEOUT -ErrorAction Stop
        if ($response.StatusCode -eq 200) {
            Write-Host "✅ App está online e respondendo!" -ForegroundColor Green
            return $true
        }
    }
    catch {
        Write-Host "❌ App não está respondendo: $($_.Exception.Message)" -ForegroundColor Red
        return $false
    }
    return $false
}

# Função para migrar chat
function Migrate-Chat {
    param($chatData)
    try {
        Write-Host "📤 Migrando chat: $($chatData.title)" -ForegroundColor Cyan
        $jsonBody = $chatData | ConvertTo-Json -Compress
        
        $response = Invoke-RestMethod -Uri "$APP_URL/api/chats" -Method POST -ContentType "application/json" -Body $jsonBody -TimeoutSec $TIMEOUT
        
        Write-Host "✅ Chat migrado com sucesso: $($chatData.title)" -ForegroundColor Green
        return $true
    }
    catch {
        Write-Host "❌ Erro ao migrar chat $($chatData.title): $($_.Exception.Message)" -ForegroundColor Red
        return $false
    }
}

# Verificar se app está online
if (-not (Test-AppOnline -url $APP_URL)) {
    Write-Host ""
    Write-Host "⚠️  INSTRUÇÕES:" -ForegroundColor Yellow
    Write-Host "1. Verifique se o deploy no Render foi concluído"
    Write-Host "2. Acesse $APP_URL para confirmar"
    Write-Host "3. Execute este script novamente quando o app estiver online"
    Write-Host ""
    Read-Host "Pressione Enter para sair"
    exit 1
}

Write-Host ""
Write-Host "📊 INICIANDO MIGRAÇÃO DE DADOS" -ForegroundColor Green
Write-Host "==============================" -ForegroundColor Green
Write-Host ""

# Dados para migrar
$chatsToMigrate = @(
    @{
        id = "b9xzyx67w"
        title = "Mestre"
        model = "gemini-2.5-pro"
        messages = @()
    }
)

$successCount = 0
$errorCount = 0

# Migrar cada chat
foreach ($chat in $chatsToMigrate) {
    if (Migrate-Chat -chatData $chat) {
        $successCount++
    } else {
        $errorCount++
    }
    Start-Sleep -Seconds 1
}

Write-Host ""
Write-Host "📊 RELATÓRIO DE MIGRAÇÃO" -ForegroundColor Green
Write-Host "========================" -ForegroundColor Green
Write-Host "✅ Chats migrados: $successCount" -ForegroundColor Green
Write-Host "❌ Erros: $errorCount" -ForegroundColor $(if ($errorCount -eq 0) { "Green" } else { "Red" })
Write-Host "📝 Total de chats: $($chatsToMigrate.Count)" -ForegroundColor Cyan

if ($successCount -gt 0) {
    Write-Host ""
    Write-Host "🎉 MIGRAÇÃO CONCLUÍDA COM SUCESSO!" -ForegroundColor Green
    Write-Host ""
    Write-Host "🌐 Acesse seu app: $APP_URL" -ForegroundColor Cyan
    Write-Host "📱 Versão mobile: $APP_URL/mobile.html" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "✅ Seus dados foram migrados e já estão disponíveis no app!"
} else {
    Write-Host ""
    Write-Host "❌ MIGRAÇÃO FALHOU" -ForegroundColor Red
    Write-Host "💡 Verifique se o app está funcionando corretamente"
}

Write-Host ""
Read-Host "Pressione Enter para finalizar"
