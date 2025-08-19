# 🏢 Guia de Deployment Corporativo

## 🚨 Problema Identificado
Ambiente corporativo com restrições que impedem instalação de dependências npm:
- Firewall/proxy bloqueando registry npm
- Falta de privilégios administrativos
- Políticas de segurança corporativa
- Restrições de rede

## ✅ Soluções Disponíveis

### **Opção 1: Servidor Python (RECOMENDADO)**
**Por que usar:** Já funciona, sem dependências externas

```bash
# Testar localmente
python server_python.py

# Acessar em: http://localhost:8080
```

**Vantagens:**
- ✅ Funciona imediatamente
- ✅ SQLite integrado
- ✅ Todas as funcionalidades disponíveis
- ✅ Sem necessidade de npm

### **Opção 2: Node.js Mínimo**
**Por que usar:** Se você preferir Node.js mas sem dependências

```bash
# Usar o servidor mínimo criado
cd backend
..\portable\node\node.exe server-minimal.js
```

**Características:**
- ✅ Apenas módulos nativos do Node.js
- ✅ Banco de dados em memória
- ⚠️ Dados perdidos ao reiniciar (desenvolvimento apenas)

### **Opção 3: Deployment Direto na Nuvem**
**Por que usar:** Evitar problemas locais, usar cloud diretamente

## 🚀 Deployment na Nuvem (Sem NPM Local)

### **Passo 1: Preparar Arquivos**
Execute o script corporativo:
```bash
deploy-corporate.bat
```

### **Passo 2: Upload para GitHub**

**Se Git estiver disponível:**
```bash
git add .
git commit -m "Corporate deployment ready"
git push origin main
```

**Se Git estiver bloqueado:**
1. Acesse GitHub.com no navegador
2. Faça upload manual dos arquivos
3. Use a interface web para criar repositório

### **Passo 3: Escolher Plataforma**

#### **Railway (Recomendado)**
1. Acesse: https://railway.app
2. Conecte com GitHub
3. Selecione seu repositório
4. Configure:
   - **Start Command:** `node server-minimal.js`
   - **Root Directory:** `backend`
   - **Environment:** `NODE_ENV=production`

#### **Render**
1. Acesse: https://render.com
2. Conecte repositório GitHub
3. Configure:
   - **Build Command:** `echo "No build needed"`
   - **Start Command:** `node server-minimal.js`
   - **Environment:** Node

#### **Heroku**
1. Acesse: https://heroku.com
2. Conecte repositório GitHub
3. Use o `Procfile` criado automaticamente

### **Passo 4: Configurar Variáveis de Ambiente**
```env
NODE_ENV=production
PORT=(automático)
```

## 🔧 Configurações NPM Alternativas

Se quiser tentar resolver o problema npm:

### **Configurar Proxy Corporativo**
```bash
# Execute o script de configuração
configure-npm-corporate.bat

# Ou configure manualmente:
npm config set proxy http://proxy-server:port
npm config set https-proxy http://proxy-server:port
npm config set registry https://registry.npmmirror.com/
npm config set strict-ssl false
```

### **Registries Alternativos**
```bash
# Taobao (China/Ásia)
npm config set registry https://registry.npmmirror.com/

# Yarn Registry
npm config set registry https://registry.yarnpkg.com/

# Voltar ao original
npm config set registry https://registry.npmjs.org/
```

### **Instalação Manual**
```bash
# Execute o script de instalação manual
install-dependencies-manual.bat
```

## 🎯 Estratégia Recomendada

### **Para Desenvolvimento Local:**
1. **Use o servidor Python** - `python server_python.py`
2. Funciona imediatamente, sem complicações
3. Todas as funcionalidades disponíveis

### **Para Deployment na Nuvem:**
1. **Use o servidor Node.js mínimo** - melhor compatibilidade cloud
2. Upload direto para GitHub (web interface se necessário)
3. Deploy no Railway ou Render

### **Fluxo Completo:**
```
Desenvolvimento Local (Python) → GitHub → Cloud (Node.js Mínimo)
```

## 🔍 Troubleshooting

### **NPM Ainda Não Funciona?**
- Use `deploy-corporate.bat` opção 1 (Python)
- Ou opção 3 (deployment direto)

### **Git Bloqueado?**
- Use interface web do GitHub
- Faça upload manual dos arquivos

### **Proxy Corporativo?**
- Execute `configure-npm-corporate.bat`
- Consulte TI sobre configurações de proxy

### **Sem Permissões?**
- Use servidor Python (não precisa instalar nada)
- Ou faça deployment direto na nuvem

## 📞 Suporte

### **Testando Soluções:**
```bash
# Testar Python
python server_python.py

# Testar Node.js mínimo
cd backend && ..\portable\node\node.exe server-minimal.js

# Testar configuração npm
configure-npm-corporate.bat
```

### **Verificar Status:**
- **Python:** http://localhost:8080
- **Node.js:** http://localhost:3000
- **Health Check:** /api/health

## 🎉 Resultado Final

Independente das restrições corporativas, você terá:
- ✅ Aplicação funcionando localmente
- ✅ Deployment na nuvem disponível
- ✅ Acesso global via HTTPS
- ✅ Todas as funcionalidades do Gemini Chat

**Próximo passo:** Execute `deploy-corporate.bat` e escolha a melhor opção para seu ambiente!
