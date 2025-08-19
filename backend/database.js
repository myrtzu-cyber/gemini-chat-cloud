const sqlite3 = require('sqlite3').verbose();
const path = require('path');

class Database {
    constructor() {
        this.dbPath = path.join(__dirname, '../database/chats.db');
        this.db = null;
        this.init();
    }

    init() {
        // Criar diretório database se não existir
        const fs = require('fs');
        const dbDir = path.dirname(this.dbPath);
        if (!fs.existsSync(dbDir)) {
            fs.mkdirSync(dbDir, { recursive: true });
        }

        this.db = new sqlite3.Database(this.dbPath, (err) => {
            if (err) {
                console.error('Erro ao conectar ao banco:', err);
            } else {
                console.log('✅ Conectado ao banco SQLite');
                this.createTables();
            }
        });
    }

    createTables() {
        // Tabela de conversas
        const createChatsTable = `
            CREATE TABLE IF NOT EXISTS chats (
                id TEXT PRIMARY KEY,
                title TEXT NOT NULL,
                model TEXT NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `;

        // Tabela de mensagens
        const createMessagesTable = `
            CREATE TABLE IF NOT EXISTS messages (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                chat_id TEXT NOT NULL,
                role TEXT NOT NULL,
                content TEXT NOT NULL,
                message_type TEXT DEFAULT 'text',
                file_info TEXT,
                status TEXT DEFAULT 'sent',
                retry_count INTEGER DEFAULT 0,
                error_message TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (chat_id) REFERENCES chats (id) ON DELETE CASCADE
            )
        `;

        // Tabela de arquivos
        const createFilesTable = `
            CREATE TABLE IF NOT EXISTS files (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                message_id INTEGER NOT NULL,
                filename TEXT NOT NULL,
                mime_type TEXT NOT NULL,
                file_path TEXT NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (message_id) REFERENCES messages (id) ON DELETE CASCADE
            )
        `;

        // Índices para performance
        const createIndexes = `
            CREATE INDEX IF NOT EXISTS idx_chat_id ON messages(chat_id);
            CREATE INDEX IF NOT EXISTS idx_created_at ON chats(created_at);
            CREATE INDEX IF NOT EXISTS idx_updated_at ON chats(updated_at);
        `;

        this.db.serialize(() => {
            this.db.run(createChatsTable);
            this.db.run(createMessagesTable);
            this.db.run(createFilesTable);
            this.db.run(createIndexes);

            // Migration: Add new columns to existing messages table
            this.db.run(`ALTER TABLE messages ADD COLUMN status TEXT DEFAULT 'sent'`, (err) => {
                if (err && !err.message.includes('duplicate column name')) {
                    console.error('Error adding status column:', err);
                }
            });

            this.db.run(`ALTER TABLE messages ADD COLUMN retry_count INTEGER DEFAULT 0`, (err) => {
                if (err && !err.message.includes('duplicate column name')) {
                    console.error('Error adding retry_count column:', err);
                }
            });

            this.db.run(`ALTER TABLE messages ADD COLUMN error_message TEXT`, (err) => {
                if (err && !err.message.includes('duplicate column name')) {
                    console.error('Error adding error_message column:', err);
                }
            });

            this.db.run(`ALTER TABLE messages ADD COLUMN updated_at DATETIME DEFAULT CURRENT_TIMESTAMP`, (err) => {
                if (err && !err.message.includes('duplicate column name')) {
                    console.error('Error adding updated_at column:', err);
                }
            });
        });
    }

