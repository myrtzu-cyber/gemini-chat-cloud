/**
 * Database Factory
 * Handles database initialization with proper fallback logic
 */

const fs = require('fs');
const path = require('path');

class DatabaseFactory {
    static async createDatabase() {
        const DATABASE_URL = process.env.DATABASE_URL;
        
        console.log('🏭 DatabaseFactory: Starting database initialization...');
        console.log(`🔗 DATABASE_URL configured: ${!!DATABASE_URL}`);
        console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
        console.log(`📍 Platform: ${process.platform}`);
        console.log(`📍 Node version: ${process.version}`);
        
        if (DATABASE_URL) {
            console.log(`🔗 DATABASE_URL length: ${DATABASE_URL.length} characters`);
            console.log(`🔗 DATABASE_URL starts with: ${DATABASE_URL.substring(0, 20)}...`);
            console.log(`🔗 DATABASE_URL contains 'render.com': ${DATABASE_URL.includes('render.com')}`);
        }

        // Try PostgreSQL first if DATABASE_URL is available
        if (DATABASE_URL) {
            try {
                console.log('🐘 Attempting to load PostgreSQL database...');
                
                // First, try to require the pg module directly
                let pg;
                try {
                    pg = require('pg');
                    console.log('✅ pg module loaded successfully');
                } catch (pgError) {
                    console.log('❌ Failed to load pg module:', pgError.message);
                    throw new Error(`pg module not available: ${pgError.message}`);
                }

                // Then try to load our PostgreSQL implementation
                let PostgresDatabase;
                try {
                    PostgresDatabase = require('./database-postgres');
                    console.log('✅ PostgresDatabase class loaded successfully');
                } catch (classError) {
                    console.log('❌ Failed to load PostgresDatabase class:', classError.message);
                    throw new Error(`PostgresDatabase class not available: ${classError.message}`);
                }

                // Create and test the instance
                const db = new PostgresDatabase();
                console.log('✅ PostgresDatabase instance created');

                // Test the connection
                await db.initialize();
                console.log('✅ PostgreSQL database initialized successfully');

                return db;

            } catch (error) {
                console.log('❌ PostgreSQL initialization failed:', error.message);
                console.log('📍 Error code:', error.code);
                console.log('📍 Error name:', error.name);
                console.log('📍 Full error stack:', error.stack);
                
                if (error.message.includes('pg module')) {
                    console.log('🔧 pg module issue detected - checking installation...');
                } else if (error.message.includes('connection')) {
                    console.log('🌐 Connection issue detected - checking DATABASE_URL and network...');
                } else {
                    console.log('❓ Unknown PostgreSQL error type');
                }
                
                console.log('💾 Falling back to SimpleDatabase...');
            }
        } else {
            console.log('⚠️ DATABASE_URL not configured, using SimpleDatabase');
        }

        // Fallback to SimpleDatabase
        console.log('💾 Initializing SimpleDatabase fallback...');
        const SimpleDatabase = DatabaseFactory.createSimpleDatabase();
        const db = new SimpleDatabase();
        await db.initialize();
        console.log('✅ SimpleDatabase initialized successfully');
        
        return db;
    }

