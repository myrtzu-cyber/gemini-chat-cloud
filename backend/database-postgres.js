const { Pool } = require('pg');
require('dotenv').config();

class PostgresDatabase {
    constructor() {
        // Use DATABASE_URL from environment (Railway/Render provide this automatically)
        this.pool = new Pool({
            connectionString: process.env.DATABASE_URL,
            ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
        });
        
        this.init();
    }

    async init() {
        try {
            // Test connection
            const client = await this.pool.connect();
            console.log('✅ Conectado ao PostgreSQL');
            client.release();
            
            // Create tables
            await this.createTables();
        } catch (err) {
            console.error('Erro ao conectar ao banco PostgreSQL:', err);
            throw err;
        }
    }

    async createTables() {
        const client = await this.pool.connect();
        
        try {
            // Enable UUID extension
            await client.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');
            
            // Tabela de conversas
            await client.query(`
                CREATE TABLE IF NOT EXISTS chats (
                    id TEXT PRIMARY KEY,
                    title TEXT NOT NULL,
                    model TEXT NOT NULL,
                    messages JSONB DEFAULT '[]',
                    master_rules TEXT DEFAULT '',
                    character_sheet TEXT DEFAULT '',
                    local_history TEXT DEFAULT '',
                    current_plot TEXT DEFAULT '',
                    relations TEXT DEFAULT '',
                    aventura TEXT DEFAULT '',
                    last_compression_time TIMESTAMP,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            `);

            // Tabela de mensagens (para compatibilidade com versão anterior)
            await client.query(`
                CREATE TABLE IF NOT EXISTS messages (
                    id SERIAL PRIMARY KEY,
                    chat_id TEXT NOT NULL,
                    role TEXT NOT NULL,
                    content TEXT NOT NULL,
                    message_type TEXT DEFAULT 'text',
                    file_info JSONB,
                    status TEXT DEFAULT 'sent',
                    retry_count INTEGER DEFAULT 0,
                    error_message TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (chat_id) REFERENCES chats (id) ON DELETE CASCADE
                )
            `);

            // Tabela de arquivos
            await client.query(`
                CREATE TABLE IF NOT EXISTS files (
                    id SERIAL PRIMARY KEY,
                    message_id INTEGER NOT NULL,
                    filename TEXT NOT NULL,
                    mime_type TEXT NOT NULL,
                    file_path TEXT NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (message_id) REFERENCES messages (id) ON DELETE CASCADE
                )
            `);

            // Índices para performance
            await client.query('CREATE INDEX IF NOT EXISTS idx_chat_id ON messages(chat_id)');
            await client.query('CREATE INDEX IF NOT EXISTS idx_created_at ON chats(created_at)');
            await client.query('CREATE INDEX IF NOT EXISTS idx_updated_at ON chats(updated_at)');
            
            console.log('✅ Tabelas PostgreSQL criadas/verificadas');
        } finally {
            client.release();
        }
    }

    // Métodos para conversas (compatível com SQLite version)
    async saveChat(chatData) {
        const { id, title, model, messages } = chatData;
        const client = await this.pool.connect();
        
        try {
            const result = await client.query(
                `INSERT INTO chats (id, title, model, messages, updated_at) 
                 VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
                 ON CONFLICT (id) 
                 DO UPDATE SET title = $2, model = $3, messages = $4, updated_at = CURRENT_TIMESTAMP
                 RETURNING id`,
                [id, title, model, JSON.stringify(messages || [])]
            );
            return result.rows[0].id;
        } finally {
            client.release();
        }
    }

    async getChat(chatId) {
        const client = await this.pool.connect();
        
        try {
            const result = await client.query(
                'SELECT * FROM chats WHERE id = $1',
                [chatId]
            );
            return result.rows[0] || null;
        } finally {
            client.release();
        }
    }

    async getAllChats() {
        const client = await this.pool.connect();
        
        try {
            const result = await client.query(
                'SELECT * FROM chats ORDER BY updated_at DESC'
            );
            return result.rows;
        } finally {
            client.release();
        }
    }

