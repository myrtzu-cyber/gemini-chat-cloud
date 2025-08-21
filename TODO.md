# TODO - Correção do Problema de Duplicação de Conversas

## Problema Identificado
Ao enviar uma mensagem em uma conversa existente, o sistema está duplicando a conversa ou criando uma nova conversa em vez de manter a mensagem na conversa atual.

## Análise Realizada
- ✅ Analisado mobile-script.js (frontend mobile)
- ✅ Analisado script.js (frontend desktop para comparação)
- ✅ Analisado backend/server-cloud.js (API endpoints)
- ✅ Identificados problemas específicos na lógica de gerenciamento de conversas

## Problemas Específicos Encontrados

### 1. Método sendMessage() (linha ~1089)
- ❌ Gera novo chatId mesmo quando já existe conversa ativa
- ❌ Não verifica adequadamente o estado da conversa atual
- ❌ Lógica: `if (!this.currentChatId) { this.currentChatId = this.generateChatId(); }`

### 2. Método ensureChatExists() (linha ~1259)
- ❌ Pode estar criando conversas duplicadas
- ❌ Lógica de verificação pode estar falhando
- ❌ Não trata adequadamente casos onde chat já existe

### 3. Método autoSaveChat() (linha ~1189)
- ❌ Pode estar salvando conversas como novas quando deveria atualizar existentes
- ❌ Filtro de mensagens pode estar causando problemas
- ❌ Lógica de geração de ID pode estar sobrescrevendo IDs existentes

### 4. Método newChat() (linha ~1006)
- ❌ Pode não estar limpando adequadamente o estado anterior

## Correções a Implementar

### ✅ CONCLUÍDO
- [x] Criar TODO.md para rastreamento
- [x] Analisar código existente
- [x] Identificar problemas específicos
- [x] Corrigir método sendMessage()
- [x] Corrigir método ensureChatExists()
- [x] Corrigir método autoSaveChat()
- [x] Melhorar método newChat()
- [x] Adicionar logs de debug

### 🔄 EM ANDAMENTO
- [ ] Testar correções
- [ ] Fazer commit e push para git

### 📋 PENDENTE
- [ ] Testes de integração
- [ ] Verificação de compatibilidade com backend
- [ ] Documentação das mudanças

## Estratégia de Correção

1. **Melhorar verificação de conversa existente**
   - Verificar se currentChatId já existe antes de criar novo
   - Melhorar lógica de sincronização com servidor

2. **Corrigir lógica de geração de IDs**
   - Não gerar novo ID se já existe conversa ativa
   - Preservar IDs existentes durante operações

3. **Implementar melhor sincronização entre frontend e backend**
   - Verificar estado no servidor antes de criar nova conversa
   - Melhorar tratamento de erros de sincronização

4. **Adicionar logs de debug para rastreamento**
   - Logs detalhados para identificar fluxo de criação de conversas
   - Rastreamento de IDs de conversa

## Arquivos a Modificar
- `mobile-script.js` (principal)
- Possíveis ajustes menores no backend se necessário

## Status Atual
🔄 **EM ANDAMENTO** - Implementando correções no mobile-script.js
