const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const bodyParser = require('body-parser');
const path = require('path');
require('dotenv').config();

// Use PostgreSQL for cloud deployment, fallback to SQLite for local development
const Database = process.env.DATABASE_URL ? 
    require('./database-postgres') : 
    require('./database');

const GoogleSheetsBackup = require('./google-sheets-backup');

const app = express();
const PORT = process.env.PORT || 3000;

// CORS configuration for cloud deployment
const allowedOrigins = process.env.ALLOWED_ORIGINS ? 
    process.env.ALLOWED_ORIGINS.split(',') : 
    ['http://localhost:3000', 'http://localhost:8080', 'https://localhost:8080'];

// Middleware de segurança e performance
app.use(helmet({
    contentSecurityPolicy: false, // Disable for development, configure properly for production
    crossOriginEmbedderPolicy: false
}));
app.use(compression());
app.use(cors({
    origin: allowedOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '50mb' }));

// Servir arquivos estáticos do frontend
app.use(express.static(path.join(__dirname, '../frontend')));

// Inicializar banco de dados
const db = new Database();

// Middleware de logging
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
    next();
});

// Health check endpoint for deployment platforms
app.get('/api/health', (_, res) => {
    res.json({ 
        status: 'ok', 
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'development'
    });
});

// Rotas da API

// 1. Salvar conversa
app.post('/api/chats', async (req, res) => {
    try {
        const { id, title, model, messages } = req.body;
        
        if (!id || !title || !model) {
            return res.status(400).json({ error: 'Dados obrigatórios faltando' });
        }

        // Salvar conversa
        await db.saveChat({ id, title, model });

        // Salvar mensagens
        if (messages && messages.length > 0) {
            for (const message of messages) {
                const content = message.parts?.[0]?.text || '';
                const messageType = message.parts?.[0]?.inlineData ? 'file' : 'text';
                const fileInfo = message.parts?.[0]?.inlineData ? JSON.stringify(message.parts[0].inlineData) : null;
                
                await db.saveMessage(id, {
                    role: message.role,
                    content,
                    messageType,
                    fileInfo
                });
            }
        }

        res.json({ success: true, message: 'Conversa salva com sucesso' });
    } catch (error) {
        console.error('Erro ao salvar conversa:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

// 2. Buscar conversa específica
app.get('/api/chats/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const chat = await db.getChatWithMessages(id);
        
        if (!chat) {
            return res.status(404).json({ error: 'Conversa não encontrada' });
        }

        res.json(chat);
    } catch (error) {
        console.error('Erro ao buscar conversa:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

// 3. Listar todas as conversas
app.get('/api/chats', async (_, res) => {
    try {
        const chats = await db.getAllChats();
        res.json(chats);
    } catch (error) {
        console.error('Erro ao listar conversas:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

// 4. Deletar conversa
app.delete('/api/chats/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const result = await db.deleteChat(id);
        
        if (result === 0) {
            return res.status(404).json({ error: 'Conversa não encontrada' });
        }

        res.json({ success: true, message: 'Conversa deletada com sucesso' });
    } catch (error) {
        console.error('Erro ao deletar conversa:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

// 5. Adicionar mensagem a uma conversa existente
app.post('/api/chats/:id/messages', async (req, res) => {
    try {
        const { id } = req.params;
        const { role, content, messageType = 'text', fileInfo = null, status = 'sent', retryCount = 0, errorMessage = null } = req.body;

        if (!role || !content) {
            return res.status(400).json({ error: 'Dados obrigatórios faltando' });
        }

        // Verificar se a conversa existe
        const chat = await db.getChat(id);
        if (!chat) {
            return res.status(404).json({ error: 'Conversa não encontrada' });
        }

        // Salvar mensagem
        const messageId = await db.saveMessage(id, {
            role,
            content,
            messageType,
            fileInfo,
            status,
            retryCount,
            errorMessage
        });

        // Atualizar timestamp da conversa
        await db.saveChat({ id, title: chat.title, model: chat.model });

        res.json({ success: true, messageId });
    } catch (error) {
        console.error('Erro ao adicionar mensagem:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

// 6. Atualizar status de uma mensagem
app.patch('/api/messages/:messageId/status', async (req, res) => {
    try {
        const { messageId } = req.params;
        const { status, errorMessage = null, retryCount = null } = req.body;

        if (!status) {
            return res.status(400).json({ error: 'Status é obrigatório' });
        }

        const changes = await db.updateMessageStatus(messageId, status, errorMessage, retryCount);

        if (changes === 0) {
            return res.status(404).json({ error: 'Mensagem não encontrada' });
        }

        res.json({ success: true, changes });
    } catch (error) {
        console.error('Erro ao atualizar status da mensagem:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

// 7. Obter mensagens pendentes
app.get('/api/messages/pending', async (req, res) => {
    try {
        const { chatId } = req.query;
        const pendingMessages = await db.getPendingMessages(chatId);
        res.json(pendingMessages);
    } catch (error) {
        console.error('Erro ao buscar mensagens pendentes:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

// 8. Estatísticas do sistema
app.get('/api/stats', async (_, res) => {
    try {
        const stats = await db.getStats();
        res.json(stats);
    } catch (error) {
        console.error('Erro ao buscar estatísticas:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

// 7. Renomear conversa
app.put('/api/chats/:id/rename', async (req, res) => {
    try {
        const { id } = req.params;
        const { title } = req.body;
        
        if (!title || !title.trim()) {
            return res.status(400).json({ error: 'Título é obrigatório' });
        }

        // Verificar se a conversa existe
        const chat = await db.getChat(id);
        if (!chat) {
            return res.status(404).json({ error: 'Conversa não encontrada' });
        }

        // Atualizar apenas o título
        await db.updateChatTitle(id, title.trim());
        
        res.json({ success: true, message: 'Conversa renomeada com sucesso' });
    } catch (error) {
        console.error('Erro ao renomear conversa:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

// 8. Buscar conversas por texto
app.get('/api/chats/search/:query', async (req, res) => {
    try {
        const { query } = req.params;
        const chats = await db.searchChats(query);
        res.json(chats);
    } catch (error) {
        console.error('Erro na busca:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

// Rota padrão - servir o frontend
app.get('*', (_, res) => {
    res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

// Tratamento de erros
app.use((error, req, res, next) => {
    console.error('Erro não tratado:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
});

// Iniciar servidor
app.listen(PORT, () => {
    console.log(`🚀 Servidor rodando na porta ${PORT}`);
    console.log(`📱 Frontend: http://localhost:${PORT}`);
    console.log(`🔌 API: http://localhost:${PORT}/api`);
});

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\n🛑 Recebido SIGINT, fechando servidor...');
    db.close();
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log('\n🛑 Recebido SIGTERM, fechando servidor...');
    db.close();
    process.exit(0);
});
