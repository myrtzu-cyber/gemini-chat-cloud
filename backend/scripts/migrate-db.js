#!/usr/bin/env node
/**
 * Database Migration Script
 * Migrates data from SQLite to PostgreSQL for cloud deployment
 */

const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
require('dotenv').config();

// Import database classes
const PostgresDatabase = require('../database-postgres');

async function migrateSQLiteToPostgres() {
    console.log('🚀 Iniciando migração SQLite → PostgreSQL...');
    
    // Check if SQLite database exists
    const sqlitePath = path.join(__dirname, '../../database/chats.db');
    if (!fs.existsSync(sqlitePath)) {
        console.log('❌ Banco SQLite não encontrado em:', sqlitePath);
        console.log('✅ Nada para migrar. PostgreSQL será inicializado vazio.');
        return;
    }

    // Initialize PostgreSQL database
    const pgDb = new PostgresDatabase();
    await pgDb.init();

    // Open SQLite database
    const sqliteDb = new sqlite3.Database(sqlitePath);

    try {
        console.log('📊 Migrando conversas...');
        
        // Migrate chats
        const chats = await new Promise((resolve, reject) => {
            sqliteDb.all('SELECT * FROM chats', (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });

        console.log(`📝 Encontradas ${chats.length} conversas para migrar`);

        for (const chat of chats) {
            try {
                // Parse messages if they exist
                let messages = [];
                if (chat.messages) {
                    try {
                        messages = JSON.parse(chat.messages);
                    } catch (e) {
                        console.warn(`⚠️  Erro ao parsear mensagens do chat ${chat.id}:`, e.message);
                    }
                }

                await pgDb.saveChat({
                    id: chat.id,
                    title: chat.title,
                    model: chat.model,
                    messages: messages
                });

                console.log(`✅ Chat migrado: ${chat.title} (${chat.id})`);
            } catch (error) {
                console.error(`❌ Erro ao migrar chat ${chat.id}:`, error.message);
            }
        }

        console.log('📊 Migrando mensagens individuais...');
        
        // Migrate individual messages (if they exist in separate table)
        const messages = await new Promise((resolve, reject) => {
            sqliteDb.all('SELECT * FROM messages', (err, rows) => {
                if (err) {
                    if (err.message.includes('no such table')) {
                        resolve([]); // Table doesn't exist, skip
                    } else {
                        reject(err);
                    }
                } else {
                    resolve(rows);
                }
            });
        });

        console.log(`📝 Encontradas ${messages.length} mensagens individuais para migrar`);

        for (const message of messages) {
            try {
                await pgDb.saveMessage(message.chat_id, {
                    role: message.role,
                    content: message.content,
                    messageType: message.message_type || 'text',
                    fileInfo: message.file_info,
                    status: message.status || 'sent',
                    retryCount: message.retry_count || 0,
                    errorMessage: message.error_message
                });

                console.log(`✅ Mensagem migrada: ${message.id}`);
            } catch (error) {
                console.error(`❌ Erro ao migrar mensagem ${message.id}:`, error.message);
            }
        }

        console.log('🎉 Migração concluída com sucesso!');
        
    } catch (error) {
        console.error('❌ Erro durante a migração:', error);
        throw error;
    } finally {
        // Close connections
        sqliteDb.close();
        await pgDb.close();
    }
}

async function main() {
    try {
        if (!process.env.DATABASE_URL) {
            console.error('❌ DATABASE_URL não configurada. Configure a variável de ambiente e tente novamente.');
            process.exit(1);
        }

        await migrateSQLiteToPostgres();
        console.log('✅ Migração finalizada!');
        process.exit(0);
    } catch (error) {
        console.error('❌ Falha na migração:', error);
        process.exit(1);
    }
}

// Run migration if called directly
if (require.main === module) {
    main();
}

module.exports = { migrateSQLiteToPostgres };
