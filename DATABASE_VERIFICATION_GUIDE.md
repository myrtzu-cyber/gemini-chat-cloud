# 🗄️ Database Verification Guide

## Endpoints de Teste

### **1. Health Check (Básico):**
```
GET /api/health
```
**Resposta Esperada:**
```json
{
  "status": "ok",
  "timestamp": "2025-08-19T22:30:00.000Z",
  "environment": "minimal-server",
  "message": "Servidor mínimo funcionando sem dependências externas"
}
```

### **2. Stats Endpoint (Database Test):**
```
GET /api/stats
```
**Resposta Esperada:**
```json
{
  "total_chats": 0,
  "total_messages": 0,
  "server_type": "minimal-nodejs"
}
```

### **3. Chats Endpoint (CRUD Test):**
```
GET /api/chats
```
**Resposta Esperada:**
```json
[]
```

## Testes de Funcionalidade Database

### **Teste 1: Criar Chat**
```bash
curl -X POST https://your-app.onrender.com/api/chats \
  -H "Content-Type: application/json" \
  -d '{
    "id": "test-chat-1",
    "title": "Teste de Database",
    "model": "gemini-pro",
    "messages": []
  }'
```

**Resposta Esperada:**
```json
{
  "success": true,
  "message": "Chat saved successfully"
}
```

### **Teste 2: Recuperar Chat**
```bash
curl https://your-app.onrender.com/api/chats/test-chat-1
```

**Resposta Esperada:**
```json
{
  "id": "test-chat-1",
  "title": "Teste de Database",
  "model": "gemini-pro",
  "messages": [],
  "created_at": "2025-08-19T22:30:00.000Z",
  "updated_at": "2025-08-19T22:30:00.000Z"
}
```

### **Teste 3: Listar Todos os Chats**
```bash
curl https://your-app.onrender.com/api/chats
```

**Resposta Esperada:**
```json
[
  {
    "id": "test-chat-1",
    "title": "Teste de Database",
    "model": "gemini-pro",
    "messages": [],
    "created_at": "2025-08-19T22:30:00.000Z",
    "updated_at": "2025-08-19T22:30:00.000Z"
  }
]
```

## Diferenças entre Servidores

### **Python Server (SQLite):**
- **Database:** Arquivo SQLite persistente
- **Localização:** `database/chats.db`
- **Persistência:** Dados mantidos entre restarts
- **Verificação:** Arquivo .db é criado automaticamente

### **Node.js Minimal Server (In-Memory):**
- **Database:** Array em memória
- **Localização:** Variáveis JavaScript
- **Persistência:** Dados perdidos no restart
- **Verificação:** Apenas durante execução

## Indicadores de Database Funcionando

### **✅ Sinais Positivos:**

#### **Python Server:**
```
✅ Arquivo database/chats.db criado
✅ Logs: "Database initialized successfully"
✅ /api/health retorna status ok
✅ /api/stats retorna contadores
```

#### **Node.js Minimal:**
```
✅ Logs: "🚀 Servidor Node.js Mínimo Iniciado"
✅ /api/health retorna status ok
✅ Arrays chatsDatabase e messagesDatabase inicializados
```

### **❌ Sinais de Problema:**

```
❌ /api/health retorna erro 500
❌ /api/chats retorna erro
❌ Logs mostram erros de database
❌ Timeout em requests de API
```

## Scripts de Teste Automatizado

### **Teste Completo via Browser:**
```javascript
// Cole no console do navegador
async function testDatabase() {
  const baseUrl = window.location.origin;
  
  // Teste 1: Health Check
  const health = await fetch(`${baseUrl}/api/health`);
  console.log('Health:', await health.json());
  
  // Teste 2: Stats
  const stats = await fetch(`${baseUrl}/api/stats`);
  console.log('Stats:', await stats.json());
  
  // Teste 3: Criar Chat
  const create = await fetch(`${baseUrl}/api/chats`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      id: 'test-' + Date.now(),
      title: 'Teste Database',
      model: 'gemini-pro'
    })
  });
  console.log('Create:', await create.json());
  
  // Teste 4: Listar Chats
  const list = await fetch(`${baseUrl}/api/chats`);
  console.log('Chats:', await list.json());
}

testDatabase();
```

## Troubleshooting Database

### **Problema: /api/health falha**
**Diagnóstico:**
- Servidor não está rodando
- Rota não configurada corretamente

**Solução:**
- Verificar logs do servidor
- Confirmar que server-minimal.js está sendo usado

### **Problema: Dados não persistem**
**Diagnóstico:**
- Usando Node.js minimal (in-memory)
- Servidor reiniciando frequentemente

**Solução:**
- Para persistência: usar Python server
- Para desenvolvimento: aceitar perda de dados

### **Problema: CORS errors**
**Diagnóstico:**
- Frontend e backend em domínios diferentes
- Headers CORS não configurados

**Solução:**
- Verificar se addCorsHeaders() está sendo chamado
- Testar API diretamente (sem frontend)

## Monitoramento Contínuo

### **Logs para Acompanhar:**
```
✅ "Servidor iniciado na porta X"
✅ "Database initialized"
✅ Requests HTTP com status 200
❌ Errors 500 (problemas de servidor)
❌ Errors 404 (rotas não encontradas)
```

### **Métricas Importantes:**
- Response time das APIs
- Taxa de erro (deve ser < 1%)
- Uptime do serviço
- Uso de memória (Node.js minimal)
