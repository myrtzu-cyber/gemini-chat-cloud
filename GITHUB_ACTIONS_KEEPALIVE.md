# 🔄 GitHub Actions Keep-Alive (Ativo)

## ✅ **Sistema Atual Funcionando**

O repositório já possui um **workflow GitHub Actions** configurado que mantém o app acordado automaticamente.

### **📁 Arquivo:** `.github/workflows/keep-alive.yml`

### **⏰ Configuração Atual:**
- ✅ **Frequência**: A cada 14 minutos (`*/14 * * * *`)
- ✅ **Endpoint**: `/api/health` e `/keep-alive`
- ✅ **Backup**: Tentativas múltiplas se falhar
- ✅ **Monitoramento**: Logs detalhados do GitHub Actions

## 🚀 **Como Funciona:**

### **1. Execução Automática:**
```yaml
schedule:
  - cron: '*/14 * * * *'  # A cada 14 minutos
```

### **2. Ping de Saúde:**
```bash
# Ping principal
curl -s "$RENDER_URL/api/health"

# Ping na página principal
curl -s "$RENDER_URL/"

# Obter estatísticas
curl -s "$RENDER_URL/api/stats"
```

### **3. Recuperação Automática:**
```bash
# Se app estiver dormindo, tenta acordar 3 vezes
for i in {1..3}; do
  curl -s "$RENDER_URL/api/health"
  sleep 10
done
```

## 📊 **Monitoramento:**

### **Onde Ver os Logs:**
1. **GitHub** → Seu repositório
2. **Actions** tab
3. **Keep App Awake - Auto Ping** workflow
4. **Clique na execução** mais recente

### **Logs Típicos:**
```
🌅 Keep-alive ping triggered...
✅ App is alive! Response: 200
📱 Main page response: 200
📊 App stats: {...}
✅ On-demand wake-up completed
```

## 🔧 **Configuração Atual:**

### **URLs Configuradas:**
```bash
RENDER_URL="https://gemini-chat-cloud.onrender.com"
```

### **Endpoints Testados:**
- ✅ `/api/health` - Health check principal
- ✅ `/` - Página principal
- ✅ `/api/stats` - Estatísticas (se disponível)
- ✅ `/keep-alive` - Endpoint específico para keep-alive

## 💡 **Vantagens do GitHub Actions:**

### **✅ Gratuito:**
- 2.000 minutos/mês para repositórios públicos
- Workflow de 14min usa ~90 minutos/mês

### **✅ Confiável:**
- Execução em servidores GitHub
- Redundância automática
- Logs detalhados

### **✅ Sem Configuração Externa:**
- Não precisa UptimeRobot
- Não precisa self-ping interno
- Gerenciado pelo próprio GitHub

## 🎯 **Status Atual:**

- ✅ **Workflow ativo** e funcionando
- ✅ **14 minutos** de intervalo (perfeito para Render)
- ✅ **Endpoint `/keep-alive`** disponível
- ✅ **Logs no GitHub Actions**
- ✅ **Backup automático** incluído

## 🔍 **Como Verificar se Está Funcionando:**

### **1. GitHub Actions:**
```
Repositório → Actions → "Keep App Awake - Auto Ping"
```

### **2. Logs do Render:**
```
🏓 Keep-alive ping recebido via GitHub Actions: 2025-08-20T...
```

### **3. Teste Manual:**
```bash
curl "https://gemini-chat-cloud.onrender.com/keep-alive"
```

## ⚙️ **Configurações Opcionais:**

### **Trigger Manual:**
Você pode executar o workflow manualmente:
1. GitHub → Actions
2. "Keep App Awake - Auto Ping"
3. "Run workflow"

### **Ajustar Frequência:**
Para mudar o intervalo, edite `.github/workflows/keep-alive.yml`:
```yaml
schedule:
  - cron: '*/10 * * * *'  # A cada 10 minutos
```

---

**🎉 Keep-alive já configurado e funcionando via GitHub Actions! Nenhuma configuração adicional necessária! 🚀**

**O app nunca dormirá com o workflow atual de 14 minutos.**
