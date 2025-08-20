# 🧪 Teste Rápido de Migração
# ==========================

$APP_URL = "https://gemini-chat-cloud.onrender.com"

Write-Host "🧪 TESTE RÁPIDO DE MIGRAÇÃO" -ForegroundColor Yellow
Write-Host "============================" -ForegroundColor Yellow
Write-Host ""

# Teste 1: App online?
Write-Host "1. Testando se app está online..." -ForegroundColor Cyan
try {
    $health = Invoke-RestMethod -Uri "$APP_URL/api/health" -TimeoutSec 10
    Write-Host "✅ App online: $($health | ConvertTo-Json)" -ForegroundColor Green
} catch {
    Write-Host "❌ App offline ou não responde" -ForegroundColor Red
    Write-Host "💡 URL esperada: $APP_URL" -ForegroundColor Yellow
    exit 1
}

# Teste 2: Endpoint de chats disponível?
Write-Host ""
Write-Host "2. Testando endpoint de chats..." -ForegroundColor Cyan
try {
    $chats = Invoke-RestMethod -Uri "$APP_URL/api/chats" -TimeoutSec 10
    Write-Host "✅ Endpoint funcionando. Chats existentes: $($chats.Count)" -ForegroundColor Green
} catch {
    Write-Host "❌ Endpoint de chats não responde" -ForegroundColor Red
    exit 1
}

# Teste 3: Migrar chat de teste
Write-Host ""
Write-Host "3. Migrando chat de teste..." -ForegroundColor Cyan

$testChat = @{
    id = "b9xzyx67w"
    title = "Mestre"
    model = "gemini-2.5-pro"
    messages = @()
} | ConvertTo-Json

try {
    $result = Invoke-RestMethod -Uri "$APP_URL/api/chats" -Method POST -ContentType "application/json" -Body $testChat -TimeoutSec 10
    Write-Host "✅ Chat migrado com sucesso!" -ForegroundColor Green
    Write-Host "📊 Resultado: $($result | ConvertTo-Json)" -ForegroundColor Cyan
} catch {
    Write-Host "❌ Erro na migração: $($_.Exception.Message)" -ForegroundColor Red
    
    # Se for erro 409 (conflito), chat já existe
    if ($_.Exception.Response.StatusCode -eq 409) {
        Write-Host "💡 Chat já existe no banco (isso é normal)" -ForegroundColor Yellow
    }
}

Write-Host ""
Write-Host "🎉 TESTE CONCLUÍDO!" -ForegroundColor Green
Write-Host "🌐 Acesse: $APP_URL" -ForegroundColor Cyan
