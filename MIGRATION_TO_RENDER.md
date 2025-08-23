# 🔄 Migração de Dados: Local → Render PostgreSQL

## 📋 Pré-requisitos

1. ✅ **Database PostgreSQL criado no Render**
2. ✅ **Connection String do Render obtida**
3. ✅ **Dados locais em `chats.db`**

## 🔗 Passo 1: Obter Connection String do Render

### Via Dashboard Render:
1. Acesse [dashboard.render.com](https://dashboard.render.com)
2. Clique no seu **database PostgreSQL**
3. Copie a **"External Database URL"**
4. Formato: `postgresql://user:password@host:port/database`

### Exemplo:
```
postgresql://gemini_user:UmaSenh4Aleat0ria@dpg-cr1234567890-a.oregon-postgres.render.com/gemini_chat
```

## 🛠️ Passo 2: Configurar Ambiente Local

### 1. Instalar Dependências:
```bash
cd backend
npm install pg sqlite3
```

### 2. Configurar Environment:
Crie arquivo `backend/.env` com:
```bash
NODE_ENV=production
DATABASE_URL=sua_connection_string_do_render_aqui
```

## 🚀 Passo 3: Executar Migração

### Migração Interativa (Recomendada):
```bash
cd backend
node migrate-to-render.js
```

### Migração Forçada (Sem Confirmação):
```bash
cd backend
node migrate-to-render.js --force
```

## 📊 Passo 4: Verificar Migração

### 1. Verificar Logs:
```
🚀 MIGRAÇÃO SQLITE → POSTGRESQL RENDER
======================================

✅ Módulo pg disponível
✅ Módulo sqlite3 disponível
📁 Banco SQLite encontrado: ../chats.db
🔗 Conectando ao PostgreSQL...
✅ Conexão PostgreSQL estabelecida
🏗️  Criando tabelas no PostgreSQL...
✅ Tabelas criadas com sucesso
📊 Iniciando migração de dados...
📝 Migrando conversas...
📊 Encontradas 5 conversas
✅ Chat migrado: Conversa sobre D&D (chat-1234)
✅ Chat migrado: Criação de NPCs (chat-5678)

📊 RELATÓRIO DE MIGRAÇÃO
========================
📝 Total de chats: 5
✅ Chats migrados: 5
❌ Erros: 0
🗄️  Total de chats no PostgreSQL: 5

🎉 Migração finalizada!
```

### 2. Teste no Render:
Após deploy, acesse:
- `https://seu-app.onrender.com/api/chats` - Ver chats migrados
- `https://seu-app.onrender.com` - Testar interface

## 🔧 Troubleshooting

### Erro: "DATABASE_URL não configurada"
```bash
# Verificar variável
echo $DATABASE_URL

# Recriar .env
NODE_ENV=production
DATABASE_URL=postgresql://...
```

### Erro: "Módulo pg não disponível"
```bash
cd backend
npm install pg
npm rebuild pg
```

### Erro: "Conexão recusada"
```bash
# Verificar connection string
# Testar connection string no browser ou pgAdmin
# Verificar se database está ativo no Render
```

### Erro: "Chats já existem"
```bash
# O script pula chats existentes automaticamente
# Para recriar tudo, delete dados no PostgreSQL primeiro
```

## 📝 Estrutura de Dados Migrada

### Tabela `chats`:
```sql
id TEXT PRIMARY KEY
title TEXT NOT NULL
model TEXT DEFAULT 'gemini-2.5-pro'
messages JSONB DEFAULT '[]'
created_at TIMESTAMP
updated_at TIMESTAMP
```

### Tabela `messages`:
```sql
id SERIAL PRIMARY KEY
chat_id TEXT REFERENCES chats(id)
role TEXT NOT NULL
content TEXT NOT NULL
message_type TEXT DEFAULT 'text'
file_info JSONB
status TEXT DEFAULT 'sent'
retry_count INTEGER DEFAULT 0
error_message TEXT
created_at TIMESTAMP
```

## ✅ Verificação Final

### 1. Dados Migrados:
- ✅ Todas as conversas preservadas
- ✅ Mensagens mantidas
- ✅ Metadados preservados
- ✅ Timestamps corretos

### 2. App Funcionando:
- ✅ Interface carrega
- ✅ Chats antigos aparecem
- ✅ Novas conversas funcionam
- ✅ Mobile responsivo

### 3. Performance:
- ✅ Carregamento rápido
- ✅ Sem erros no console
- ✅ Database responsivo

---

**🎉 Migração Completa! Seus dados estão seguros no PostgreSQL do Render! 🚀**
