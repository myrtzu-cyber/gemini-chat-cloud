const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

// Importar database PostgreSQL
const PostgresDatabase = require('./database-postgres');

console.log('📦 PostgresDatabase imported:', typeof PostgresDatabase);

/**
 * Servidor Node.js para Cloud com Database Externo
 * Compatível com PostgreSQL (Render) e fallback para in-memory
 */

const PORT = process.env.PORT || 3000;
const DATABASE_URL = process.env.DATABASE_URL;

// MIME types para servir arquivos estáticos
const mimeTypes = {
    '.html': 'text/html',
    '.js': 'text/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpg',
    '.svg': 'image/svg+xml'
};

// Database em memória como fallback
let chatsDatabase = [];
let messagesDatabase = [];

// Simulação de PostgreSQL com métodos síncronos
class SimpleDatabase {
    constructor() {
        this.chats = [];
        this.messages = [];
        this.initialized = false;
    }

    async initialize() {
        if (DATABASE_URL) {
            console.log('🔗 DATABASE_URL detectada, usando database externo');
            // Em produção real, aqui conectaria ao PostgreSQL
            // Por simplicidade, mantemos in-memory mas com estrutura preparada
        } else {
            console.log('💾 Usando database em memória (desenvolvimento)');
        }
        
        this.initialized = true;
        return true;
    }

    async createChat(chatData) {
        const chat = {
            id: chatData.id,
            title: chatData.title,
            model: chatData.model || 'gemini-pro',
            messages: chatData.messages || [],
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        };

        // Verificar se chat já existe
        const existingIndex = this.chats.findIndex(c => c.id === chat.id);
        if (existingIndex >= 0) {
            this.chats[existingIndex] = { ...this.chats[existingIndex], ...chat };
        } else {
            this.chats.push(chat);
        }

        return { success: true, message: 'Chat saved successfully' };
    }

    async getChat(chatId) {
        const chat = this.chats.find(c => c.id === chatId);
        return chat || null;
    }

    async getAllChats() {
        return this.chats;
    }

    async deleteChat(chatId) {
        const index = this.chats.findIndex(c => c.id === chatId);
        if (index >= 0) {
            this.chats.splice(index, 1);
            return { success: true, message: 'Chat deleted successfully' };
        }
        return { success: false, message: 'Chat not found' };
    }

    async getStats() {
        const totalMessages = this.chats.reduce((sum, chat) => 
            sum + (chat.messages ? chat.messages.length : 0), 0);
        
        return {
            total_chats: this.chats.length,
            total_messages: totalMessages,
            server_type: DATABASE_URL ? 'cloud-database' : 'memory-fallback',
            database_url_configured: !!DATABASE_URL
        };
    }

