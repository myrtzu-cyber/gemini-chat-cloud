# 🔄 Keep-Alive Automático - 14 Minutos

## ✅ **Sistema Implementado**

### **🏓 Self-Ping Interno (Ativo)**
- ✅ **Intervalo**: 14 minutos
- ✅ **Endpoint**: `/keep-alive`
- ✅ **Inicialização**: Automática após 30 segundos
- ✅ **Logs**: Visíveis nos logs do Render

### **🌐 Endpoints Disponíveis**
- **Keep-Alive**: `https://gemini-chat-cloud.onrender.com/keep-alive`
- **Status**: `https://gemini-chat-cloud.onrender.com/api/status`
- **Health**: `https://gemini-chat-cloud.onrender.com/api/health`

## 🚀 **Funcionamento Automático**

### **Self-Ping Interno:**
```
🔄 Self-ping iniciado: https://gemini-chat-cloud.onrender.com
⏱️  Intervalo: 14 minutos
🏓 Self-ping OK (150ms): 2025-08-20T17:30:00.000Z
```

### **Timeline de Execução:**
- **T+0**: Servidor inicia
- **T+30s**: Self-ping inicializa
- **T+5min**: Primeiro ping interno
- **T+19min**: Segundo ping (14min depois)
- **T+33min**: Terceiro ping
- **E assim por diante...**

## 🤖 **UptimeRobot (Backup Externo)**

Para maior redundância, configure também:

### **1. Acesse UptimeRobot:**
- URL: [uptimerobot.com](https://uptimerobot.com)
- Plano: **Free** (50 monitors)

### **2. Configuração:**
```yaml
Monitor Type: HTTP(s)
Friendly Name: Mestre Gemini Keep-Alive
URL: https://gemini-chat-cloud.onrender.com/keep-alive
Monitoring Interval: 5 minutes
HTTP Method: GET
Keyword: "alive"
```

### **3. Notificações:**
```yaml
Alert Contacts: seu-email@exemplo.com
Alert When: Down
Notification: Email
```

## 📊 **Monitoramento**

### **Logs do Self-Ping:**
```
🔗 Self-ping URL detectada: https://gemini-chat-cloud.onrender.com
🔄 Self-ping iniciado: https://gemini-chat-cloud.onrender.com
⏱️  Intervalo: 14 minutos
🏓 Self-ping OK (120ms): 2025-08-20T17:45:00.000Z
```

### **Endpoint de Status:**
```json
GET /api/status
{
  "status": "ok",
  "timestamp": "2025-08-20T17:45:00.000Z",
  "uptime": {
    "seconds": 3600,
    "minutes": 60,
    "hours": 1
  },
  "environment": "production",
  "database": "connected",
  "keep_alive": "active",
  "ping_interval": "14 minutes"
}
```

## ⚡ **Vantagens do Sistema Duplo**

### **Self-Ping Interno:**
- ✅ **Automático**: Sem configuração externa
- ✅ **Gratuito**: Sem custos adicionais
- ✅ **Confiável**: Roda dentro do próprio app
- ✅ **14 minutos**: Otimizado para Render free

### **UptimeRobot Externo:**
- ✅ **Backup**: Se self-ping falhar
- ✅ **Monitoramento**: Notificações de downtime
- ✅ **5 minutos**: Intervalo mais frequente
- ✅ **Relatórios**: Estatísticas de uptime

## 🔧 **Troubleshooting**

### **Self-Ping Não Funcionando:**
```bash
# Verificar logs no Render
# Procurar por:
🔗 Self-ping URL detectada: ...
🔄 Self-ping iniciado: ...
🏓 Self-ping OK: ...
```

### **App Ainda Dormindo:**
1. **Verificar logs** de self-ping
2. **Confirmar endpoint** `/keep-alive` responde
3. **Adicionar UptimeRobot** como backup
4. **Verificar métricas** no Render

### **Comandos de Teste:**
```powershell
# Testar endpoint keep-alive
Invoke-RestMethod -Uri "https://gemini-chat-cloud.onrender.com/keep-alive"

# Testar status
Invoke-RestMethod -Uri "https://gemini-chat-cloud.onrender.com/api/status"
```

## 📅 **Cronograma de Keep-Alive**

```
Render Free Tier: Sleep após 15 minutos de inatividade
Self-Ping: A cada 14 minutos
UptimeRobot: A cada 5 minutos (backup)

Timeline:
00:00 - App ativo
05:00 - UptimeRobot ping #1
10:00 - UptimeRobot ping #2
14:00 - Self-ping #1 (app evita sleep)
15:00 - UptimeRobot ping #3
20:00 - UptimeRobot ping #4
25:00 - UptimeRobot ping #5
28:00 - Self-ping #2 (app evita sleep)
...

Resultado: App NUNCA dorme!
```

---

**🎉 Keep-Alive de 14 minutos configurado e ativo! Seu app Render não dormirá mais! 🚀**
