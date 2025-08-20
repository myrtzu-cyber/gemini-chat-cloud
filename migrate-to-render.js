#!/usr/bin/env node
/**
 * Migração de Dados para Render PostgreSQL
 * Migra dados locais (SQLite, JSON, etc.) para o PostgreSQL no Render
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const sqlite3 = require('sqlite3').verbose();

// Configurações
const RENDER_URL = 'https://gemini-chat-cloud.onrender.com';
const BACKUP_DIR = './migration-backups';
const BATCH_SIZE = 5; // Migrar 5 chats por vez para evitar sobrecarga

// Fontes de dados locais possíveis
const DATA_SOURCES = {
    sqlite: './database/chats.db',
    sqliteBackup: './chats.db',
    simpleDb: './backend/simple-db-data.json',
    testDb: './test_database/chats.db'
};

class RenderMigration {
    constructor() {
        this.migratedChats = 0;
        this.migratedMessages = 0;
        this.errors = [];
        this.backupData = null;
    }

    // Fazer request HTTPS para o Render
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

    // Criar diretório de backup
    ensureBackupDir() {
        if (!fs.existsSync(BACKUP_DIR)) {
            fs.mkdirSync(BACKUP_DIR, { recursive: true });
            console.log(`📁 Diretório de backup criado: ${BACKUP_DIR}`);
        }
    }

    // Fazer backup dos dados atuais do Render
    async backupRenderData() {
        console.log('💾 Fazendo backup dos dados atuais do Render...');
        
        try {
            const response = await this.makeRequest('/api/chats');
            
            if (response.status === 200) {
                const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
                const backupFile = path.join(BACKUP_DIR, `render-backup-${timestamp}.json`);
                
                this.backupData = response.data;
                fs.writeFileSync(backupFile, JSON.stringify(response.data, null, 2));
                
                console.log(`✅ Backup salvo: ${backupFile}`);
                console.log(`📊 Dados atuais: ${response.data.length} chats`);
                return true;
            } else {
                throw new Error(`Falha no backup: HTTP ${response.status}`);
            }
        } catch (error) {
            console.error('❌ Erro ao fazer backup:', error.message);
            return false;
        }
    }

    // Verificar se o Render está funcionando
    async checkRenderHealth() {
        console.log('🏥 Verificando saúde do servidor Render...');
        
        try {
            const response = await this.makeRequest('/api/health');
            
            if (response.status === 200) {
                console.log('✅ Servidor Render está saudável');
                console.log(`   Database type: ${response.data.database_type}`);
                
                if (response.data.database_type !== 'postgresql-database') {
                    throw new Error('Render não está usando PostgreSQL!');
                }
                
                return true;
            } else {
                throw new Error(`Health check falhou: HTTP ${response.status}`);
            }
        } catch (error) {
            console.error('❌ Erro no health check:', error.message);
            return false;
        }
    }

    // Carregar dados do SQLite
    async loadSQLiteData(dbPath) {
        return new Promise((resolve, reject) => {
            console.log(`📖 Carregando dados do SQLite: ${dbPath}`);
            
            const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY, (err) => {
                if (err) {
                    reject(new Error(`Erro ao abrir SQLite: ${err.message}`));
                    return;
                }
            });

            const chats = [];
            
            db.all('SELECT * FROM chats ORDER BY created_at DESC', (err, rows) => {
                if (err) {
                    reject(new Error(`Erro ao ler chats: ${err.message}`));
                    return;
                }

                console.log(`📊 Encontrados ${rows.length} chats no SQLite`);
                
                // Processar cada chat
                let processed = 0;
                
                if (rows.length === 0) {
                    db.close();
                    resolve([]);
                    return;
                }

                rows.forEach((chat, index) => {
                    // Parsear mensagens se existirem
                    let messages = [];
                    if (chat.messages) {
                        try {
                            messages = JSON.parse(chat.messages);
                        } catch (e) {
                            console.warn(`⚠️ Erro ao parsear mensagens do chat ${chat.id}`);
                        }
                    }

                    // Parsear contexto se existir
                    let context = null;
                    if (chat.context) {
                        try {
                            context = JSON.parse(chat.context);
                        } catch (e) {
                            console.warn(`⚠️ Erro ao parsear contexto do chat ${chat.id}`);
                        }
                    }

                    chats.push({
                        id: chat.id,
                        title: chat.title,
                        model: chat.model || 'gemini-pro',
                        messages: messages,
                        context: context,
                        created_at: chat.created_at,
                        updated_at: chat.updated_at
                    });

                    processed++;
                    if (processed === rows.length) {
                        db.close();
                        resolve(chats);
                    }
                });
            });
        });
    }

    // Carregar dados do SimpleDatabase JSON
    loadSimpleDbData(jsonPath) {
        console.log(`📖 Carregando dados do SimpleDatabase: ${jsonPath}`);
        
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

            console.log(`📊 Encontrados ${chats.length} chats no SimpleDatabase`);
            return chats;
        } catch (error) {
            console.error(`❌ Erro ao carregar SimpleDatabase: ${error.message}`);
            return [];
        }
    }

    // Detectar e carregar dados locais
    async loadLocalData() {
        console.log('🔍 Procurando dados locais para migrar...');
        
        let allChats = [];

        // Verificar cada fonte de dados
        for (const [source, filePath] of Object.entries(DATA_SOURCES)) {
            if (fs.existsSync(filePath)) {
                console.log(`✅ Encontrado: ${source} em ${filePath}`);
                
                try {
                    let chats = [];
                    
                    if (source.includes('sqlite') || filePath.endsWith('.db')) {
                        chats = await this.loadSQLiteData(filePath);
                    } else if (filePath.endsWith('.json')) {
                        chats = this.loadSimpleDbData(filePath);
                    }

                    // Adicionar fonte aos chats para tracking
                    chats.forEach(chat => {
                        chat._source = source;
                        chat._sourcePath = filePath;
                    });

                    allChats = allChats.concat(chats);
                } catch (error) {
                    console.error(`❌ Erro ao carregar ${source}: ${error.message}`);
                    this.errors.push(`${source}: ${error.message}`);
                }
            }
        }

        // Remover duplicatas baseado no ID
        const uniqueChats = [];
        const seenIds = new Set();

        allChats.forEach(chat => {
            if (!seenIds.has(chat.id)) {
                seenIds.add(chat.id);
                uniqueChats.push(chat);
            } else {
                console.log(`⚠️ Chat duplicado ignorado: ${chat.title} (${chat.id})`);
            }
        });

        console.log(`📊 Total de chats únicos encontrados: ${uniqueChats.length}`);
        return uniqueChats;
    }

    // Verificar se chat já existe no Render
    async chatExistsInRender(chatId) {
        try {
            const response = await this.makeRequest(`/api/chats/${chatId}`);
            return response.status === 200;
        } catch (error) {
            return false;
        }
    }

    // Migrar um chat individual
    async migrateChat(chat) {
        try {
            console.log(`📤 Migrando chat: "${chat.title}" (${chat.id})`);
            
            // Verificar se já existe
            const exists = await this.chatExistsInRender(chat.id);
            if (exists) {
                console.log(`   ⚠️ Chat já existe no Render, pulando...`);
                return { success: true, skipped: true };
            }

            // Criar chat no Render
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
                console.log(`   ✅ Chat migrado com sucesso`);
                console.log(`   📝 Mensagens: ${chat.messages ? chat.messages.length : 0}`);
                console.log(`   🏷️ Fonte: ${chat._source}`);
                
                this.migratedChats++;
                this.migratedMessages += chat.messages ? chat.messages.length : 0;
                
                return { success: true, skipped: false };
            } else {
                throw new Error(`HTTP ${response.status}: ${JSON.stringify(response.data)}`);
            }
        } catch (error) {
            console.error(`   ❌ Erro ao migrar chat: ${error.message}`);
            this.errors.push(`Chat ${chat.id}: ${error.message}`);
            return { success: false, error: error.message };
        }
    }

    // Executar migração completa
    async migrate() {
        console.log('🚀 Iniciando Migração de Dados para Render PostgreSQL');
        console.log('='.repeat(60));

        // Passo 1: Verificações iniciais
        this.ensureBackupDir();
        
        const healthOk = await this.checkRenderHealth();
        if (!healthOk) {
            console.error('❌ Render não está saudável. Abortando migração.');
            return false;
        }

        const backupOk = await this.backupRenderData();
        if (!backupOk) {
            console.error('❌ Falha no backup. Abortando migração.');
            return false;
        }

        // Passo 2: Carregar dados locais
        const localChats = await this.loadLocalData();
        if (localChats.length === 0) {
            console.log('ℹ️ Nenhum dado local encontrado para migrar.');
            return true;
        }

        // Passo 3: Migrar em lotes
        console.log(`\n🔄 Iniciando migração de ${localChats.length} chats...`);
        
        for (let i = 0; i < localChats.length; i += BATCH_SIZE) {
            const batch = localChats.slice(i, i + BATCH_SIZE);
            console.log(`\n📦 Processando lote ${Math.floor(i/BATCH_SIZE) + 1}/${Math.ceil(localChats.length/BATCH_SIZE)}`);
            
            for (const chat of batch) {
                await this.migrateChat(chat);
                
                // Pequena pausa entre migrações
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }

        // Passo 4: Relatório final
        await this.generateReport();
        
        return this.errors.length === 0;
    }

    // Gerar relatório da migração
    async generateReport() {
        console.log('\n' + '='.repeat(60));
        console.log('📊 RELATÓRIO DE MIGRAÇÃO');
        console.log('='.repeat(60));

        console.log(`✅ Chats migrados: ${this.migratedChats}`);
        console.log(`✅ Mensagens migradas: ${this.migratedMessages}`);
        console.log(`❌ Erros: ${this.errors.length}`);

        if (this.errors.length > 0) {
            console.log('\n❌ ERROS ENCONTRADOS:');
            this.errors.forEach((error, index) => {
                console.log(`   ${index + 1}. ${error}`);
            });
        }

        // Verificar estado final do Render
        try {
            const response = await this.makeRequest('/api/stats');
            if (response.status === 200) {
                console.log('\n📈 ESTADO FINAL DO RENDER:');
                console.log(`   Total de chats: ${response.data.total_chats}`);
                console.log(`   Total de mensagens: ${response.data.total_messages}`);
                console.log(`   Tipo de servidor: ${response.data.server_type}`);
            }
        } catch (error) {
            console.log('⚠️ Não foi possível obter estatísticas finais');
        }

        // Salvar relatório
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const reportFile = path.join(BACKUP_DIR, `migration-report-${timestamp}.json`);
        
        const report = {
            timestamp: new Date().toISOString(),
            migratedChats: this.migratedChats,
            migratedMessages: this.migratedMessages,
            errors: this.errors,
            backupData: this.backupData
        };

        fs.writeFileSync(reportFile, JSON.stringify(report, null, 2));
        console.log(`\n📄 Relatório salvo: ${reportFile}`);

        if (this.errors.length === 0) {
            console.log('\n🎉 MIGRAÇÃO CONCLUÍDA COM SUCESSO!');
        } else {
            console.log('\n⚠️ MIGRAÇÃO CONCLUÍDA COM ALGUNS ERROS');
        }
    }
}

// Executar migração se chamado diretamente
async function main() {
    const migration = new RenderMigration();
    
    try {
        const success = await migration.migrate();
        process.exit(success ? 0 : 1);
    } catch (error) {
        console.error('❌ Erro fatal na migração:', error.message);
        process.exit(1);
    }
}

if (require.main === module) {
    main();
}

module.exports = RenderMigration;
