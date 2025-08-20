# 🚀 Guia de Migração de Dados para Render PostgreSQL

Este guia explica como migrar seus dados locais para o PostgreSQL no Render de forma segura.

## 📋 Scripts Disponíveis

### 1. `check-migration-data.js` - Verificação de Dados
Analisa os dados locais antes da migração.

### 2. `migrate-simple.js` - Migração Simples (Recomendado)
Migra dados JSON sem dependências externas.

### 3. `migrate-to-render.js` - Migração Completa
Migra dados de SQLite e JSON (requer sqlite3).

## 🔍 Passo 1: Verificar Dados Locais

Primeiro, vamos verificar quais dados você tem disponíveis:

```bash
# Verificação simples (sem SQLite)
.\portable\node\node.exe -e "
const fs = require('fs');
const sources = [
    './backend/simple-db-data.json',
    './simple-db-data.json', 
    './backend/simple-db-data-backup.json'
];
console.log('🔍 Procurando dados locais...');
sources.forEach(path => {
    if (fs.existsSync(path)) {
        const data = JSON.parse(fs.readFileSync(path, 'utf8'));
        console.log(\`✅ \${path}: \${data.chats?.length || 0} chats, \${data.messages?.length || 0} mensagens\`);
    } else {
        console.log(\`❌ \${path}: não encontrado\`);
    }
});
"
```

### Se você tem SQLite instalado:
```bash
.\portable\node\node.exe check-migration-data.js
```

## 🚀 Passo 2: Executar Migração

### Opção A: Migração Simples (Recomendada)
Para dados JSON simples:

```bash
.\portable\node\node.exe migrate-simple.js
```

### Opção B: Migração Completa
Se você tem SQLite e quer migrar todos os tipos de dados:

```bash
# Primeiro instale o sqlite3 se necessário
npm install sqlite3

# Depois execute a migração completa
.\portable\node\node.exe migrate-to-render.js
```

## 📊 O que os Scripts Fazem

### ✅ Verificações de Segurança
1. **Health Check**: Verifica se o Render está funcionando
2. **Backup Automático**: Faz backup dos dados atuais do Render
3. **Verificação de Duplicatas**: Evita migrar dados duplicados

### 📁 Fontes de Dados Suportadas
- `./backend/simple-db-data.json` - Dados do SimpleDatabase
- `./simple-db-data.json` - Backup do SimpleDatabase
- `./database/chats.db` - Banco SQLite principal
- `./chats.db` - Backup do SQLite

### 🔄 Processo de Migração
1. **Backup**: Salva dados atuais do Render
2. **Análise**: Carrega e analisa dados locais
3. **Migração**: Envia dados em lotes pequenos
4. **Verificação**: Confirma que dados foram migrados
5. **Relatório**: Gera relatório detalhado

## 📋 Exemplo de Execução

```bash
# Executar migração simples
.\portable\node\node.exe migrate-simple.js
```

**Saída esperada:**
```
🚀 MIGRAÇÃO SIMPLES PARA RENDER
========================================
🏥 Verificando Render...
✅ Render está funcionando
💾 Fazendo backup dos dados atuais do Render...
✅ Backup salvo: ./migration-backups/render-backup-2025-08-20T05-00-00-000Z.json
📊 Dados atuais: 3 chats
🔍 Procurando dados JSON locais...
✅ Encontrado: ./backend/simple-db-data.json
📊 Encontrados 2 chats
📝 Total de mensagens: 5
📋 Chats encontrados:
   1. "Chat de Teste" (2 mensagens)
   2. "Conversa Importante" (3 mensagens)

🔄 Migrando 2 chats...
📤 Migrando: "Chat de Teste"
   ⚠️ Chat já existe, pulando...
📤 Migrando: "Conversa Importante"
   ✅ Migrado com sucesso (3 mensagens)

📊 RELATÓRIO:
✅ Chats migrados: 1
✅ Mensagens migradas: 3
❌ Erros: 0

📈 ESTADO FINAL:
   Chats no Render: 4
   Mensagens no Render: 10

🎉 MIGRAÇÃO CONCLUÍDA!
```

## 🗂️ Arquivos Gerados

### Backups Automáticos
- `./migration-backups/render-backup-[timestamp].json` - Backup dos dados do Render
- `./migration-backups/migration-report-[timestamp].json` - Relatório da migração

### Logs
Todos os scripts geram logs detalhados no console para acompanhar o progresso.

## ⚠️ Importante

### Antes da Migração
1. **Confirme que o Render está funcionando** corretamente
2. **Verifique se há dados locais** para migrar
3. **Tenha certeza de que quer migrar** os dados

### Durante a Migração
1. **Não interrompa o processo** - deixe terminar
2. **Monitore os logs** para ver o progresso
3. **Aguarde o relatório final** antes de verificar

### Após a Migração
1. **Verifique os dados** no Render
2. **Teste a aplicação** para confirmar que tudo funciona
3. **Mantenha os backups** por segurança

## 🔧 Solução de Problemas

### Erro: "Cannot find module 'sqlite3'"
```bash
# Use a migração simples em vez da completa
.\portable\node\node.exe migrate-simple.js
```

### Erro: "Render não está respondendo"
```bash
# Verifique se o Render está funcionando
.\portable\node\node.exe verify-render-fix.js
```

### Erro: "Nenhum dado encontrado"
```bash
# Verifique manualmente os arquivos
dir backend\simple-db-data.json
dir simple-db-data.json
```

### Dados duplicados
Os scripts automaticamente detectam e pulam dados que já existem no Render.

## 🎯 Verificação Final

Após a migração, execute:

```bash
# Verificar se tudo funcionou
.\portable\node\node.exe test-chat-loading-fix.js

# Verificar estatísticas
.\portable\node\node.exe verify-render-fix.js
```

## 📞 Suporte

Se encontrar problemas:
1. Verifique os logs de erro no console
2. Consulte os arquivos de backup gerados
3. Execute os scripts de verificação para diagnosticar

---

**🎉 Boa sorte com a migração!**