    // Métodos para conversas
    async saveChat(chatData) {
        return new Promise((resolve, reject) => {
            const { id, title, model } = chatData;
            
            this.db.run(
                `INSERT OR REPLACE INTO chats (id, title, model, updated_at) 
                 VALUES (?, ?, ?, CURRENT_TIMESTAMP)`,
                [id, title, model],
                function(err) {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(this.lastID);
                    }
                }
            );
        });
    }

    async getChat(chatId) {
        return new Promise((resolve, reject) => {
            this.db.get(
                `SELECT * FROM chats WHERE id = ?`,
                [chatId],
                (err, chat) => {
                    if (err) reject(err);
                    else resolve(chat);
                }
            );
        });
    }

    async getAllChats() {
        return new Promise((resolve, reject) => {
            this.db.all(
                `SELECT * FROM chats ORDER BY updated_at DESC`,
                (err, chats) => {
                    if (err) reject(err);
                    else resolve(chats);
                }
            );
        });
    }

    async updateChatTitle(chatId, title) {
        return new Promise((resolve, reject) => {
            this.db.run(
                `UPDATE chats SET title = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
                [title, chatId],
                function(err) {
                    if (err) reject(err);
                    else resolve(this.changes);
                }
            );
        });
    }

    async deleteChat(chatId) {
        return new Promise((resolve, reject) => {
            this.db.run(
                `DELETE FROM chats WHERE id = ?`,
                [chatId],
                function(err) {
                    if (err) reject(err);
                    else resolve(this.changes);
                }
            );
        });
    }

    // Métodos para mensagens
    async saveMessage(chatId, message) {
        return new Promise((resolve, reject) => {
            const {
                role,
                content,
                messageType = 'text',
                fileInfo = null,
                status = 'sent',
                retryCount = 0,
                errorMessage = null
            } = message;

            this.db.run(
                `INSERT INTO messages (chat_id, role, content, message_type, file_info, status, retry_count, error_message, updated_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
                [chatId, role, content, messageType, fileInfo, status, retryCount, errorMessage],
                function(err) {
                    if (err) reject(err);
                    else resolve(this.lastID);
                }
            );
        });
    }

    async getChatMessages(chatId) {
        return new Promise((resolve, reject) => {
            this.db.all(
                `SELECT * FROM messages WHERE chat_id = ? ORDER BY created_at ASC`,
                [chatId],
                (err, messages) => {
                    if (err) reject(err);
                    else resolve(messages);
                }
            );
        });
    }

    async updateMessageStatus(messageId, status, errorMessage = null, retryCount = null) {
        return new Promise((resolve, reject) => {
            let query = `UPDATE messages SET status = ?, updated_at = datetime('now')`;
            let params = [status];

            if (errorMessage !== null) {
                query += `, error_message = ?`;
                params.push(errorMessage);
            }

            if (retryCount !== null) {
                query += `, retry_count = ?`;
                params.push(retryCount);
            }

            query += ` WHERE id = ?`;
            params.push(messageId);

            this.db.run(query, params, function(err) {
                if (err) reject(err);
                else resolve(this.changes);
            });
        });
    }

    async getPendingMessages(chatId = null) {
        return new Promise((resolve, reject) => {
            let query = `SELECT * FROM messages WHERE status = 'pending'`;
            let params = [];

            if (chatId) {
                query += ` AND chat_id = ?`;
                params.push(chatId);
            }

            query += ` ORDER BY created_at ASC`;

            this.db.all(query, params, (err, messages) => {
                if (err) reject(err);
                else resolve(messages);
            });
        });
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
                        fileInfo: msg.file_info ? JSON.parse(msg.file_info) : null
                    }]
                }))
            };
        } catch (error) {
            throw error;
        }
    }

    // Métodos para estatísticas
    async getStats() {
        return new Promise((resolve, reject) => {
            this.db.get(
                `SELECT 
                    COUNT(*) as total_chats,
                    COUNT(DISTINCT chat_id) as active_chats,
                    SUM(LENGTH(content)) as total_characters
                 FROM chats c
                 LEFT JOIN messages m ON c.id = m.chat_id`,
                (err, stats) => {
                    if (err) reject(err);
                    else resolve(stats);
                }
            );
        });
    }

    // Fechar conexão
    close() {
        if (this.db) {
            this.db.close((err) => {
                if (err) {
                    console.error('Erro ao fechar banco:', err);
                } else {
                    console.log('✅ Conexão com banco fechada');
                }
            });
        }
    }
}

module.exports = Database;
