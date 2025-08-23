# 🤖 UptimeRobot - Keep Alive Gratuito

## 📋 Configuração Rápida

### **1. Criar Conta:**
- Acesse: [uptimerobot.com](https://uptimerobot.com)
- Plano **FREE**: 50 monitores, checagem a cada 5 minutos

### **2. Adicionar Monitor:**
```yaml
Monitor Type: HTTP(s)
Friendly Name: Mestre Gemini Keep-Alive
URL: https://seu-app.onrender.com/keep-alive
Monitoring Interval: 5 minutes
```

### **3. Configurações Avançadas:**
```yaml
HTTP Method: GET
HTTP Headers: (opcional)
  User-Agent: UptimeRobot-KeepAlive
Keyword: "alive"
Alert Contacts: Seu email
```

### **4. Resultado:**
- ✅ Ping a cada 5 minutos
- ✅ Servidor nunca dorme
- ✅ Email se app ficar offline
- ✅ Estatísticas de uptime

---

## 🕐 Cron-Job.org (Alternativa)

### **Configuração:**
```yaml
URL: https://seu-app.onrender.com/keep-alive
Schedule: */10 * * * * (a cada 10 minutos)
Method: GET
Title: Render Keep Alive
```

### **Vantagens:**
- ✅ Totalmente gratuito
- ✅ Configuração mais flexível
- ✅ Múltiplos horários