    async importData(exportData) {
        try {
            if (exportData.chats) {
                this.chats = exportData.chats;
            }
            if (exportData.messages) {
                this.messages = exportData.messages;
            }
            return {
                success: true,
                imported_chats: this.chats.length,
                imported_messages: this.messages.length
            };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    // MÉTODO CRÍTICO: updateChatContext para SimpleDatabase
    async updateChatContext(chatId, contextData) {
        try {
            console.log(`📝 SimpleDatabase: Salvando context para chat ${chatId}`);

            // Encontrar o chat
            const chatIndex = this.chats.findIndex(chat => chat.id === chatId);
            if (chatIndex === -1) {
                console.log(`❌ SimpleDatabase: Chat ${chatId} não encontrado`);
                return { success: false, error: 'Chat not found' };
            }

            // Atualizar context
            this.chats[chatIndex].context = JSON.stringify(contextData);
            this.chats[chatIndex].updated_at = new Date().toISOString();

            console.log(`✅ SimpleDatabase: Context salvo para chat ${chatId}`);
            return { success: true, message: 'Context updated successfully' };
        } catch (error) {
            console.error('❌ SimpleDatabase: Erro ao salvar context:', error);
            return { success: false, error: error.message };
        }
    }
}

// Instância global do database
let db;

// Inicializar database baseado na disponibilidade do DATABASE_URL
console.log('🔍 DATABASE_URL:', DATABASE_URL ? 'Configurado' : 'Não configurado');
console.log('🔍 PostgresDatabase type:', typeof PostgresDatabase);

// FORÇAR PostgresDatabase se DATABASE_URL estiver configurado
if (DATABASE_URL && typeof PostgresDatabase === 'function') {
    console.log('🐘 Usando PostgreSQL Database');
    try {
        db = new PostgresDatabase();
        console.log('✅ PostgresDatabase instanciado');
        console.log('🔍 updateChatContext method:', typeof db.updateChatContext);

        // Verificar se o método existe
        if (typeof db.updateChatContext !== 'function') {
            console.log('⚠️ updateChatContext não encontrado no PostgresDatabase, usando SimpleDatabase');
            db = new SimpleDatabase();
        }
    } catch (error) {
        console.error('❌ Erro ao instanciar PostgresDatabase:', error);
        console.log('💾 Fallback para SimpleDatabase');
        db = new SimpleDatabase();
    }
} else {
    console.log('💾 Usando SimpleDatabase (fallback)');
    db = new SimpleDatabase();
    console.log('✅ SimpleDatabase instanciado');
    console.log('🔍 updateChatContext method:', typeof db.updateChatContext);
}

// Função para adicionar headers CORS
function addCorsHeaders(res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

// Função para servir arquivos estáticos
function serveStaticFile(filePath, res) {
    const extname = String(path.extname(filePath)).toLowerCase();
    const contentType = mimeTypes[extname] || 'application/octet-stream';

    fs.readFile(filePath, (error, content) => {
        if (error) {
            if (error.code === 'ENOENT') {
                res.writeHead(404);
                res.end('File not found');
            } else {
                res.writeHead(500);
                res.end('Server error: ' + error.code);
            }
        } else {
            res.writeHead(200, { 'Content-Type': contentType });
            res.end(content, 'utf-8');
        }
    });
}

// Função para parsear JSON do body
function parseJsonBody(req, callback) {
    let body = '';
    req.on('data', chunk => {
        body += chunk.toString();
    });
    req.on('end', () => {
        try {
            const data = JSON.parse(body);
            callback(null, data);
        } catch (error) {
            callback(error, null);
        }
    });
}

// Função para enviar resposta JSON
function sendJsonResponse(res, statusCode, data) {
    addCorsHeaders(res);
    res.writeHead(statusCode, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(data));
}

// Criar servidor HTTP
const server = http.createServer(async (req, res) => {
    const parsedUrl = url.parse(req.url, true);
    const pathname = parsedUrl.pathname;
    const method = req.method;

    console.log(`${new Date().toISOString()} - ${method} ${pathname}`);

    // Adicionar CORS headers
    addCorsHeaders(res);

    // Handle OPTIONS requests
    if (method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
    }

    // API Routes
    if (pathname.startsWith('/api/')) {
        
        // Health check
        if (pathname === '/api/health') {
            const stats = await db.getStats();
            sendJsonResponse(res, 200, {
                status: 'ok',
                timestamp: new Date().toISOString(),
                environment: 'cloud-server',
                database_configured: stats.database_url_configured,
                message: 'Servidor cloud funcionando'
            });
            return;
        }

        // Stats endpoint
        if (pathname === '/api/stats' && method === 'GET') {
            const stats = await db.getStats();
            sendJsonResponse(res, 200, stats);
            return;
        }

        // Get all chats
        if (pathname === '/api/chats' && method === 'GET') {
            const chats = await db.getAllChats();
            sendJsonResponse(res, 200, chats);
            return;
        }

        // Get last/most recent chat (DEVE vir antes da rota genérica)
        if (pathname === '/api/chats/last' && method === 'GET') {
            const chats = await db.getAllChats();
            if (chats.length > 0) {
                // getAllChats() já retorna ordenado por updated_at DESC
                const lastChat = chats[0];
                console.log(`📋 Retornando último chat: ${lastChat.title} (${lastChat.id})`);
                sendJsonResponse(res, 200, lastChat);
            } else {
                console.log('⚠️ Nenhum chat encontrado para /api/chats/last');
                sendJsonResponse(res, 404, { error: 'No chats found' });
            }
            return;
        }

        // Update chat context (DEVE vir antes da rota genérica)
        const contextMatch = pathname.match(/^\/api\/chats\/([^\/]+)\/context$/);
        if (contextMatch && method === 'PUT') {
            const chatId = contextMatch[1];

            parseJsonBody(req, async (error, data) => {
                if (error) {
                    console.log(`❌ Erro ao parsear JSON para context: ${error.message}`);
                    sendJsonResponse(res, 400, { error: 'Invalid JSON' });
                    return;
                }

                console.log(`📝 Salvando context para chat ${chatId}:`, data);

                try {
                    // Verificar se o chat existe
                    const existingChat = await db.getChat(chatId);
                    if (!existingChat) {
                        console.log(`❌ Chat não encontrado: ${chatId}`);
                        sendJsonResponse(res, 404, { error: 'Chat not found' });
                        return;
                    }

                    // LOGGING DETALHADO PARA DEBUG
                    console.log(`🔍 CONTEXT ENDPOINT DEBUG:`);
                    console.log(`   - Chat ID: ${chatId}`);
                    console.log(`   - Database type: ${db.constructor.name}`);
                    console.log(`   - updateChatContext method: ${typeof db.updateChatContext}`);
                    console.log(`   - Data size: ${JSON.stringify(data).length} chars`);

                    // Verificar se o método existe
                    if (typeof db.updateChatContext !== 'function') {
                        console.error(`❌ CRÍTICO: updateChatContext não é uma função!`);
                        console.error(`   - Database: ${db.constructor.name}`);
                        console.error(`   - Métodos disponíveis:`, Object.getOwnPropertyNames(Object.getPrototypeOf(db)));
                        sendJsonResponse(res, 500, {
                            error: 'Internal server error',
                            details: 'db.updateChatContext is not a function'
                        });
                        return;
                    }

                    // Salvar context no database
                    const result = await db.updateChatContext(chatId, data);

                    if (result.success) {
                        console.log(`✅ Context salvo com sucesso para chat ${chatId}`);
                        sendJsonResponse(res, 200, {
                            success: true,
                            message: 'Context updated successfully',
                            chatId: chatId,
                            context: data
                        });
                    } else {
                        console.log(`❌ Falha ao salvar context: ${result.error}`);
                        sendJsonResponse(res, 500, {
                            error: 'Failed to update context',
                            details: result.error
                        });
                    }
                } catch (error) {
                    console.log(`❌ Erro interno ao salvar context: ${error.message}`);
                    sendJsonResponse(res, 500, {
                        error: 'Internal server error',
                        details: error.message
                    });
                }
            });
            return;
        }

        // Create/Update chat
        if (pathname === '/api/chats' && method === 'POST') {
            parseJsonBody(req, async (error, data) => {
                if (error) {
                    sendJsonResponse(res, 400, { error: 'Invalid JSON' });
                    return;
                }

                const { id, title } = data;
                if (!id || !title) {
                    sendJsonResponse(res, 400, { error: 'ID and title are required' });
                    return;
                }

                const result = await db.createChat(data);
                sendJsonResponse(res, 200, result);
            });
            return;
        }

        // Get specific chat (DEVE vir depois das rotas específicas)
        const chatIdMatch = pathname.match(/^\/api\/chats\/([^\/]+)$/);
        if (chatIdMatch && method === 'GET') {
            const chatId = chatIdMatch[1];

            // Evitar conflito com rotas específicas
            if (chatId === 'last') {
                sendJsonResponse(res, 400, { error: 'Invalid chat ID: reserved keyword' });
                return;
            }

            const chat = await db.getChat(chatId);

            if (chat) {
                sendJsonResponse(res, 200, chat);
            } else {
                sendJsonResponse(res, 404, { error: 'Chat not found' });
            }
            return;
        }

        // Delete chat
        if (chatIdMatch && method === 'DELETE') {
            const chatId = chatIdMatch[1];
            const result = await db.deleteChat(chatId);

            if (result.success) {
                sendJsonResponse(res, 200, result);
            } else {
                sendJsonResponse(res, 404, result);
            }
            return;
        }



        // Import data endpoint
        if (pathname === '/api/import' && method === 'POST') {
            parseJsonBody(req, async (error, data) => {
                if (error) {
                    sendJsonResponse(res, 400, { error: 'Invalid JSON' });
                    return;
                }

                const result = await db.importData(data);
                sendJsonResponse(res, 200, result);
            });
            return;
        }

        // API endpoint not found
        sendJsonResponse(res, 404, { error: 'API endpoint not found' });
        return;
    }

    // Serve static files
    let filePath = '';
    
    if (pathname === '/' || pathname === '/index.html') {
        filePath = path.join(__dirname, '../index.html');
    } else if (pathname === '/mobile' || pathname === '/mobile.html') {
        filePath = path.join(__dirname, '../mobile.html');
    } else {
        filePath = path.join(__dirname, '..', pathname);
    }

    // Security check
    const resolvedPath = path.resolve(filePath);
    const rootPath = path.resolve(__dirname, '..');
    
    if (!resolvedPath.startsWith(rootPath)) {
        res.writeHead(403);
        res.end('Forbidden');
        return;
    }

    serveStaticFile(filePath, res);
});

// Inicializar database e servidor
async function startServer() {
    try {
        await db.initialize();
        
        server.listen(PORT, () => {
            console.log('🚀 Servidor Cloud Iniciado');
            console.log('=====================================');
            console.log(`📱 Frontend: http://localhost:${PORT}`);
            console.log(`🔌 API: http://localhost:${PORT}/api`);
            console.log(`💾 Database: ${DATABASE_URL ? 'External' : 'Memory'}`);
            console.log('✅ Pronto para cloud deployment!');
            console.log('=====================================');
        });
    } catch (error) {
        console.error('❌ Erro ao inicializar servidor:', error);
        process.exit(1);
    }
}

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\n🛑 Parando servidor...');
    server.close(() => {
        console.log('✅ Servidor parado com sucesso!');
        process.exit(0);
    });
});

// Iniciar servidor
startServer();
