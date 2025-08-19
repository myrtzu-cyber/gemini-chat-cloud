const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const url = require('url');
const querystring = require('querystring');

/**
 * Servidor Node.js Mínimo - Sem Dependências Externas
 * Para ambientes corporativos com restrições de instalação
 */

const PORT = process.env.PORT || 3000;

// MIME types para servir arquivos estáticos
const mimeTypes = {
    '.html': 'text/html',
    '.js': 'text/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.wav': 'audio/wav',
    '.mp4': 'video/mp4',
    '.woff': 'application/font-woff',
    '.ttf': 'application/font-ttf',
    '.eot': 'application/vnd.ms-fontobject',
    '.otf': 'application/font-otf',
    '.wasm': 'application/wasm'
};

// Simulação de banco de dados em memória (para desenvolvimento)
let chatsDatabase = [];
let messagesDatabase = [];

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
const server = http.createServer((req, res) => {
    const parsedUrl = url.parse(req.url, true);
    const pathname = parsedUrl.pathname;
    const method = req.method;

    console.log(`${new Date().toISOString()} - ${method} ${pathname}`);

    // Adicionar CORS headers para todas as respostas
    addCorsHeaders(res);

    // Handle OPTIONS requests (CORS preflight)
    if (method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
    }

    // API Routes
    if (pathname.startsWith('/api/')) {
        
        // Health check
        if (pathname === '/api/health') {
            sendJsonResponse(res, 200, {
                status: 'ok',
                timestamp: new Date().toISOString(),
                environment: 'minimal-server',
                message: 'Servidor mínimo funcionando sem dependências externas'
            });
            return;
        }

        // Get all chats
        if (pathname === '/api/chats' && method === 'GET') {
            sendJsonResponse(res, 200, chatsDatabase);
            return;
        }

        // Create/Update chat
        if (pathname === '/api/chats' && method === 'POST') {
            parseJsonBody(req, (error, data) => {
                if (error) {
                    sendJsonResponse(res, 400, { error: 'Invalid JSON' });
                    return;
                }

                const { id, title, model, messages } = data;
                if (!id || !title) {
                    sendJsonResponse(res, 400, { error: 'ID and title are required' });
                    return;
                }

                // Check if chat exists
                const existingChatIndex = chatsDatabase.findIndex(chat => chat.id === id);
                const chatData = {
                    id,
                    title,
                    model: model || 'gemini-pro',
                    messages: messages || [],
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                };

                if (existingChatIndex >= 0) {
                    chatsDatabase[existingChatIndex] = { ...chatsDatabase[existingChatIndex], ...chatData };
                } else {
                    chatsDatabase.push(chatData);
                }

                sendJsonResponse(res, 200, { success: true, message: 'Chat saved successfully' });
            });
            return;
        }

        // Get specific chat
        const chatIdMatch = pathname.match(/^\/api\/chats\/([^\/]+)$/);
        if (chatIdMatch && method === 'GET') {
            const chatId = chatIdMatch[1];
            const chat = chatsDatabase.find(c => c.id === chatId);
            
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
            const chatIndex = chatsDatabase.findIndex(c => c.id === chatId);
            
            if (chatIndex >= 0) {
                chatsDatabase.splice(chatIndex, 1);
                sendJsonResponse(res, 200, { success: true, message: 'Chat deleted successfully' });
            } else {
                sendJsonResponse(res, 404, { error: 'Chat not found' });
            }
            return;
        }

        // Stats endpoint
        if (pathname === '/api/stats' && method === 'GET') {
            const totalMessages = chatsDatabase.reduce((sum, chat) => sum + (chat.messages ? chat.messages.length : 0), 0);
            sendJsonResponse(res, 200, {
                total_chats: chatsDatabase.length,
                total_messages: totalMessages,
                server_type: 'minimal-nodejs'
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
        // Serve other static files
        filePath = path.join(__dirname, '..', pathname);
    }

    // Security check - prevent directory traversal
    const resolvedPath = path.resolve(filePath);
    const rootPath = path.resolve(__dirname, '..');
    
    if (!resolvedPath.startsWith(rootPath)) {
        res.writeHead(403);
        res.end('Forbidden');
        return;
    }

    serveStaticFile(filePath, res);
});

// Start server
server.listen(PORT, () => {
    console.log('🚀 Servidor Node.js Mínimo Iniciado');
    console.log('=====================================');
    console.log(`📱 Frontend: http://localhost:${PORT}`);
    console.log(`🔌 API: http://localhost:${PORT}/api`);
    console.log(`💾 Banco: Em memória (desenvolvimento)`);
    console.log('✅ Sem dependências externas!');
    console.log('=====================================');
});

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\n🛑 Parando servidor...');
    server.close(() => {
        console.log('✅ Servidor parado com sucesso!');
        process.exit(0);
    });
});

process.on('SIGTERM', () => {
    console.log('\n🛑 Recebido SIGTERM, fechando servidor...');
    server.close(() => {
        console.log('✅ Servidor parado com sucesso!');
        process.exit(0);
    });
});
