# 🚀 Guia de Deploy no Render.com

Este guia detalha como fazer deploy do **Mestre Gemini** no Render.com com PostgreSQL.

## 📋 Pré-requisitos

- ✅ Conta no [Render.com](https://render.com)
- ✅ Repositório GitHub público
- ✅ Chave da API do Google Gemini

## 🗄️ Passo 1: Criar o Banco PostgreSQL

### Via Dashboard Render:

1. **Acesse** [dashboard.render.com](https://dashboard.render.com)
2. **Clique** "New +" → "PostgreSQL"
3. **Configure:**
   - **Name**: `gemini-chat-db`
   - **Database**: `gemini_chat`
   - **User**: `gemini_user`
   - **Region**: `Oregon (US West)`
   - **Plan**: `Free`

4. **Clique** "Create Database"
5. **Aguarde** a criação (2-3 minutos)

### ✅ Verificações:
- Database Status: `Available`
- Connection String: Gerado automaticamente
- SSL: Habilitado

## 🌐 Passo 2: Criar o Web Service

### Via Dashboard Render:

1. **Clique** "New +" → "Web Service"
2. **Conecte** seu repositório: `myrtzu-cyber/gemini-chat-cloud`
3. **Configure:**

```yaml
Name: gemini-chat-cloud
Environment: Node
Build Command: npm install && npm rebuild pg
Start Command: npm run prestart && npm start
Root Directory: backend
```

### 🔧 Configurações Avançadas:

```yaml
# Build Settings
Auto-Deploy: Yes
Branch: main
Node Version: 18
Region: Oregon (US West)
Plan: Free

# Health Check
Health Check Path: /api/health
```

## 🔐 Passo 3: Configurar Variáveis de Ambiente

No painel do Web Service, vá em **Environment** e adicione:

### Obrigatórias:
```bash
NODE_ENV=production
DATABASE_URL=[Link to Database: gemini-chat-db]
PORT=10000
```

### Opcionais (Backup Google Drive):
```bash
GOOGLE_DRIVE_CLIENT_ID=your_client_id_here
GOOGLE_DRIVE_CLIENT_SECRET=your_client_secret_here
GOOGLE_DRIVE_REFRESH_TOKEN=your_refresh_token_here
```

### Configurações Extras:
```bash
TZ=America/Sao_Paulo
LOG_LEVEL=info
AUTO_BACKUP_ENABLED=true
BACKUP_INTERVAL_HOURS=24
```

## 🔗 Passo 4: Conectar Database ao Web Service

1. **No Web Service**, vá em **Environment**
2. **Clique** "Add Environment Variable"
3. **Key**: `DATABASE_URL`
4. **Value**: Selecione "From Database" → `gemini-chat-db`
5. **Property**: `Connection String`

## 🚀 Passo 5: Deploy

1. **Salve** as configurações
2. **Deploy** será iniciado automaticamente
3. **Monitore** os logs em tempo real

### Log de Build Esperado:
```bash
🔧 Starting build process...
Node version: v18.x.x
NPM version: x.x.x
npm install --verbose --no-optional
npm rebuild pg --verbose
✅ Build process completed
```

### Log de Start Esperado:
```bash
✅ pg module available
🚀 Servidor iniciado na porta 10000
✅ Database conectado: PostgreSQL
🌐 Servidor rodando: https://seu-app.onrender.com
```

## 🧪 Passo 6: Testes Pós-Deploy

### 1. Health Check:
```bash
curl https://seu-app.onrender.com/api/health
# Resposta esperada: {"status":"ok","database":"connected"}
```

### 2. Teste de Conexão Database:
```bash
# Via SSH no Render (se disponível) ou localmente:
node test-db-connection.js
```

### 3. Teste Frontend:
- Acesse: `https://seu-app.onrender.com`
- Teste: `https://seu-app.onrender.com/mobile.html`

## 📊 Limitações do Plano Free

### Web Service:
- ✅ 750 horas/mês
- ✅ Sleep após 15min inatividade
- ✅ 512MB RAM
- ✅ 0.1 CPU

### PostgreSQL:
- ✅ 1GB storage
- ✅ 90 dias backup retention
- ✅ 97 connections máximo

## ✅ Checklist Final

- [ ] PostgreSQL criado e disponível
- [ ] Web Service configurado
- [ ] Variáveis de ambiente definidas
- [ ] Database conectado ao service
- [ ] Deploy realizado com sucesso
- [ ] Health check respondendo
- [ ] Frontend acessível
- [ ] Mobile funcionando

---

**🎉 Seu Mestre Gemini está no ar! 🚀**
