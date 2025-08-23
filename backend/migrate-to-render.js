#!/usr/bin/env node
/**
 * Script de Migração: SQLite Local → PostgreSQL Render
 * Migra dados do banco SQLite local para PostgreSQL do Render
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');
require('dotenv').config();

// Verificar se pg está disponível
let pgAvailable = false;
try {
    require('pg');
    pgAvailable = true;
    console.log('✅ Módulo pg disponível');
} catch (e) {
    console.log('❌ Módulo pg não disponível:', e.message);
    console.log('🔧 Execute: npm install pg');
    process.exit(1);
}

// Verificar se sqlite3 está disponível
let sqliteAvailable = false;
try {
    require('sqlite3');
    sqliteAvailable = true;
    console.log('✅ Módulo sqlite3 disponível');
} catch (e) {
    console.log('❌ Módulo sqlite3 não disponível:', e.message);
    console.log('🔧 Execute: npm install sqlite3');
    process.exit(1);
}

const sqlite3 = require('sqlite3').verbose();
const { Pool } = require('pg');

class RenderMigration {
    constructor() {
        this.sqlitePath = this.findSQLiteDatabase();
        this.pgPool = null;
        this.totalChats = 0;
        this.migratedChats = 0;
        this.errors = [];
    }

    findSQLiteDatabase() {
        const possiblePaths = [
            path.join(__dirname, '../chats.db'),
            path.join(__dirname, '../database/chats.db'),
            path.join(__dirname, '../test_database/chats.db'),
            path.join(process.cwd(), 'chats.db')
        ];

        for (const dbPath of possiblePaths) {
            if (fs.existsSync(dbPath)) {
                console.log(`📁 Banco SQLite encontrado: ${dbPath}`);
                return dbPath;
            }
        }

        return null;
    }

    async connectPostgreSQL() {
        const DATABASE_URL = process.env.DATABASE_URL;
        
        if (!DATABASE_URL) {
            throw new Error('❌ DATABASE_URL não configurada. Configure a variável de ambiente.');
        }

        console.log('🔗 Conectando ao PostgreSQL...');
        this.pgPool = new Pool({
            connectionString: DATABASE_URL,
            ssl: DATABASE_URL.includes('render.com') ? { rejectUnauthorized: false } : false
        });

        // Testar conexão
        const client = await this.pgPool.connect();
        console.log('✅ Conexão PostgreSQL estabelecida');
        client.release();
    }

    async createTables() {
        console.log('🏗️  Criando tabelas no PostgreSQL...');
        
        const createChatsTable = `
            CREATE TABLE IF NOT EXISTS chats (
                id TEXT PRIMARY KEY,
                title TEXT NOT NULL,
                model TEXT DEFAULT 'gemini-2.5-pro',
                messages JSONB DEFAULT '[]',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `;

        const createMessagesTable = `
            CREATE TABLE IF NOT EXISTS messages (
                id SERIAL PRIMARY KEY,
                chat_id TEXT REFERENCES chats(id) ON DELETE CASCADE,
                role TEXT NOT NULL,
                content TEXT NOT NULL,
                message_type TEXT DEFAULT 'text',
                file_info JSONB,
                status TEXT DEFAULT 'sent',
                retry_count INTEGER DEFAULT 0,
                error_message TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `;

        const createIndexes = `
            CREATE INDEX IF NOT EXISTS idx_chats_updated_at ON chats(updated_at);
            CREATE INDEX IF NOT EXISTS idx_messages_chat_id ON messages(chat_id);
            CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at);
        `;

        await this.pgPool.query(createChatsTable);
        await this.pgPool.query(createMessagesTable);
        await this.pgPool.query(createIndexes);
        
        console.log('✅ Tabelas criadas com sucesso');
    }

    async migrateSQLiteData() {
        if (!this.sqlitePath) {
            console.log('⚠️  Nenhum banco SQLite encontrado. Criando estrutura vazia...');
            return;
        }

        console.log('📊 Iniciando migração de dados...');
        
        return new Promise((resolve, reject) => {
            const db = new sqlite3.Database(this.sqlitePath, (err) => {
                if (err) {
                    reject(new Error(`Erro ao abrir SQLite: ${err.message}`));
                    return;
                }
                console.log('✅ Banco SQLite conectado');
                this.performMigration(db, resolve, reject);
            });
        });
    }

    async performMigration(sqliteDb, resolve, reject) {
        try {
            // Migrar chats
            await this.migrateChats(sqliteDb);
            
            // Migrar mensagens (se existir tabela separada)
            await this.migrateMessages(sqliteDb);
            
            sqliteDb.close();
            resolve();
            
        } catch (error) {
            sqliteDb.close();
            reject(error);
        }
    }

    async migrateChats(sqliteDb) {
        console.log('📝 Migrando conversas...');
        
        const chats = await new Promise((resolve, reject) => {
            sqliteDb.all('SELECT * FROM chats', (err, rows) => {
                if (err) reject(err);
                else resolve(rows || []);
            });
        });

        this.totalChats = chats.length;
        console.log(`📊 Encontradas ${this.totalChats} conversas`);

        for (const chat of chats) {
            try {
                let messages = [];
                
                // Parse messages se existirem
                if (chat.messages) {
                    try {
                        messages = JSON.parse(chat.messages);
                    } catch (e) {
                        console.warn(`⚠️  Erro ao parsear mensagens do chat ${chat.id}`);
                        messages = [];
                    }
                }

                // Verificar se chat já existe
                const existingChat = await this.pgPool.query(
                    'SELECT id FROM chats WHERE id = $1', 
                    [chat.id]
                );

                if (existingChat.rows.length > 0) {
                    console.log(`⏭️  Chat ${chat.id} já existe, pulando...`);
                    continue;
                }

                // Inserir chat
                await this.pgPool.query(
                    `INSERT INTO chats (id, title, model, messages, created_at, updated_at) 
                     VALUES ($1, $2, $3, $4, $5, $6)`,
                    [
                        chat.id,
                        chat.title || 'Conversa Sem Título',
                        chat.model || 'gemini-2.5-pro',
                        JSON.stringify(messages),
                        chat.created_at || new Date(),
                        chat.updated_at || new Date()
                    ]
                );

                this.migratedChats++;
                console.log(`✅ Chat migrado: ${chat.title} (${chat.id})`);
                
            } catch (error) {
                const errorMsg = `Erro ao migrar chat ${chat.id}: ${error.message}`;
                console.error(`❌ ${errorMsg}`);
                this.errors.push(errorMsg);
            }
        }
    }

    async migrateMessages(sqliteDb) {
        console.log('💬 Verificando mensagens individuais...');
        
        const messages = await new Promise((resolve, reject) => {
            sqliteDb.all('SELECT * FROM messages', (err, rows) => {
                if (err) {
                    if (err.message.includes('no such table')) {
                        console.log('📝 Tabela messages não existe, pulando...');
                        resolve([]);
                    } else {
                        reject(err);
                    }
                } else {
                    resolve(rows || []);
                }
            });
        });

        console.log(`📊 Encontradas ${messages.length} mensagens individuais`);

        for (const message of messages) {
            try {
                await this.pgPool.query(
                    `INSERT INTO messages (chat_id, role, content, message_type, file_info, status, retry_count, error_message, created_at) 
                     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
                    [
                        message.chat_id,
                        message.role,
                        message.content,
                        message.message_type || 'text',
                        message.file_info ? JSON.stringify(message.file_info) : null,
                        message.status || 'sent',
                        message.retry_count || 0,
                        message.error_message,
                        message.created_at || new Date()
                    ]
                );

                console.log(`✅ Mensagem migrada: ${message.id}`);
                
            } catch (error) {
                // Erro não crítico para mensagens
                console.warn(`⚠️  Erro ao migrar mensagem ${message.id}: ${error.message}`);
            }
        }
    }

    async generateReport() {
        console.log('\n📊 RELATÓRIO DE MIGRAÇÃO');
        console.log('========================');
        console.log(`📝 Total de chats: ${this.totalChats}`);
        console.log(`✅ Chats migrados: ${this.migratedChats}`);
        console.log(`❌ Erros: ${this.errors.length}`);
        
        if (this.errors.length > 0) {
            console.log('\n❌ ERROS ENCONTRADOS:');
            this.errors.forEach((error, index) => {
                console.log(`${index + 1}. ${error}`);
            });
        }

        // Verificar dados no PostgreSQL
        const result = await this.pgPool.query('SELECT COUNT(*) as total FROM chats');
        console.log(`🗄️  Total de chats no PostgreSQL: ${result.rows[0].total}`);
        
        console.log('\n🎉 Migração finalizada!');
    }

    async close() {
        if (this.pgPool) {
            await this.pgPool.end();
            console.log('🔌 Conexão PostgreSQL fechada');
        }
    }
}

async function confirmMigration() {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    return new Promise((resolve) => {
        rl.question('⚠️  Isso irá migrar dados para o PostgreSQL. Continuar? (s/N): ', (answer) => {
            rl.close();
            resolve(answer.toLowerCase() === 's' || answer.toLowerCase() === 'sim');
        });
    });
}

async function main() {
    console.log('🚀 MIGRAÇÃO SQLITE → POSTGRESQL RENDER');
    console.log('======================================\n');

    const migration = new RenderMigration();

    try {
        // Confirmar migração
        if (process.argv.includes('--force')) {
            console.log('🔧 Modo força ativado, pulando confirmação...');
        } else {
            const confirmed = await confirmMigration();
            if (!confirmed) {
                console.log('❌ Migração cancelada pelo usuário');
                process.exit(0);
            }
        }

        // Conectar ao PostgreSQL
        await migration.connectPostgreSQL();

        // Criar tabelas
        await migration.createTables();

        // Migrar dados
        await migration.migrateSQLiteData();

        // Gerar relatório
        await migration.generateReport();

        process.exit(0);

    } catch (error) {
        console.error('❌ ERRO NA MIGRAÇÃO:', error.message);
        console.error('Stack trace:', error.stack);
        process.exit(1);
        
    } finally {
        await migration.close();
    }
}

// Executar se chamado diretamente
if (require.main === module) {
    main();
}

module.exports = { RenderMigration };