    async updateChatTitle(chatId, title) {
        const client = await this.pool.connect();
        
        try {
            const result = await client.query(
                'UPDATE chats SET title = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
                [title, chatId]
            );
            return result.rowCount;
        } finally {
            client.release();
        }
    }

    async deleteChat(chatId) {
        const client = await this.pool.connect();
        
        try {
            const result = await client.query(
                'DELETE FROM chats WHERE id = $1',
                [chatId]
            );
            return result.rowCount;
        } finally {
            client.release();
        }
    }

    // Métodos para mensagens
    async saveMessage(chatId, message) {
        const {
            role,
            content,
            messageType = 'text',
            fileInfo = null,
            status = 'sent',
            retryCount = 0,
            errorMessage = null
        } = message;

        const client = await this.pool.connect();
        
        try {
            const result = await client.query(
                `INSERT INTO messages (chat_id, role, content, message_type, file_info, status, retry_count, error_message, updated_at)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, CURRENT_TIMESTAMP)
                 RETURNING id`,
                [chatId, role, content, messageType, fileInfo, status, retryCount, errorMessage]
            );
            return result.rows[0].id;
        } finally {
            client.release();
        }
    }

    async getChatMessages(chatId) {
        const client = await this.pool.connect();
        
        try {
            const result = await client.query(
                'SELECT * FROM messages WHERE chat_id = $1 ORDER BY created_at ASC',
                [chatId]
            );
            return result.rows;
        } finally {
            client.release();
        }
    }

    async updateMessageStatus(messageId, status, errorMessage = null, retryCount = null) {
        const client = await this.pool.connect();
        
        try {
            let query = 'UPDATE messages SET status = $1, updated_at = CURRENT_TIMESTAMP';
            let params = [status];
            let paramCount = 1;

            if (errorMessage !== null) {
                paramCount++;
                query += `, error_message = $${paramCount}`;
                params.push(errorMessage);
            }

            if (retryCount !== null) {
                paramCount++;
                query += `, retry_count = $${paramCount}`;
                params.push(retryCount);
            }

            paramCount++;
            query += ` WHERE id = $${paramCount}`;
            params.push(messageId);

            const result = await client.query(query, params);
            return result.rowCount;
        } finally {
            client.release();
        }
    }

    async getPendingMessages(chatId = null) {
        const client = await this.pool.connect();
        
        try {
            let query = 'SELECT * FROM messages WHERE status = $1';
            let params = ['pending'];

            if (chatId) {
                query += ' AND chat_id = $2';
                params.push(chatId);
            }

            query += ' ORDER BY created_at ASC';

            const result = await client.query(query, params);
            return result.rows;
        } finally {
            client.release();
        }
    }

    async getChatWithMessages(chatId) {
        try {
            const chat = await this.getChat(chatId);
            if (!chat) return null;

            const messages = await this.getChatMessages(chatId);
            return {
                ...chat,
                messages: messages.map(msg => ({
                    role: msg.role,
                    parts: [{
                        text: msg.content,
                        type: msg.message_type,
                        fileInfo: msg.file_info
                    }]
                }))
            };
        } catch (error) {
            throw error;
        }
    }

    // Métodos para estatísticas
    async getStats() {
        const client = await this.pool.connect();
        
        try {
            const result = await client.query(`
                SELECT 
                    COUNT(*) as total_chats,
                    COUNT(DISTINCT chat_id) as active_chats,
                    SUM(LENGTH(content)) as total_characters
                FROM chats c
                LEFT JOIN messages m ON c.id = m.chat_id
            `);
            return result.rows[0];
        } finally {
            client.release();
        }
    }

    // Fechar conexão
    async close() {
        try {
            await this.pool.end();
            console.log('✅ Conexão PostgreSQL fechada');
        } catch (err) {
            console.error('Erro ao fechar conexão PostgreSQL:', err);
        }
    }
}

module.exports = PostgresDatabase;
