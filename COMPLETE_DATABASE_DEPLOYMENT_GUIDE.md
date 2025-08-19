# 🗄️ Guia Completo de Database e Deployment

## 📋 Passo a Passo Completo

### **1. Preparação Local**

#### **A. Identificar Database Atual**
```bash
# Verificar se existe database SQLite
ls -la database/
# ou Windows:
dir database\

# Verificar qual servidor está rodando
python server_python.py  # SQLite persistente
# ou
cd backend && node server-minimal.js  # In-memory
```

#### **B. Exportar Dados Existentes**
```bash
# Executar script de export
python export-database.py

# Resultado: arquivo database_export_YYYYMMDD_HHMMSS.json
```

### **2. Configuração para Cloud**

#### **A. Escolher Servidor Cloud**
- ✅ **Recomendado:** `server-cloud.js` (preparado para PostgreSQL)
- ⚠️ **Alternativa:** `server-minimal.js` (apenas in-memory)

#### **B. Configurar render.yaml**
```yaml
services:
  - type: web
    name: gemini-chat-cloud
    env: node
    startCommand: node server-cloud.js
    rootDir: backend
    envVars:
      - key: NODE_ENV
        value: production
      - key: DATABASE_URL
        fromDatabase:
          name: gemini-chat-db
          property: connectionString

databases:
  - name: gemini-chat-db
    databaseName: gemini_chat
    user: gemini_user
    plan: free
```

### **3. Deploy no Render**

#### **A. Criar Web Service**
1. Acesse: https://render.com
2. "New +" → "Web Service"
3. Conecte repositório: `askelladrpg-maker/gemini-chat-cloud`

#### **B. Configurações Exatas**
```
Name: gemini-chat-cloud
Environment: Node
Region: Oregon (US West)
Branch: main
Root Directory: backend
Build Command: echo "No build needed"
Start Command: node server-cloud.js
Auto-Deploy: Yes
```

#### **C. Criar Database (Opcional)**
1. "New +" → "PostgreSQL"
2. Nome: `gemini-chat-db`
3. Plan: Free
4. Conectar ao Web Service

### **4. Verificação de Funcionamento**

#### **A. Testes Básicos**
```bash
# Testar localmente primeiro
cd backend
node server-cloud.js

# Testar endpoints
curl http://localhost:3000/api/health
curl http://localhost:3000/api/stats
```

#### **B. Testes na Cloud**
```bash
# Usar script de teste
node test-database-persistence.js https://gemini-chat-cloud.onrender.com

# Ou testar manualmente
curl https://gemini-chat-cloud.onrender.com/api/health
```

#### **C. Teste via Browser**
```javascript
// Cole no console do navegador
async function testCloudDatabase() {
    const baseUrl = 'https://gemini-chat-cloud.onrender.com';
    
    // Health check
    const health = await fetch(`${baseUrl}/api/health`);
    console.log('Health:', await health.json());
    
    // Criar chat teste
    const create = await fetch(`${baseUrl}/api/chats`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            id: 'test-' + Date.now(),
            title: 'Teste Cloud',
            model: 'gemini-pro'
        })
    });
    console.log('Create:', await create.json());
    
    // Listar chats
    const list = await fetch(`${baseUrl}/api/chats`);
    console.log('Chats:', await list.json());
}

testCloudDatabase();
```

### **5. Importar Dados (Se Necessário)**

#### **A. Via API**
```bash
# Importar dados do export
curl -X POST https://gemini-chat-cloud.onrender.com/api/import \
  -H "Content-Type: application/json" \
  -d @database_export_20250819_220000.json
```

#### **B. Via Interface**
```javascript
// Upload via browser
const fileInput = document.createElement('input');
fileInput.type = 'file';
fileInput.accept = '.json';
fileInput.onchange = async (e) => {
    const file = e.target.files[0];
    const text = await file.text();
    const data = JSON.parse(text);
    
    const response = await fetch('/api/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    });
    
    console.log('Import result:', await response.json());
};
fileInput.click();
```

### **6. Verificação de Persistência**

#### **A. Indicadores de Sucesso**
- ✅ `/api/health` retorna `database_configured: true`
- ✅ Dados permanecem após restart do serviço
- ✅ `/api/stats` mostra `server_type: "cloud-database"`
- ✅ Chats criados aparecem em `/api/chats`

#### **B. Indicadores de Problema**
- ❌ `server_type: "memory-fallback"`
- ❌ Dados perdidos após restart
- ❌ Erros 500 em endpoints de API
- ❌ `database_configured: false`

### **7. Troubleshooting**

#### **Problema: Database não conecta**
```bash
# Verificar logs no Render
# Procurar por:
# "🔗 DATABASE_URL detectada"
# "💾 Usando database em memória"

# Solução:
# 1. Verificar se DATABASE_URL está configurada
# 2. Confirmar que database PostgreSQL foi criado
# 3. Verificar conexão entre Web Service e Database
```

#### **Problema: Dados não persistem**
```bash
# Verificar se está usando server correto
# Logs devem mostrar: "cloud-database" não "memory-fallback"

# Solução:
# 1. Usar server-cloud.js em vez de server-minimal.js
# 2. Configurar DATABASE_URL
# 3. Criar database PostgreSQL no Render
```

#### **Problema: Import falha**
```bash
# Verificar formato do JSON
# Deve ter estrutura: { "chats": [...], "messages": [...] }

# Solução:
# 1. Usar export-database.py para gerar JSON correto
# 2. Verificar se endpoint /api/import existe
# 3. Testar com dados pequenos primeiro
```

### **8. Monitoramento Contínuo**

#### **A. Endpoints para Monitorar**
```bash
# Health check (deve sempre funcionar)
GET /api/health

# Stats (mostra estado do database)
GET /api/stats

# Lista de chats (verifica dados)
GET /api/chats
```

#### **B. Métricas Importantes**
- Response time < 2 segundos
- Uptime > 99%
- Taxa de erro < 1%
- Database connections estáveis

### **9. Backup e Manutenção**

#### **A. Backup Regular**
```bash
# Exportar dados periodicamente
curl https://gemini-chat-cloud.onrender.com/api/chats > backup_$(date +%Y%m%d).json
```

#### **B. Limpeza de Dados**
```bash
# Remover chats antigos (se necessário)
# Implementar endpoint de limpeza ou fazer manualmente
```

## 🎯 Resultado Final

Após seguir este guia, você terá:
- ✅ **Database configurado** na cloud
- ✅ **Dados persistentes** entre restarts
- ✅ **API funcionando** completamente
- ✅ **Monitoramento** ativo
- ✅ **Backup** dos dados
- ✅ **Aplicação acessível** globalmente

**URL Final:** https://gemini-chat-cloud.onrender.com
