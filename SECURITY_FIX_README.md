# 🔐 CORREÇÃO DE SEGURANÇA - CREDENCIAIS EXPOSTAS

## ⚠️ PROBLEMA IDENTIFICADO
Foram encontradas credenciais PostgreSQL expostas em arquivos commitados no repositório:

- `execute-migration.bat` (linha 11)
- `backend/migrate-via-api.js` (linha 13)

## ✅ CORREÇÕES APLICADAS

### 1. Credenciais removidas dos arquivos
- Substituídas por variáveis de ambiente (`$env:DATABASE_URL` e `process.env.DATABASE_URL`)

### 2. Arquivo `.gitignore` criado
- Adicionada proteção para arquivos `.env` e dados sensíveis

### 3. Arquivo `.env.example` criado
- Template para configuração local sem credenciais reais

## 🚨 AÇÕES URGENTES NECESSÁRIAS

### 1. **ROTACIONAR CREDENCIAIS IMEDIATAMENTE**
```bash
# No painel do Render.com:
1. Acesse seu banco PostgreSQL
2. Vá em "Settings" → "Rotate Password"
3. Gere uma nova senha
4. Atualize a variável DATABASE_URL no seu app
```

### 2. **Configurar variáveis de ambiente**
No Render.com (ou sua plataforma de deploy):
```
DATABASE_URL=postgresql://nova_senha_aqui
```

### 3. **Limpar histórico do Git (opcional mas recomendado)**
```bash
# CUIDADO: Isso reescreve o histórico do Git
git filter-branch --force --index-filter \
  'git rm --cached --ignore-unmatch execute-migration.bat backend/migrate-via-api.js' \
  --prune-empty --tag-name-filter cat -- --all

# Forçar push (PERIGOSO em repos compartilhados)
git push origin --force --all
```

### 4. **Para desenvolvimento local**
```bash
# Copie o template
cp .env.example .env

# Edite com suas credenciais locais
nano .env
```

## 📋 CHECKLIST DE SEGURANÇA

- [x] Credenciais removidas dos arquivos de código
- [x] Variáveis de ambiente implementadas
- [x] .gitignore criado para prevenir futuras exposições
- [ ] **PENDENTE: Rotacionar senha do banco de dados**
- [ ] **PENDENTE: Atualizar variáveis de ambiente no deploy**
- [ ] **PENDENTE: Verificar se o app ainda funciona**

## 🛡️ PREVENÇÃO FUTURA

1. **Sempre use variáveis de ambiente** para dados sensíveis
2. **Nunca commite** arquivos `.env`
3. **Revise commits** antes de fazer push
4. **Use ferramentas** como git-secrets ou pre-commit hooks

## 📞 SUPORTE

Se precisar de ajuda com a rotação de credenciais ou configuração:
- Documentação do Render: https://render.com/docs/databases
- Suporte do GitHub: https://github.com/settings/security-analysis
