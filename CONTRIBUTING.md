# 🤝 Guia de Contribuição

Obrigado pelo interesse em contribuir com o **Mestre Gemini**! Este documento contém diretrizes para ajudar você a contribuir de forma efetiva.

## 📋 Índice

- [Como Contribuir](#como-contribuir)
- [Reportando Bugs](#reportando-bugs)
- [Sugerindo Funcionalidades](#sugerindo-funcionalidades)
- [Desenvolvendo](#desenvolvendo)
- [Padrões de Código](#padrões-de-código)
- [Processo de Pull Request](#processo-de-pull-request)
- [Configuração de Desenvolvimento](#configuração-de-desenvolvimento)

## 🚀 Como Contribuir

Existem várias maneiras de contribuir com o projeto:

- 🐛 **Reportar bugs** que você encontrou
- 💡 **Sugerir novas funcionalidades** ou melhorias
- 📝 **Melhorar a documentação**
- 🔧 **Corrigir bugs** existentes
- ✨ **Implementar novas funcionalidades**
- 🧪 **Escrever testes**
- 🎨 **Melhorar a interface**

## 🐛 Reportando Bugs

Antes de reportar um bug, verifique se ele já não foi reportado nas [Issues](../../issues).

### Como reportar um bug:

1. **Use o template de bug** ao criar uma nova issue
2. **Seja específico** no título (ex: "Chat não carrega após migration no mobile")
3. **Inclua informações do ambiente**:
   - SO e versão
   - Navegador e versão
   - Versão do Node.js (se aplicável)
4. **Descreva os passos** para reproduzir o bug
5. **Inclua logs de erro** se disponíveis
6. **Anexe screenshots** se relevante

### Template de Bug Report:

```markdown
**Descrição do Bug**
Uma descrição clara e concisa do bug.

**Passos para Reproduzir**
1. Vá para '...'
2. Clique em '...'
3. Faça scroll até '...'
4. Veja o erro

**Comportamento Esperado**
O que você esperava que acontecesse.

**Screenshots**
Se aplicável, adicione screenshots.

**Ambiente:**
 - SO: [ex: Windows 11]
 - Navegador: [ex: Chrome 120]
 - Versão Mobile: [ex: iPhone 14 Pro, Safari]

**Informações Adicionais**
Qualquer outro contexto sobre o problema.
```

## 💡 Sugerindo Funcionalidades

### Antes de sugerir:

1. **Verifique** se a funcionalidade já foi sugerida
2. **Considere** se ela se alinha com os objetivos do projeto
3. **Pense** na experiência do usuário

### Template de Feature Request:

```markdown
**A funcionalidade está relacionada a um problema?**
Uma descrição clara do problema. Ex: Sempre fico frustrado quando [...]

**Solução Proposta**
Uma descrição clara da solução que você gostaria.

**Alternativas Consideradas**
Outras soluções ou funcionalidades que você considerou.

**Contexto Adicional**
Screenshots, mockups, ou qualquer outro contexto.
```

## 🛠 Desenvolvendo

### Configuração Inicial

1. **Fork** o repositório
2. **Clone** seu fork:
```bash
git clone https://github.com/SEU_USUARIO/mestre-gemini.git
cd mestre-gemini
```

3. **Adicione o upstream**:
```bash
git remote add upstream https://github.com/USUARIO_ORIGINAL/mestre-gemini.git
```

4. **Instale dependências**:
```bash
cd backend
npm install
```

5. **Configure ambiente** (copie `.env.example` para `.env`)

### Fluxo de Desenvolvimento

1. **Sincronize** com o upstream:
```bash
git checkout main
git pull upstream main
```

2. **Crie uma branch** para sua funcionalidade:
```bash
git checkout -b feature/nova-funcionalidade
# ou
git checkout -b fix/correcao-bug
```

3. **Desenvolva** sua funcionalidade

4. **Teste** suas mudanças

5. **Commit** suas mudanças:
```bash
git add .
git commit -m "feat: adiciona nova funcionalidade X"
```

6. **Push** para seu fork:
```bash
git push origin feature/nova-funcionalidade
```

7. **Abra um Pull Request**

## 📝 Padrões de Código

### Nomenclatura de Branches

- `feature/nome-da-funcionalidade` - Novas funcionalidades
- `fix/nome-do-bug` - Correções de bugs
- `docs/nome-da-documentacao` - Melhorias na documentação
- `refactor/nome-da-refatoracao` - Refatorações
- `test/nome-do-teste` - Adição de testes

### Padrão de Commits

Usamos o padrão [Conventional Commits](https://www.conventionalcommits.org/):

```
tipo(escopo): descrição

[corpo opcional]

[rodapé opcional]
```

**Tipos:**
- `feat`: Nova funcionalidade
- `fix`: Correção de bug
- `docs`: Mudanças na documentação
- `style`: Mudanças de formatação, sem lógica
- `refactor`: Refatoração de código
- `test`: Adição ou correção de testes
- `chore`: Mudanças de build, configuração, etc.

**Exemplos:**
```bash
feat(chat): adiciona suporte a anexos
fix(database): corrige erro de conexão PostgreSQL
docs(readme): atualiza instruções de instalação
style(frontend): corrige indentação dos arquivos CSS
```

### Padrões JavaScript

- **Indentação**: 2 espaços
- **Aspas**: Simples (`'`) para strings
- **Semicolon**: Obrigatório
- **Camel Case**: Para variáveis e funções
- **Pascal Case**: Para classes e construtores

### Estrutura de Arquivos

```
mestre-gemini/
├── backend/           # Servidor Node.js
│   ├── server-cloud.js
│   ├── package.json
│   └── scripts/
├── frontend/          # Cliente web
│   ├── script.js
│   └── config.js
├── assets/           # Recursos estáticos
├── docs/            # Documentação adicional
└── tests/           # Testes automatizados
```

## 🔄 Processo de Pull Request

### Checklist antes de abrir PR:

- [ ] Código segue os padrões estabelecidos
- [ ] Todos os testes passam
- [ ] Documentação foi atualizada (se necessário)
- [ ] Commit messages seguem o padrão
- [ ] Branch está atualizada com main
- [ ] Funcionalidade foi testada manualmente

### Template de Pull Request:

```markdown
## 📋 Descrição

Breve descrição das mudanças implementadas.

## 🔗 Issue Relacionada

Fixes #(número da issue)

## 🧪 Como foi testado

Descreva os testes realizados:
- [ ] Teste manual no desktop
- [ ] Teste manual no mobile
- [ ] Testes automatizados
- [ ] Teste de integração

## 📱 Screenshots

Se aplicável, inclua screenshots das mudanças visuais.

## ✅ Checklist

- [ ] Meu código segue os padrões do projeto
- [ ] Fiz uma auto-revisão do código
- [ ] Comentei partes complexas do código
- [ ] Atualizei a documentação relevante
- [ ] Meus commits seguem o padrão estabelecido
- [ ] Testei em diferentes navegadores/dispositivos

## 🔍 Tipo de Mudança

- [ ] Bug fix (mudança que corrige um problema)
- [ ] Nova funcionalidade (mudança que adiciona funcionalidade)
- [ ] Breaking change (mudança que pode quebrar funcionalidade existente)
- [ ] Documentação (mudança na documentação)
```

### Revisão de Code

- **Todos os PRs** devem ser revisados antes do merge
- **Pelo menos 1 aprovação** é necessária
- **CI/CD deve passar** todos os testes
- **Conflitos** devem ser resolvidos

## 🧪 Testes

### Executando Testes

```bash
# Testes do backend
cd backend
npm test

# Testes de integração
npm run test:integration

# Testes E2E (se disponíveis)
npm run test:e2e
```

### Adicionando Testes

- **Unit tests**: Para lógica de negócio
- **Integration tests**: Para endpoints da API
- **E2E tests**: Para fluxos completos do usuário

## 📚 Recursos Úteis

- [Documentação do Google Gemini AI](https://ai.google.dev/)
- [Express.js Documentation](https://expressjs.com/)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [PWA Guidelines](https://web.dev/progressive-web-apps/)

## 🆘 Precisa de Ajuda?

- 💬 **Discord**: [Link do Discord da comunidade]
- 📧 **Email**: [email de contato]
- 📖 **Documentação**: Consulte os arquivos `.md` na raiz do projeto
- 🐛 **Issues**: Use as issues do GitHub para dúvidas específicas

## 🙏 Reconhecimento

Todos os contribuidores serão reconhecidos no arquivo [README.md](README.md) e nas releases do projeto.

---

**Obrigado por contribuir com o Mestre Gemini! 🎲⚔️**
