const { Pool } = require('pg');

/**
 * PostgreSQL Database Implementation for Cloud Deployment
 * Provides persistent storage for chat conversations and messages
 */
class PostgresDatabase {
    constructor() {
        this.pool = null;
        this.initialized = false;
        
        // Get database URL from environment
        this.databaseUrl = process.env.DATABASE_URL;
        
        if (!this.databaseUrl) {
            throw new Error('DATABASE_URL environment variable is required');
        }
        
        console.log('🐘 PostgresDatabase: Initializing with DATABASE_URL');
    }

    async initialize() {
        try {
            // Create connection pool
            this.pool = new Pool({
                connectionString: this.databaseUrl,
                ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
                max: 10,
                idleTimeoutMillis: 30000,
                connectionTimeoutMillis: 2000,
            });

            // Test connection
            const client = await this.pool.connect();
            console.log('✅ PostgresDatabase: Connection established');
            client.release();

            // Create tables if they don't exist
            await this.createTables();
            
            this.initialized = true;
            console.log('✅ PostgresDatabase: Initialized successfully');
            return true;
        } catch (error) {
            console.error('❌ PostgresDatabase: Initialization failed:', error.message);
            throw error;
        }
    }

    async createTables() {
        const client = await this.pool.connect();
        try {
            // Create chats table
            await client.query(`
                CREATE TABLE IF NOT EXISTS chats (
                    id VARCHAR(255) PRIMARY KEY,
                    title TEXT NOT NULL,
                    model VARCHAR(100) DEFAULT 'gemini-pro',
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    context TEXT
                )
            `);

            // Create messages table
            await client.query(`
                CREATE TABLE IF NOT EXISTS messages (
                    id VARCHAR(255) PRIMARY KEY,
                    chat_id VARCHAR(255) REFERENCES chats(id) ON DELETE CASCADE,
                    sender VARCHAR(50) NOT NULL,
                    content TEXT NOT NULL,
                    files TEXT DEFAULT '[]',
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            `);

            // Create indexes for better performance
            await client.query(`
                CREATE INDEX IF NOT EXISTS idx_messages_chat_id ON messages(chat_id)
            `);
            
            await client.query(`
                CREATE INDEX IF NOT EXISTS idx_chats_updated_at ON chats(updated_at DESC)
            `);

            console.log('✅ PostgresDatabase: Tables created/verified');
        } catch (error) {
            console.error('❌ PostgresDatabase: Error creating tables:', error.message);
            throw error;
        } finally {
            client.release();
        }
    }

