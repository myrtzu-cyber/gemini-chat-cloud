const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

// Importar database PostgreSQL com fallback
let PostgresDatabase = null;
try {
    PostgresDatabase = require('./database-postgres');
    console.log('📦 PostgresDatabase imported successfully:', typeof PostgresDatabase);
} catch (error) {
    console.log('⚠️ PostgresDatabase import failed:', error.message);
    console.log('💾 Will use SimpleDatabase fallback only');
}

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
        // Carregar dados persistidos se existirem
        try {
            const dataFile = path.join(__dirname, 'simple-db-data.json');
            const backupFile = path.join(__dirname, 'simple-db-data-backup.json');

            console.log(`🔍 Procurando arquivo de dados: ${dataFile}`);
            console.log(`🔍 Arquivo existe: ${fs.existsSync(dataFile)}`);
            console.log(`🔍 Backup existe: ${fs.existsSync(backupFile)}`);

            let dataLoaded = false;

            // Try to load main data file
            if (fs.existsSync(dataFile)) {
                try {
                    const rawData = fs.readFileSync(dataFile, 'utf8');
                    console.log(`📄 Tamanho do arquivo principal: ${rawData.length} chars`);

                    const data = JSON.parse(rawData);
                    this.chats = data.chats || [];
                    this.messages = data.messages || [];
                    console.log(`📂 Dados carregados do arquivo principal: ${this.chats.length} chats, ${this.messages.length} mensagens`);

                    if (data.lastSaved) {
                        console.log(`🕒 Último salvamento: ${data.lastSaved}`);
                    }

                    dataLoaded = true;
                } catch (parseError) {
                    console.log('⚠️ Erro ao parsear arquivo principal:', parseError.message);
                    console.log('🔄 Tentando carregar backup...');
                }
            }

            // If main file failed or doesn't exist, try backup
            if (!dataLoaded && fs.existsSync(backupFile)) {
                try {
                    const rawData = fs.readFileSync(backupFile, 'utf8');
                    console.log(`📄 Tamanho do arquivo de backup: ${rawData.length} chars`);

                    const data = JSON.parse(rawData);
                    this.chats = data.chats || [];
                    this.messages = data.messages || [];
                    console.log(`📂 Dados carregados do backup: ${this.chats.length} chats, ${this.messages.length} mensagens`);

                    // Restore main file from backup
                    fs.writeFileSync(dataFile, rawData);
                    console.log('🔄 Arquivo principal restaurado do backup');

                    dataLoaded = true;
                } catch (backupError) {
                    console.log('⚠️ Erro ao carregar backup:', backupError.message);
                }
            }

            if (!dataLoaded) {
                console.log('📂 Nenhum arquivo de dados encontrado, iniciando com database vazio');
                this.chats = [];
                this.messages = [];
            }

            if (this.chats.length > 0) {
                console.log(`🎯 Primeiro chat: "${this.chats[0].title}" (${this.chats[0].id})`);
                console.log(`🎯 Último chat: "${this.chats[this.chats.length - 1].title}" (${this.chats[this.chats.length - 1].id})`);
            }

        } catch (error) {
            console.log('⚠️ Erro crítico ao carregar dados persistidos:', error.message);
            console.log('⚠️ Stack trace:', error.stack);
            // Initialize with empty data as fallback
            this.chats = [];
            this.messages = [];
        }

        if (DATABASE_URL) {
            console.log('🔗 DATABASE_URL detectada, mas usando SimpleDatabase como fallback');
        } else {
            console.log('💾 Usando SimpleDatabase com persistência em arquivo');
        }

        this.initialized = true;

        // Set up periodic auto-save to prevent data loss
        this.setupAutoSave();

        return true;
    }

    // Robust data persistence with backup
    async persistData(operation = 'Data update') {
        try {
            const dataFile = path.join(__dirname, 'simple-db-data.json');
            const backupFile = path.join(__dirname, 'simple-db-data-backup.json');

            const data = {
                chats: this.chats,
                messages: this.messages,
                lastSaved: new Date().toISOString(),
                operation: operation,
                stats: {
                    totalChats: this.chats.length,
                    totalMessages: this.messages.length,
                    serverUptime: process.uptime()
                }
            };

            const jsonData = JSON.stringify(data, null, 2);

            // Create backup of current file before overwriting
            if (fs.existsSync(dataFile)) {
                try {
                    fs.copyFileSync(dataFile, backupFile);
                } catch (backupError) {
                    console.log('⚠️ Erro ao criar backup:', backupError.message);
                }
            }

            // Write new data
            fs.writeFileSync(dataFile, jsonData);

            console.log(`💾 Dados persistidos: ${this.chats.length} chats, ${this.messages.length} mensagens`);
            console.log(`💾 Operação: ${operation}`);
            console.log(`💾 Arquivo: ${dataFile}`);

            // Verify the write was successful
            if (fs.existsSync(dataFile)) {
                const verifySize = fs.statSync(dataFile).size;
                console.log(`✅ Verificação: arquivo salvo com ${verifySize} bytes`);
            }

        } catch (saveError) {
            console.log('⚠️ Erro crítico ao persistir dados:', saveError.message);
            console.log('⚠️ Stack trace:', saveError.stack);

            // Try to restore from backup if main save failed
            try {
                const backupFile = path.join(__dirname, 'simple-db-data-backup.json');
                if (fs.existsSync(backupFile)) {
                    console.log('🔄 Tentando restaurar do backup...');
                    // Don't overwrite, just log that backup exists
                    console.log('📂 Backup disponível para recuperação manual');
                }
            } catch (restoreError) {
                console.log('⚠️ Erro ao verificar backup:', restoreError.message);
            }
        }
    }

    // Set up automatic periodic saves
    setupAutoSave() {
        // Auto-save every 5 minutes to prevent data loss
        setInterval(async () => {
            if (this.chats.length > 0 || this.messages.length > 0) {
                await this.persistData('Auto-save (periodic)');
            }
        }, 5 * 60 * 1000); // 5 minutes

        console.log('⏰ Auto-save configurado: salvamento a cada 5 minutos');
    }

    async createChat(chatData) {
        console.log(`📝 SimpleDatabase: Criando/atualizando chat ${chatData.id}`);
        console.log(`   Título: "${chatData.title}"`);
        console.log(`   Mensagens recebidas: ${chatData.messages ? chatData.messages.length : 0}`);
        console.log(`   Context recebido: ${chatData.context ? 'Sim' : 'Não'}`);

        const chat = {
            id: chatData.id,
            title: chatData.title,
            model: chatData.model || 'gemini-pro',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            context: chatData.context ? JSON.stringify(chatData.context) : null
        };

        // Verificar se chat já existe
        const existingIndex = this.chats.findIndex(c => c.id === chat.id);
        if (existingIndex >= 0) {
            console.log(`   Atualizando chat existente (índice ${existingIndex})`);
            // Manter created_at original, atualizar apenas updated_at
            this.chats[existingIndex] = {
                ...this.chats[existingIndex],
                ...chat,
                created_at: this.chats[existingIndex].created_at // Preservar data de criação
            };
        } else {
            console.log(`   Criando novo chat`);
            this.chats.push(chat);
        }

        // Processar mensagens se fornecidas
        if (chatData.messages && Array.isArray(chatData.messages)) {
            console.log(`   Processando ${chatData.messages.length} mensagens`);

            // Contar mensagens existentes para este chat
            const existingMessages = this.messages.filter(m => m.chat_id === chatData.id);
            console.log(`   Mensagens existentes no chat: ${existingMessages.length}`);

            // Se o número de mensagens é o mesmo, não reprocessar (evitar duplicação)
            if (existingMessages.length === chatData.messages.length) {
                console.log(`   Mesmo número de mensagens, pulando reprocessamento`);
            } else {
                console.log(`   Atualizando mensagens: ${existingMessages.length} → ${chatData.messages.length}`);

                // Remover mensagens antigas deste chat
                this.messages = this.messages.filter(m => m.chat_id !== chatData.id);

                // Adicionar novas mensagens
                for (const msg of chatData.messages) {
                    const message = {
                        id: msg.id,
                        chat_id: chatData.id,
                        sender: msg.sender,
                        content: msg.content,
                        files: JSON.stringify(msg.files || []),
                        created_at: msg.timestamp ? new Date(msg.timestamp).toISOString() : new Date().toISOString()
                    };
                    this.messages.push(message);
                }
                console.log(`   ${chatData.messages.length} mensagens processadas`);
            }
        }

        // Salvar dados persistentemente com backup
        await this.persistData(`Chat criado: ${chatData.id} - "${chatData.title}"`);

        console.log(`✅ Chat ${chatData.id} salvo com sucesso`);
        return { success: true, message: 'Chat saved successfully', id: chatData.id };
    }

    async getChat(chatId) {
        const chat = this.chats.find(c => c.id === chatId);
        return chat || null;
    }

    async getChatWithMessages(chatId) {
        const chat = this.chats.find(c => c.id === chatId);
        if (!chat) return null;

        // Buscar mensagens do chat
        const messages = this.messages.filter(m => m.chat_id === chatId);

        console.log(`📋 Chat "${chat.title}": ${messages.length} mensagens encontradas`);

        // Expandir contexto se existir
        let expandedContext = {};
        if (chat.context) {
            try {
                expandedContext = JSON.parse(chat.context);
                console.log(`📋 Context expandido: ${Object.keys(expandedContext).join(', ')}`);
                if (expandedContext.aventura) {
                    console.log(`📋 Aventura length: ${expandedContext.aventura.length} chars`);
                }
            } catch (error) {
                console.log(`⚠️ Erro ao parsear context: ${error.message}`);
            }
        }

        return {
            ...chat,
            ...expandedContext, // Expandir campos do contexto diretamente no chat
            messages: messages.map(msg => ({
                id: msg.id,
                sender: msg.sender,
                content: msg.content,
                files: JSON.parse(msg.files || '[]'),
                created_at: msg.created_at
            }))
        };
    }

    async getAllChats() {
        // Ordenar por updated_at DESC (mais recente primeiro)
        const sortedChats = [...this.chats].sort((a, b) => {
            const dateA = new Date(a.updated_at || a.created_at);
            const dateB = new Date(b.updated_at || b.created_at);
            return dateB - dateA; // DESC
        });

        console.log(`📋 getAllChats: ${sortedChats.length} chats ordenados por data`);
        if (sortedChats.length > 0) {
            console.log(`   Mais recente: "${sortedChats[0].title}" (${sortedChats[0].id}) - ${sortedChats[0].updated_at}`);
        }

        return sortedChats;
    }

    async deleteChat(chatId) {
        const index = this.chats.findIndex(c => c.id === chatId);
        if (index >= 0) {
            this.chats.splice(index, 1);
            return { success: true, message: 'Chat deleted successfully' };
        }
        return { success: false, message: 'Chat not found' };
    }

    async addMessage(messageData) {
        try {
            console.log(`📝 SimpleDatabase: Adicionando mensagem ao chat ${messageData.chat_id}`);

            // Verificar se o chat existe
            const chatExists = this.chats.find(c => c.id === messageData.chat_id);
            if (!chatExists) {
                console.log(`❌ Chat não encontrado: ${messageData.chat_id}`);
                return { success: false, error: 'Chat not found' };
            }

            // Adicionar mensagem ao array de mensagens
            const message = {
                id: messageData.id,
                chat_id: messageData.chat_id,
                sender: messageData.sender,
                content: messageData.content,
                files: JSON.stringify(messageData.files || []),
                created_at: new Date().toISOString()
            };

            this.messages.push(message);

            // Atualizar timestamp do chat
            const chatIndex = this.chats.findIndex(c => c.id === messageData.chat_id);
            if (chatIndex >= 0) {
                this.chats[chatIndex].updated_at = new Date().toISOString();
            }

            // Salvar dados persistentemente
            await this.persistData(`Mensagem salva para chat ${messageData.chat_id}`);

            console.log(`✅ SimpleDatabase: Mensagem adicionada com sucesso`);
            return { success: true, message: 'Message added successfully', messageId: message.id };
        } catch (error) {
            console.error('❌ SimpleDatabase: Erro ao adicionar mensagem:', error);
            return { success: false, error: error.message };
        }
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

            // Salvar dados persistentemente
            await this.persistData(`Context atualizado para chat ${chatId}`);

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

// Instância global do backup service
let backupService;

// Inicializar database baseado na disponibilidade do DATABASE_URL e PostgresDatabase
console.log('🔍 DATABASE_URL:', DATABASE_URL ? 'Configurado' : 'Não configurado');
console.log('🔍 PostgresDatabase available:', PostgresDatabase !== null);

// Tentar usar PostgresDatabase se disponível e DATABASE_URL configurado
if (DATABASE_URL && PostgresDatabase && typeof PostgresDatabase === 'function') {
    console.log('🐘 Tentando usar PostgreSQL Database');
    try {
        db = new PostgresDatabase();
        console.log('✅ PostgresDatabase instanciado com sucesso');
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
    if (!PostgresDatabase) {
        console.log('⚠️ PostgresDatabase não disponível (módulo pg não encontrado)');
    }
    if (!DATABASE_URL) {
        console.log('⚠️ DATABASE_URL não configurado');
    }
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

    // Record activity for backup system
    if (backupService && pathname.startsWith('/api/')) {
        backupService.recordActivity();
    }

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
        
        // Enhanced Health check with wake-up monitoring
        if (pathname === '/api/health') {
            const stats = await db.getStats();
            const uptime = process.uptime();
            const memoryUsage = process.memoryUsage();

            // Log wake-up ping for monitoring
            console.log(`🏥 Health check at ${new Date().toISOString()} - Uptime: ${Math.floor(uptime/60)}m ${Math.floor(uptime%60)}s`);

            sendJsonResponse(res, 200, {
                status: 'ok',
                timestamp: new Date().toISOString(),
                environment: 'cloud-server',
                uptime_seconds: Math.floor(uptime),
                uptime_human: `${Math.floor(uptime/3600)}h ${Math.floor((uptime%3600)/60)}m ${Math.floor(uptime%60)}s`,
                memory_usage: {
                    rss_mb: Math.round(memoryUsage.rss / 1024 / 1024),
                    heap_used_mb: Math.round(memoryUsage.heapUsed / 1024 / 1024),
                    heap_total_mb: Math.round(memoryUsage.heapTotal / 1024 / 1024)
                },
                database_configured: stats.database_url_configured,
                database_type: stats.server_type,
                total_chats: stats.total_chats,
                total_messages: stats.total_messages,
                message: 'Servidor cloud funcionando - Keep alive active',
                last_ping: new Date().toISOString()
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
                const lastChatBasic = chats[0];
                console.log(`📋 Buscando último chat com mensagens: ${lastChatBasic.title} (${lastChatBasic.id})`);

                // Buscar o chat completo com mensagens
                const lastChatWithMessages = await db.getChatWithMessages(lastChatBasic.id);

                if (lastChatWithMessages) {
                    console.log(`✅ Último chat retornado com ${lastChatWithMessages.messages.length} mensagens`);
                    sendJsonResponse(res, 200, lastChatWithMessages);
                } else {
                    console.log(`⚠️ Erro ao buscar mensagens do último chat`);
                    sendJsonResponse(res, 200, lastChatBasic); // Fallback sem mensagens
                }
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
                    console.log(`❌ Erro ao parsear JSON para chat: ${error.message}`);
                    sendJsonResponse(res, 400, { error: 'Invalid JSON' });
                    return;
                }

                console.log(`📝 Criando/atualizando chat:`, {
                    id: data.id,
                    title: data.title,
                    messagesCount: data.messages ? data.messages.length : 0,
                    hasContext: !!data.context
                });

                const { id, title } = data;
                if (!id || !title) {
                    console.log(`❌ Dados obrigatórios faltando: id=${id}, title=${title}`);
                    sendJsonResponse(res, 400, { error: 'ID and title are required' });
                    return;
                }

                try {
                    const result = await db.createChat(data);
                    console.log(`✅ Chat criado/atualizado com sucesso: ${result.id}`);
                    sendJsonResponse(res, 200, result);
                } catch (error) {
                    console.log(`❌ Erro interno ao criar chat: ${error.message}`);
                    sendJsonResponse(res, 500, {
                        error: 'Internal server error',
                        details: error.message
                    });
                }
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

            console.log(`🔍 Buscando chat com mensagens: ${chatId}`);

            // Usar getChatWithMessages para incluir as mensagens
            const chat = await db.getChatWithMessages(chatId);

            if (chat) {
                console.log(`✅ Chat encontrado: "${chat.title}" com ${chat.messages.length} mensagens`);
                sendJsonResponse(res, 200, chat);
            } else {
                console.log(`❌ Chat não encontrado: ${chatId}`);
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

        // Add message endpoint - CRITICAL FOR MOBILE FRONTEND
        if (pathname === '/api/messages' && method === 'POST') {
            parseJsonBody(req, async (error, data) => {
                if (error) {
                    console.log(`❌ Erro ao parsear JSON para mensagem: ${error.message}`);
                    sendJsonResponse(res, 400, { error: 'Invalid JSON' });
                    return;
                }

                console.log(`📝 Adicionando nova mensagem:`, data);

                // Validar dados obrigatórios
                const { id, chat_id, sender, content } = data;
                if (!id || !chat_id || !sender || !content) {
                    console.log(`❌ Dados obrigatórios faltando`);
                    sendJsonResponse(res, 400, {
                        error: 'Missing required fields: id, chat_id, sender, content'
                    });
                    return;
                }

                try {
                    const result = await db.addMessage(data);

                    if (result.success) {
                        console.log(`✅ Mensagem adicionada com sucesso: ${result.messageId}`);
                        sendJsonResponse(res, 201, result);
                    } else {
                        console.log(`❌ Erro ao adicionar mensagem: ${result.error}`);
                        sendJsonResponse(res, 400, result);
                    }
                } catch (error) {
                    console.log(`❌ Erro interno ao adicionar mensagem: ${error.message}`);
                    sendJsonResponse(res, 500, {
                        error: 'Internal server error',
                        details: error.message
                    });
                }
            });
            return;
        }

        // Debug endpoint para verificar estado do SimpleDatabase
        if (pathname === '/api/debug/database' && method === 'GET') {
            const debugInfo = {
                databaseType: db.constructor.name,
                totalChats: db.chats ? db.chats.length : 'N/A',
                totalMessages: db.messages ? db.messages.length : 'N/A',
                chats: db.chats ? db.chats.map(c => ({
                    id: c.id,
                    title: c.title,
                    created_at: c.created_at,
                    updated_at: c.updated_at,
                    hasContext: !!c.context
                })) : [],
                recentMessages: db.messages ? db.messages.slice(-5).map(m => ({
                    id: m.id,
                    chat_id: m.chat_id,
                    sender: m.sender,
                    content: m.content.substring(0, 50) + '...',
                    created_at: m.created_at
                })) : [],
                timestamp: new Date().toISOString()
            };

            console.log(`🔍 Debug endpoint chamado - retornando estado do database`);
            sendJsonResponse(res, 200, debugInfo);
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

        // Backup trigger endpoint
        if (pathname === '/api/backup/trigger' && method === 'GET') {
            try {
                console.log('🗄️ Backup trigger endpoint called');

                if (!backupService) {
                    sendJsonResponse(res, 200, {
                        status: 'skipped',
                        message: 'Google Drive backup service not configured',
                        timestamp: new Date().toISOString()
                    });
                    return;
                }

                const result = await backupService.performScheduledBackup(db);

                sendJsonResponse(res, 200, {
                    status: 'success',
                    message: 'Backup check completed',
                    result: result,
                    timestamp: new Date().toISOString()
                });
            } catch (error) {
                console.error('❌ Backup trigger error:', error);
                sendJsonResponse(res, 500, {
                    status: 'error',
                    message: 'Backup trigger failed',
                    error: error.message,
                    timestamp: new Date().toISOString()
                });
            }
            return;
        }

        // Backup status endpoint
        if (pathname === '/api/backup/status' && method === 'GET') {
            try {
                if (!backupService) {
                    sendJsonResponse(res, 200, {
                        status: 'not_configured',
                        message: 'Google Drive backup service not available',
                        timestamp: new Date().toISOString()
                    });
                    return;
                }

                const status = await backupService.getBackupStatus();
                sendJsonResponse(res, 200, status);
            } catch (error) {
                sendJsonResponse(res, 500, {
                    status: 'error',
                    error: error.message,
                    timestamp: new Date().toISOString()
                });
            }
            return;
        }

        // Manual backup endpoint
        if (pathname === '/api/backup/manual' && method === 'POST') {
            try {
                console.log('🔧 Manual backup endpoint called');

                if (!backupService) {
                    sendJsonResponse(res, 400, {
                        status: 'error',
                        message: 'Google Drive backup service not configured',
                        timestamp: new Date().toISOString()
                    });
                    return;
                }

                const result = await backupService.triggerManualBackup(db);

                sendJsonResponse(res, 200, {
                    status: 'success',
                    message: 'Manual backup completed',
                    result: result,
                    timestamp: new Date().toISOString()
                });
            } catch (error) {
                console.error('❌ Manual backup error:', error);
                sendJsonResponse(res, 500, {
                    status: 'error',
                    message: 'Manual backup failed',
                    error: error.message,
                    timestamp: new Date().toISOString()
                });
            }
            return;
        }

        // Database recovery endpoint
        if (pathname === '/api/database/recovery' && method === 'GET') {
            try {
                console.log('🔍 Database recovery endpoint called');

                const dataFile = path.join(__dirname, 'simple-db-data.json');
                const backupFile = path.join(__dirname, 'simple-db-data-backup.json');

                const recovery = {
                    timestamp: new Date().toISOString(),
                    serverUptime: process.uptime(),
                    databaseType: db.constructor.name,
                    currentData: {
                        chats: db.chats ? db.chats.length : 0,
                        messages: db.messages ? db.messages.length : 0
                    },
                    files: {
                        mainFile: {
                            exists: fs.existsSync(dataFile),
                            size: fs.existsSync(dataFile) ? fs.statSync(dataFile).size : 0,
                            modified: fs.existsSync(dataFile) ? fs.statSync(dataFile).mtime : null
                        },
                        backupFile: {
                            exists: fs.existsSync(backupFile),
                            size: fs.existsSync(backupFile) ? fs.statSync(backupFile).size : 0,
                            modified: fs.existsSync(backupFile) ? fs.statSync(backupFile).mtime : null
                        }
                    }
                };

                // Try to read backup file content for comparison
                if (fs.existsSync(backupFile)) {
                    try {
                        const backupData = JSON.parse(fs.readFileSync(backupFile, 'utf8'));
                        recovery.backupData = {
                            chats: backupData.chats ? backupData.chats.length : 0,
                            messages: backupData.messages ? backupData.messages.length : 0,
                            lastSaved: backupData.lastSaved,
                            operation: backupData.operation
                        };
                    } catch (parseError) {
                        recovery.backupData = { error: 'Failed to parse backup file' };
                    }
                }

                sendJsonResponse(res, 200, recovery);
            } catch (error) {
                console.error('❌ Database recovery error:', error);
                sendJsonResponse(res, 500, {
                    status: 'error',
                    error: error.message,
                    timestamp: new Date().toISOString()
                });
            }
            return;
        }

        // Force database reload endpoint
        if (pathname === '/api/database/reload' && method === 'POST') {
            try {
                console.log('🔄 Database reload endpoint called');

                if (db.constructor.name === 'SimpleDatabase') {
                    const oldChats = db.chats.length;
                    const oldMessages = db.messages.length;

                    // Reinitialize the database
                    await db.initialize();

                    const newChats = db.chats.length;
                    const newMessages = db.messages.length;

                    sendJsonResponse(res, 200, {
                        status: 'success',
                        message: 'Database reloaded',
                        before: { chats: oldChats, messages: oldMessages },
                        after: { chats: newChats, messages: newMessages },
                        timestamp: new Date().toISOString()
                    });
                } else {
                    sendJsonResponse(res, 400, {
                        status: 'error',
                        message: 'Database reload only available for SimpleDatabase',
                        databaseType: db.constructor.name,
                        timestamp: new Date().toISOString()
                    });
                }
            } catch (error) {
                console.error('❌ Database reload error:', error);
                sendJsonResponse(res, 500, {
                    status: 'error',
                    error: error.message,
                    timestamp: new Date().toISOString()
                });
            }
            return;
        }

        // Activity status endpoint
        if (pathname === '/api/activity/status' && method === 'GET') {
            try {
                if (!backupService) {
                    sendJsonResponse(res, 200, {
                        status: 'not_configured',
                        message: 'Activity tracking not available',
                        timestamp: new Date().toISOString()
                    });
                    return;
                }

                const activityStats = backupService.getActivityStats();
                sendJsonResponse(res, 200, {
                    ...activityStats,
                    timestamp: new Date().toISOString(),
                    uptime: process.uptime()
                });
            } catch (error) {
                sendJsonResponse(res, 500, {
                    status: 'error',
                    error: error.message,
                    timestamp: new Date().toISOString()
                });
            }
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

        // Initialize backup service
        try {
            const GoogleDriveBackup = require('./google-drive-backup');
            backupService = new GoogleDriveBackup();
            console.log('🗄️ Google Drive backup service initialized');
        } catch (error) {
            console.log('⚠️ Google Drive backup service not available:', error.message);
            backupService = null;
        }

        server.listen(PORT, () => {
            console.log('🚀 Servidor Cloud Iniciado');
            console.log('=====================================');
            console.log(`📱 Frontend: http://localhost:${PORT}`);
            console.log(`🔌 API: http://localhost:${PORT}/api`);
            console.log(`💾 Database: ${DATABASE_URL ? 'External' : 'Memory'}`);
            console.log(`🗄️ Backup: ${backupService ? 'Google Drive Configured' : 'Not Configured'}`);
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
