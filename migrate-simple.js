#!/usr/bin/env node
/**
 * Migração Simples para Render (sem SQLite)
 * Migra apenas dados JSON para o PostgreSQL no Render
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

const RENDER_URL = 'https://gemini-chat-cloud.onrender.com';
const BACKUP_DIR = './migration-backups';

// Fontes de dados JSON
const JSON_SOURCES = [
    './backend/simple-db-data.json',
    './simple-db-data.json',
    './backend/simple-db-data-backup.json'
];

class SimpleMigration {
    constructor() {
        this.migratedChats = 0;
        this.migratedMessages = 0;
        this.errors = [];
    }

    makeRequest(endpoint, options = {}) {
        return new Promise((resolve, reject) => {
            const url = `${RENDER_URL}${endpoint}`;
            const requestOptions = {
                ...options,
                headers: {
                    'Content-Type': 'application/json',
                    ...options.headers
                },
                rejectUnauthorized: false
            };

            const req = https.request(url, requestOptions, (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => {
                    try {
                        const jsonData = JSON.parse(data);
                        resolve({ status: res.statusCode, data: jsonData });
                    } catch (error) {
                        resolve({ status: res.statusCode, data: data });
                    }
                });
            });

            req.on('error', reject);
            
            if (options.body) {
                req.write(typeof options.body === 'string' ? options.body : JSON.stringify(options.body));
            }
            
            req.end();
        });
    }

    ensureBackupDir() {
        if (!fs.existsSync(BACKUP_DIR)) {
            fs.mkdirSync(BACKUP_DIR, { recursive: true });
        }
    }

    async backupRenderData() {
        console.log('💾 Fazendo backup dos dados atuais do Render...');
        
        try {
            const response = await this.makeRequest('/api/chats');
            
            if (response.status === 200) {
                const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
                const backupFile = path.join(BACKUP_DIR, `render-backup-${timestamp}.json`);
                
                fs.writeFileSync(backupFile, JSON.stringify(response.data, null, 2));
                console.log(`✅ Backup salvo: ${backupFile}`);
                console.log(`📊 Dados atuais: ${response.data.length} chats`);
                return true;
            }
        } catch (error) {
            console.error('❌ Erro no backup:', error.message);
        }
        return false;
    }

    loadJsonData() {
        console.log('🔍 Procurando dados JSON locais...');
        
        for (const jsonPath of JSON_SOURCES) {
            if (fs.existsSync(jsonPath)) {
                console.log(`✅ Encontrado: ${jsonPath}`);
                
                try {
                    const data = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
                    const chats = [];

                    if (data.chats && Array.isArray(data.chats)) {
                        data.chats.forEach(chat => {
                            // Encontrar mensagens deste chat
                            const chatMessages = data.messages ? 
                                data.messages.filter(msg => msg.chat_id === chat.id) : [];

                            // Converter mensagens para formato esperado
                            const messages = chatMessages.map(msg => ({
                                id: msg.id,
                                sender: msg.sender,
                                content: msg.content,
                                files: JSON.parse(msg.files || '[]'),
                                created_at: msg.created_at
                            }));

                            chats.push({
                                id: chat.id,
                                title: chat.title,
                                model: chat.model || 'gemini-pro',
                                messages: messages,
                                context: chat.context ? JSON.parse(chat.context) : null,
                                created_at: chat.created_at,
                                updated_at: chat.updated_at
                            });
                        });
                    }

                    console.log(`📊 Encontrados ${chats.length} chats`);
                    console.log(`📝 Total de mensagens: ${data.messages ? data.messages.length : 0}`);
                    
                    if (chats.length > 0) {
                        console.log('📋 Chats encontrados:');
                        chats.forEach((chat, index) => {
                            console.log(`   ${index + 1}. "${chat.title}" (${chat.messages.length} mensagens)`);
                        });
                    }
                    
                    return chats;
                } catch (error) {
                    console.error(`❌ Erro ao ler ${jsonPath}: ${error.message}`);
                }
            }
        }

        console.log('❌ Nenhum arquivo de dados JSON encontrado');
        return [];
    }

    async chatExists(chatId) {
        try {
            const response = await this.makeRequest(`/api/chats/${chatId}`);
            return response.status === 200;
        } catch (error) {
            return false;
        }
    }

    async migrateChat(chat) {
        try {
            console.log(`📤 Migrando: "${chat.title}"`);
            
            // Verificar se já existe
            if (await this.chatExists(chat.id)) {
                console.log(`   ⚠️ Chat já existe, pulando...`);
                return { success: true, skipped: true };
            }

            const response = await this.makeRequest('/api/chats', {
                method: 'POST',
                body: {
                    id: chat.id,
                    title: chat.title,
                    model: chat.model,
                    messages: chat.messages || [],
                    context: chat.context
                }
            });

            if (response.status === 200 || response.status === 201) {
                console.log(`   ✅ Migrado com sucesso (${chat.messages.length} mensagens)`);
                this.migratedChats++;
                this.migratedMessages += chat.messages.length;
                return { success: true, skipped: false };
            } else {
                throw new Error(`HTTP ${response.status}`);
            }
        } catch (error) {
            console.error(`   ❌ Erro: ${error.message}`);
            this.errors.push(`${chat.title}: ${error.message}`);
            return { success: false };
        }
    }

    async migrate() {
        console.log('🚀 MIGRAÇÃO SIMPLES PARA RENDER');
        console.log('='.repeat(40));

        this.ensureBackupDir();

        // Verificar Render
        console.log('🏥 Verificando Render...');
        try {
            const health = await this.makeRequest('/api/health');
            if (health.status !== 200) {
                throw new Error('Render não está respondendo');
            }
            console.log('✅ Render está funcionando');
        } catch (error) {
            console.error('❌ Erro no Render:', error.message);
            return false;
        }

        // Backup
        await this.backupRenderData();

        // Carregar dados locais
        const chats = this.loadJsonData();
        if (chats.length === 0) {
            console.log('ℹ️ Nenhum dado para migrar');
            return true;
        }

        // Migrar
        console.log(`\n🔄 Migrando ${chats.length} chats...`);
        for (const chat of chats) {
            await this.migrateChat(chat);
            await new Promise(resolve => setTimeout(resolve, 1000)); // Pausa
        }

        // Relatório
        console.log('\n📊 RELATÓRIO:');
        console.log(`✅ Chats migrados: ${this.migratedChats}`);
        console.log(`✅ Mensagens migradas: ${this.migratedMessages}`);
        console.log(`❌ Erros: ${this.errors.length}`);

        if (this.errors.length > 0) {
            console.log('\n❌ ERROS:');
            this.errors.forEach(error => console.log(`   - ${error}`));
        }

        // Verificar resultado
        try {
            const stats = await this.makeRequest('/api/stats');
            if (stats.status === 200) {
                console.log('\n📈 ESTADO FINAL:');
                console.log(`   Chats no Render: ${stats.data.total_chats}`);
                console.log(`   Mensagens no Render: ${stats.data.total_messages}`);
            }
        } catch (error) {
            console.log('⚠️ Não foi possível obter estatísticas finais');
        }

        console.log(this.errors.length === 0 ? '\n🎉 MIGRAÇÃO CONCLUÍDA!' : '\n⚠️ MIGRAÇÃO CONCLUÍDA COM ERROS');
        return this.errors.length === 0;
    }
}

// Executar
if (require.main === module) {
    const migration = new SimpleMigration();
    migration.migrate().then(success => {
        process.exit(success ? 0 : 1);
    }).catch(error => {
        console.error('❌ Erro fatal:', error.message);
        process.exit(1);
    });
}

module.exports = SimpleMigration;
