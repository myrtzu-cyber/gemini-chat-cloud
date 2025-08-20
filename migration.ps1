# Script PowerShell para migração
$APP_URL = "https://gemini-chat-cloud.onrender.com"

# Migrar chat: Mestre
$body = '{\"id\":\"b9xzyx67w\",\"title\":\"Mestre\",\"model\":\"gemini-2.5-pro\",\"messages\":[]}'
Invoke-RestMethod -Uri "$APP_URL/api/chats" -Method POST -ContentType "application/json" -Body $body
Start-Sleep -Seconds 1