    async createChat(chatData) {
        const client = await this.pool.connect();
        try {
            console.log(`📝 PostgresDatabase: Creating/updating chat ${chatData.id}`);
            console.log(`   Title: "${chatData.title}"`);
            console.log(`   Context: ${chatData.context ? 'Yes' : 'No'}`);

            // Check if chat exists
            const existingChat = await client.query(
                'SELECT id FROM chats WHERE id = $1',
                [chatData.id]
            );

            const contextJson = chatData.context ? JSON.stringify(chatData.context) : null;

            if (existingChat.rows.length > 0) {
                // Update existing chat
                await client.query(`
                    UPDATE chats 
                    SET title = $2, model = $3, updated_at = CURRENT_TIMESTAMP, context = $4
                    WHERE id = $1
                `, [chatData.id, chatData.title, chatData.model || 'gemini-pro', contextJson]);
                
                console.log(`✅ PostgresDatabase: Chat ${chatData.id} updated`);
            } else {
                // Create new chat
                await client.query(`
                    INSERT INTO chats (id, title, model, context, created_at, updated_at)
                    VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                `, [chatData.id, chatData.title, chatData.model || 'gemini-pro', contextJson]);
                
                console.log(`✅ PostgresDatabase: Chat ${chatData.id} created`);
            }

            // If messages are provided, save them
            if (chatData.messages && Array.isArray(chatData.messages)) {
                console.log(`📝 PostgresDatabase: Saving ${chatData.messages.length} messages`);
                
                for (const message of chatData.messages) {
                    await this.addMessage({
                        id: message.id || `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                        chat_id: chatData.id,
                        sender: message.sender || message.role || 'user',
                        content: message.content,
                        files: message.files || []
                    });
                }
            }

            return { success: true, chatId: chatData.id };
        } catch (error) {
            console.error('❌ PostgresDatabase: Error creating chat:', error.message);
            return { success: false, error: error.message };
        } finally {
            client.release();
        }
    }

    async getChats() {
        const client = await this.pool.connect();
        try {
            const result = await client.query(`
                SELECT id, title, model, created_at, updated_at, context
                FROM chats 
                ORDER BY updated_at DESC
            `);
            
            return result.rows.map(row => ({
                ...row,
                context: row.context ? JSON.parse(row.context) : null
            }));
        } catch (error) {
            console.error('❌ PostgresDatabase: Error getting chats:', error.message);
            return [];
        } finally {
            client.release();
        }
    }

    async getChatWithMessages(chatId) {
        const client = await this.pool.connect();
        try {
            // Get chat
            const chatResult = await client.query(
                'SELECT * FROM chats WHERE id = $1',
                [chatId]
            );

            if (chatResult.rows.length === 0) {
                return null;
            }

            const chat = chatResult.rows[0];

            // Get messages
            const messagesResult = await client.query(`
                SELECT id, sender, content, files, created_at
                FROM messages 
                WHERE chat_id = $1 
                ORDER BY created_at ASC
            `, [chatId]);

            return {
                ...chat,
                context: chat.context ? JSON.parse(chat.context) : null,
                messages: messagesResult.rows.map(msg => ({
                    ...msg,
                    files: JSON.parse(msg.files || '[]')
                }))
            };
        } catch (error) {
            console.error('❌ PostgresDatabase: Error getting chat with messages:', error.message);
            return null;
        } finally {
            client.release();
        }
    }

    async addMessage(messageData) {
        const client = await this.pool.connect();
        try {
            console.log(`📝 PostgresDatabase: Adding message to chat ${messageData.chat_id}`);

            // Check if chat exists
            const chatExists = await client.query(
                'SELECT id FROM chats WHERE id = $1',
                [messageData.chat_id]
            );

            if (chatExists.rows.length === 0) {
                console.log(`❌ Chat not found: ${messageData.chat_id}`);
                return { success: false, error: 'Chat not found' };
            }

            // Insert message
            await client.query(`
                INSERT INTO messages (id, chat_id, sender, content, files, created_at)
                VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
            `, [
                messageData.id,
                messageData.chat_id,
                messageData.sender,
                messageData.content,
                JSON.stringify(messageData.files || [])
            ]);

            // Update chat timestamp
            await client.query(
                'UPDATE chats SET updated_at = CURRENT_TIMESTAMP WHERE id = $1',
                [messageData.chat_id]
            );

            console.log(`✅ PostgresDatabase: Message added successfully`);
            return { success: true, message: 'Message added successfully', messageId: messageData.id };
        } catch (error) {
            console.error('❌ PostgresDatabase: Error adding message:', error.message);
            return { success: false, error: error.message };
        } finally {
            client.release();
        }
    }

    async updateChatContext(chatId, contextData) {
        const client = await this.pool.connect();
        try {
            console.log(`📝 PostgresDatabase: Updating context for chat ${chatId}`);

            const result = await client.query(`
                UPDATE chats 
                SET context = $2, updated_at = CURRENT_TIMESTAMP 
                WHERE id = $1
                RETURNING id
            `, [chatId, JSON.stringify(contextData)]);

            if (result.rows.length === 0) {
                console.log(`❌ PostgresDatabase: Chat ${chatId} not found`);
                return { success: false, error: 'Chat not found' };
            }

            console.log(`✅ PostgresDatabase: Context updated for chat ${chatId}`);
            return { success: true, message: 'Context updated successfully' };
        } catch (error) {
            console.error('❌ PostgresDatabase: Error updating context:', error.message);
            return { success: false, error: error.message };
        } finally {
            client.release();
        }
    }

    async getStats() {
        const client = await this.pool.connect();
        try {
            const chatsResult = await client.query('SELECT COUNT(*) as count FROM chats');
            const messagesResult = await client.query('SELECT COUNT(*) as count FROM messages');
            
            return {
                total_chats: parseInt(chatsResult.rows[0].count),
                total_messages: parseInt(messagesResult.rows[0].count),
                server_type: 'postgresql-database',
                database_url_configured: true
            };
        } catch (error) {
            console.error('❌ PostgresDatabase: Error getting stats:', error.message);
            return {
                total_chats: 0,
                total_messages: 0,
                server_type: 'postgresql-database-error',
                database_url_configured: true,
                error: error.message
            };
        } finally {
            client.release();
        }
    }

    async close() {
        if (this.pool) {
            await this.pool.end();
            console.log('🔌 PostgresDatabase: Connection pool closed');
        }
    }
}

module.exports = PostgresDatabase;