    static createSimpleDatabase() {
        // Inline SimpleDatabase class to avoid circular dependencies
        return class SimpleDatabase {
            constructor() {
                this.chats = [];
                this.messages = [];
                this.initialized = false;
            }

            async initialize() {
                try {
                    const dataFile = path.join(__dirname, 'simple-db-data.json');
                    const backupFile = path.join(__dirname, 'simple-db-data-backup.json');

                    console.log(`🔍 Looking for data file: ${dataFile}`);
                    console.log(`🔍 File exists: ${fs.existsSync(dataFile)}`);
                    console.log(`🔍 Backup exists: ${fs.existsSync(backupFile)}`);

                    let dataLoaded = false;

                    // Try to load from main data file
                    if (fs.existsSync(dataFile)) {
                        try {
                            const fileContent = fs.readFileSync(dataFile, 'utf8');
                            console.log(`📄 Data file size: ${fileContent.length} characters`);
                            
                            const data = JSON.parse(fileContent);
                            console.log(`📊 Parsed data - Chats: ${data.chats?.length || 0}, Messages: ${data.messages?.length || 0}`);
                            
                            if (data.chats && Array.isArray(data.chats)) {
                                this.chats = data.chats;
                                console.log(`✅ Loaded ${this.chats.length} chats`);
                                if (this.chats.length > 0) {
                                    console.log(`📝 First chat: ${this.chats[0].title} (${this.chats[0].id})`);
                                }
                            }
                            
                            if (data.messages && Array.isArray(data.messages)) {
                                this.messages = data.messages;
                                console.log(`✅ Loaded ${this.messages.length} messages`);
                            }
                            
                            dataLoaded = true;
                        } catch (parseError) {
                            console.log('⚠️ Error parsing main data file:', parseError.message);
                        }
                    }

                    // Try backup if main file failed
                    if (!dataLoaded && fs.existsSync(backupFile)) {
                        try {
                            console.log('🔄 Attempting to load from backup file...');
                            const backupContent = fs.readFileSync(backupFile, 'utf8');
                            const backupData = JSON.parse(backupContent);
                            
                            if (backupData.chats && Array.isArray(backupData.chats)) {
                                this.chats = backupData.chats;
                                console.log(`✅ Loaded ${this.chats.length} chats from backup`);
                            }
                            
                            if (backupData.messages && Array.isArray(backupData.messages)) {
                                this.messages = backupData.messages;
                                console.log(`✅ Loaded ${this.messages.length} messages from backup`);
                            }
                            
                            dataLoaded = true;
                        } catch (backupError) {
                            console.log('⚠️ Error loading backup file:', backupError.message);
                        }
                    }

                    if (!dataLoaded) {
                        console.log('📝 No existing data found, starting with empty database');
                    }

                    this.initialized = true;
                    this.setupAutoSave();
                    
                    console.log('✅ SimpleDatabase initialized');
                    return true;
                } catch (error) {
                    console.error('❌ SimpleDatabase initialization failed:', error);
                    throw error;
                }
            }

            setupAutoSave() {
                // Auto-save every 5 minutes
                setInterval(() => {
                    this.persistData('Auto-save');
                }, 5 * 60 * 1000);
            }

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

                    // Create backup before overwriting
                    if (fs.existsSync(dataFile)) {
                        try {
                            fs.copyFileSync(dataFile, backupFile);
                        } catch (backupError) {
                            console.log('⚠️ Error creating backup:', backupError.message);
                        }
                    }

                    // Write new data
                    fs.writeFileSync(dataFile, jsonData, 'utf8');
                    console.log(`💾 Data persisted: ${operation} (${this.chats.length} chats, ${this.messages.length} messages)`);
                } catch (error) {
                    console.log('⚠️ Error persisting data:', error.message);
                }
            }

