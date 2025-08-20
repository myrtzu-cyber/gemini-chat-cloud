# 🎲 Mestre Gemini - Sistema D&D

<div align="center">

[![Licença: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/Node.js-18.x-green.svg)](https://nodejs.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Latest-blue.svg)](https://www.postgresql.org/)

**Assistente de RPG D&D com IA Gemini para dispositivos móveis e web**

[🚀 Demo ao Vivo](#) • [📖 Documentação](#documentação) • [🐛 Reportar Bug](../../issues) • [✨ Solicitar Funcionalidade](../../issues)

</div>

## 📖 Sobre o Projeto

O **Mestre Gemini** é um assistente inteligente para mestres e jogadores de RPG D&D (Dungeons & Dragons) que utiliza a poderosa IA Google Gemini para fornecer suporte em tempo real durante as sessões de jogo. O sistema oferece tanto uma interface web quanto uma versão mobile otimizada (PWA).

### ✨ Funcionalidades

- 🤖 **IA Gemini Integrada**: Suporte inteligente com modelos Gemini 2.5 Pro e Flash
- 📱 **Progressive Web App (PWA)**: Funciona como app nativo no mobile
- 💾 **Persistência de Dados**: Sistema de backup automático e manual
- 🌐 **Deploy em Nuvem**: Configurado para Render.com com PostgreSQL
- 🔄 **Sincronização**: Backup automático para Google Drive
- 💬 **Chat Inteligente**: Conversas contextuais sobre D&D
- 🎨 **Interface Moderna**: Design responsivo e intuitivo

## 🚀 Tecnologias Utilizadas

### Frontend
- **HTML5** / **CSS3** / **JavaScript** (Vanilla)
- **PWA** (Progressive Web App)
- **Service Worker** para funcionalidade offline
- **Responsive Design**

### Backend
- **Node.js** 18.x
- **Express.js** - Framework web
- **PostgreSQL** - Banco de dados principal
- **SQLite** - Banco local para desenvolvimento

### Integrações
- **Google Gemini AI** - IA conversacional
- **Google Drive API** - Sistema de backup
- **Render.com** - Deploy e hosting

## 📦 Instalação

### Pré-requisitos

- Node.js 18.x ou superior
- PostgreSQL (para produção)
- Chave de API do Google Gemini
- Conta no Google Cloud (para backup - opcional)

### 🔧 Configuração Local

1. **Clone o repositório**
```bash
git clone https://github.com/seu-usuario/mestre-gemini.git
cd mestre-gemini
```

2. **Instale as dependências do backend**
```bash
cd backend
npm install
```

3. **Configure as variáveis de ambiente**
```bash
# Crie um arquivo .env no diretório backend
cp .env.example .env
```

Edite o arquivo `.env` com suas credenciais:
```env
NODE_ENV=development
DATABASE_URL=postgresql://usuario:senha@localhost:5432/gemini_chat
GOOGLE_DRIVE_CLIENT_ID=seu_client_id
GOOGLE_DRIVE_CLIENT_SECRET=seu_client_secret
```

4. **Execute as migrações do banco**
```bash
npm run migrate
```

5. **Inicie o servidor**
```bash
npm start
```

6. **Abra o navegador**
- Desktop: `http://localhost:3000`
- Mobile: `http://localhost:3000/mobile.html`

## 🌐 Deploy em Produção

O projeto está configurado para deploy automático no Render.com usando o arquivo `render.yaml`.

### Deploy Manual

1. **Fork este repositório**
2. **Conecte sua conta do Render.com**
3. **Configure as variáveis de ambiente no Render**
4. **O deploy será automático via GitHub**

Para mais detalhes, consulte o [Guia de Deploy](ON_DEMAND_DEPLOYMENT_GUIDE.md).

## 📱 Uso

### Como Mestre de D&D

1. **Configure sua chave do Gemini** na interface
2. **Inicie uma nova conversa** sobre sua campanha
3. **Peça ajuda** para criar NPCs, cenários, ou resolver regras
4. **Use o backup automático** para não perder suas conversas

### Como Jogador

1. **Acesse a versão mobile** para usar durante o jogo
2. **Consulte regras** rapidamente
3. **Peça sugestões** para ações do personagem
4. **Mantenha o histórico** de suas aventuras

## 🔒 Segurança

- ✅ Chaves de API armazenadas localmente no navegador
- ✅ Comunicação criptografada (HTTPS)
- ✅ Backup seguro no Google Drive
- ✅ Validação de entrada de dados
- ✅ Headers de segurança configurados

Para reportar vulnerabilidades, consulte [SECURITY.md](SECURITY.md).

## 🤝 Contribuindo

Contribuições são muito bem-vindas! Consulte [CONTRIBUTING.md](CONTRIBUTING.md) para diretrizes detalhadas.

### Processo de Contribuição

1. Fork o projeto
2. Crie uma branch para sua feature (`git checkout -b feature/AmazingFeature`)
3. Commit suas mudanças (`git commit -m 'Add some AmazingFeature'`)
4. Push para a branch (`git push origin feature/AmazingFeature`)
5. Abra um Pull Request

## 📚 Documentação

- [📋 Guia de Migração](docs/MIGRATION_GUIDE.md)
- [🚀 Deploy On-Demand](docs/ON_DEMAND_DEPLOYMENT_GUIDE.md)
- [💾 Persistência de Dados](docs/DATA_PERSISTENCE_SOLUTION.md)
- [😴 Sistema Sleep/Wake](docs/SLEEP_WAKE_AND_BACKUP_GUIDE.md)

## 📄 Licença

Este projeto está licenciado sob a Licença MIT - consulte o arquivo [LICENSE](LICENSE) para detalhes.

## 👥 Autores

- **Seu Nome** - *Desenvolvedor Principal* - [@seu-usuario](https://github.com/seu-usuario)

## 🙏 Agradecimentos

- [Google Gemini](https://ai.google.dev/) pela poderosa IA
- [Render.com](https://render.com/) pelo hosting gratuito
- Comunidade D&D pela inspiração
- Todos os [contribuidores](../../contributors) que ajudaram neste projeto

## 📊 Status do Projeto

- ✅ **Funcional**: Sistema core implementado
- 🔄 **Em Desenvolvimento**: Novas funcionalidades sendo adicionadas
- 📱 **PWA**: Totalmente funcional
- 🌐 **Deploy**: Automatizado via Render.com

---

<div align="center">

**⚔️ Que suas aventuras sejam épicas! ⚔️**

[🔝 Voltar ao topo](#-mestre-gemini---sistema-dd)

</div>
