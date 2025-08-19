# 🗄️ Database Setup Guide - Gemini Chat

## 1. Identificação do Database Atual

### Verificar qual servidor você está usando:

#### **Opção A: Python Server (SQLite)**
```bash
# Verificar se existe arquivo de database
ls -la database/
# ou no Windows:
dir database\

# Verificar se o servidor Python está rodando
python server_python.py
```

**Indicadores do Python Server:**
- ✅ Arquivo `database/chats.db` existe
- ✅ Logs mostram "Database initialized successfully"
- ✅ Dados persistem entre restarts

#### **Opção B: Node.js Minimal (In-Memory)**
```bash
# Verificar se está usando servidor mínimo
cd backend
node server-minimal.js
```

**Indicadores do Node.js Minimal:**
- ✅ Logs mostram "🚀 Servidor Node.js Mínimo Iniciado"
- ⚠️ Dados perdidos ao reiniciar
- ⚠️ Arrays em memória apenas

## 2. Configuração Local Recomendada

### **Para Desenvolvimento Local: Python + SQLite**
```bash
# Usar o servidor Python (mais robusto)
python server_python.py
```

### **Para Cloud Deploy: Node.js Minimal + PostgreSQL**
```bash
# Usar servidor mínimo com database externo
cd backend
node server-minimal.js
```

## 3. Estrutura de Database

### **Schema SQLite (Python Server):**
```sql
CREATE TABLE IF NOT EXISTS chats (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    model TEXT DEFAULT 'gemini-pro',
    messages TEXT DEFAULT '[]',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    chat_id TEXT NOT NULL,
    role TEXT NOT NULL,
    content TEXT NOT NULL,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (chat_id) REFERENCES chats (id)
);
```

### **Schema In-Memory (Node.js Minimal):**
```javascript
// Arrays em memória
let chatsDatabase = [
    {
        id: "string",
        title: "string", 
        model: "string",
        messages: [],
        created_at: "ISO string",
        updated_at: "ISO string"
    }
];

let messagesDatabase = [
    {
        id: "number",
        chat_id: "string",
        role: "user|assistant",
        content: "string",
        timestamp: "ISO string"
    }
];
```