            async createChat(chatData) {
                console.log(`📝 SimpleDatabase: Creating/updating chat ${chatData.id}`);
                
                const chat = {
                    id: chatData.id,
                    title: chatData.title,
                    model: chatData.model || 'gemini-pro',
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                    context: chatData.context ? JSON.stringify(chatData.context) : null
                };

                // Check if chat exists
                const existingIndex = this.chats.findIndex(c => c.id === chatData.id);
                if (existingIndex >= 0) {
                    this.chats[existingIndex] = { ...this.chats[existingIndex], ...chat };
                } else {
                    this.chats.push(chat);
                }

                // Add messages if provided
                if (chatData.messages && Array.isArray(chatData.messages)) {
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

                await this.persistData(`Chat created: ${chatData.id}`);
                return { success: true, chatId: chatData.id };
            }

            async addMessage(messageData) {
                console.log(`📝 SimpleDatabase: Adding message to chat ${messageData.chat_id}`);

                const message = {
                    id: messageData.id,
                    chat_id: messageData.chat_id,
                    sender: messageData.sender,
                    content: messageData.content,
                    files: JSON.stringify(messageData.files || []),
                    created_at: new Date().toISOString()
                };

                this.messages.push(message);

                // Update chat timestamp
                const chatIndex = this.chats.findIndex(c => c.id === messageData.chat_id);
                if (chatIndex >= 0) {
                    this.chats[chatIndex].updated_at = new Date().toISOString();
                }

                await this.persistData(`Message added to chat ${messageData.chat_id}`);
                return { success: true, message: 'Message added successfully', messageId: message.id };
            }

            async updateChatContext(chatId, contextData) {
                console.log(`📝 SimpleDatabase: Updating context for chat ${chatId}`);

                const chatIndex = this.chats.findIndex(chat => chat.id === chatId);
                if (chatIndex === -1) {
                    return { success: false, error: 'Chat not found' };
                }

                this.chats[chatIndex].context = JSON.stringify(contextData);
                this.chats[chatIndex].updated_at = new Date().toISOString();

                await this.persistData(`Context updated for chat ${chatId}`);
                return { success: true, message: 'Context updated successfully' };
            }

            async deleteMessage(messageId) {
                console.log(`🗑️ SimpleDatabase: Deleting message ${messageId}`);

                const messageIndex = this.messages.findIndex(msg => msg.id === messageId);
                if (messageIndex === -1) {
                    console.log(`❌ SimpleDatabase: Message ${messageId} not found`);
                    return { success: false, message: 'Message not found' };
                }

                const message = this.messages[messageIndex];
                const chatId = message.chat_id;

                // Remove message
                this.messages.splice(messageIndex, 1);

                // Update chat's updated_at timestamp
                const chatIndex = this.chats.findIndex(chat => chat.id === chatId);
                if (chatIndex !== -1) {
                    this.chats[chatIndex].updated_at = new Date().toISOString();
                }

                console.log(`✅ SimpleDatabase: Message ${messageId} deleted successfully`);

                await this.persistData(`Message deleted: ${messageId}`);
                return { success: true, message: 'Message deleted successfully', chatId: chatId };
            }

            async deleteChat(chatId) {
                console.log(`🗑️ SimpleDatabase: Deleting chat ${chatId}`);

                const chatIndex = this.chats.findIndex(chat => chat.id === chatId);
                if (chatIndex === -1) {
                    console.log(`❌ SimpleDatabase: Chat ${chatId} not found`);
                    return { success: false, message: 'Chat not found' };
                }

                const chatTitle = this.chats[chatIndex].title;

                // Remove chat
                this.chats.splice(chatIndex, 1);

                // Remove associated messages
                const initialMessageCount = this.messages.length;
                this.messages = this.messages.filter(message => message.chat_id !== chatId);
                const removedMessages = initialMessageCount - this.messages.length;

                console.log(`✅ SimpleDatabase: Chat "${chatTitle}" (${chatId}) deleted successfully`);
                console.log(`   Removed ${removedMessages} associated messages`);

                await this.persistData(`Chat deleted: ${chatId}`);
                return { success: true, message: 'Chat deleted successfully' };
            }

            async getChats() {
                return this.chats.map(chat => {
                    // Count messages for this chat
                    const messageCount = this.messages.filter(msg => msg.chat_id === chat.id).length;

                    return {
                        ...chat,
                        context: chat.context ? JSON.parse(chat.context) : null,
                        message_count: messageCount
                    };
                }).sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));
            }

            // Alias for backward compatibility
            async getAllChats() {
                console.log('📋 SimpleDatabase: getAllChats called (using getChats)');
                const chats = await this.getChats();
                console.log(`📋 getAllChats: ${chats.length} chats retrieved from SimpleDatabase`);
                if (chats.length > 0) {
                    console.log(`   Most recent: "${chats[0].title}" (${chats[0].id}) - ${chats[0].updated_at}`);
                }
                return chats;
            }

            async getChat(chatId) {
                const chat = this.chats.find(c => c.id === chatId);
                if (!chat) return null;

                return {
                    ...chat,
                    context: chat.context ? JSON.parse(chat.context) : null
                };
            }

            async getChatWithMessages(chatId) {
                const chat = this.chats.find(c => c.id === chatId);
                if (!chat) return null;

                const messages = this.messages
                    .filter(m => m.chat_id === chatId)
                    .map(m => ({
                        ...m,
                        files: JSON.parse(m.files || '[]')
                    }))
                    .sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

                return {
                    ...chat,
                    context: chat.context ? JSON.parse(chat.context) : null,
                    messages: messages
                };
            }

            async getStats() {
                return {
                    total_chats: this.chats.length,
                    total_messages: this.messages.length,
                    server_type: 'simple-database-fallback',
                    database_url_configured: !!process.env.DATABASE_URL,
                    fallback_reason: 'PostgreSQL unavailable or failed to initialize'
                };
            }
        };
    }
}

module.exports = DatabaseFactory;
