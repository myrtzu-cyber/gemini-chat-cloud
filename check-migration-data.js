#!/usr/bin/env node
/**
 * Verificação de Dados para Migração
 * Analisa dados locais antes da migração para o Render
 */

const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

// Fontes de dados locais
const DATA_SOURCES = {
    sqlite: './database/chats.db',
    sqliteBackup: './chats.db',
    simpleDb: './backend/simple-db-data.json',
    testDb: './test_database/chats.db'
};

class MigrationDataChecker {
    constructor() {
        this.totalChats = 0;
        this.totalMessages = 0;
        this.sources = [];
    }

    // Analisar SQLite
    async analyzeSQLite(dbPath) {
        return new Promise((resolve, reject) => {
            console.log(`🔍 Analisando SQLite: ${dbPath}`);
            
            const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY, (err) => {
                if (err) {
                    reject(new Error(`Erro ao abrir SQLite: ${err.message}`));
                    return;
                }
            });

            const analysis = {
                source: dbPath,
                type: 'SQLite',
                chats: 0,
                messages: 0,
                chatDetails: []
            };

            db.all('SELECT * FROM chats ORDER BY created_at DESC', (err, rows) => {
                if (err) {
                    reject(new Error(`Erro ao ler chats: ${err.message}`));
                    return;
                }

                analysis.chats = rows.length;
                
                rows.forEach(chat => {
                    let messageCount = 0;
                    if (chat.messages) {
                        try {
                            const messages = JSON.parse(chat.messages);
                            messageCount = Array.isArray(messages) ? messages.length : 0;
                        } catch (e) {
                            messageCount = 0;
                        }
                    }

                    analysis.chatDetails.push({
                        id: chat.id,
                        title: chat.title,
                        messageCount: messageCount,
                        hasContext: !!chat.context,
                        created: chat.created_at,
                        updated: chat.updated_at
                    });

                    analysis.messages += messageCount;
                });

                db.close();
                resolve(analysis);
            });
        });
    }

    // Analisar SimpleDatabase JSON
    analyzeSimpleDb(jsonPath) {
        console.log(`🔍 Analisando SimpleDatabase: ${jsonPath}`);
        
        try {
            const data = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
            
            const analysis = {
                source: jsonPath,
                type: 'SimpleDatabase JSON',
                chats: 0,
                messages: 0,
                chatDetails: []
            };

            if (data.chats && Array.isArray(data.chats)) {
                analysis.chats = data.chats.length;
                
                data.chats.forEach(chat => {
                    // Contar mensagens deste chat
                    const chatMessages = data.messages ? 
                        data.messages.filter(msg => msg.chat_id === chat.id) : [];
                    
                    analysis.chatDetails.push({
                        id: chat.id,
                        title: chat.title,
                        messageCount: chatMessages.length,
                        hasContext: !!chat.context,
                        created: chat.created_at,
                        updated: chat.updated_at
                    });
                });

                if (data.messages && Array.isArray(data.messages)) {
                    analysis.messages = data.messages.length;
                }
            }

            return analysis;
        } catch (error) {
            console.error(`❌ Erro ao analisar SimpleDatabase: ${error.message}`);
            return null;
        }
    }

    // Verificar todas as fontes
    async checkAllSources() {
        console.log('🔍 VERIFICAÇÃO DE DADOS PARA MIGRAÇÃO');
        console.log('='.repeat(50));

        for (const [sourceName, filePath] of Object.entries(DATA_SOURCES)) {
            if (fs.existsSync(filePath)) {
                console.log(`\n✅ Encontrado: ${sourceName}`);
                console.log(`   Caminho: ${filePath}`);
                
                try {
                    let analysis = null;
                    
                    if (sourceName.includes('sqlite') || filePath.endsWith('.db')) {
                        analysis = await this.analyzeSQLite(filePath);
                    } else if (filePath.endsWith('.json')) {
                        analysis = this.analyzeSimpleDb(filePath);
                    }

                    if (analysis) {
                        this.sources.push(analysis);
                        this.totalChats += analysis.chats;
                        this.totalMessages += analysis.messages;
                        
                        console.log(`   📊 Chats: ${analysis.chats}`);
                        console.log(`   💬 Mensagens: ${analysis.messages}`);
                        
                        if (analysis.chatDetails.length > 0) {
                            console.log(`   📝 Últimos chats:`);
                            analysis.chatDetails.slice(0, 3).forEach(chat => {
                                console.log(`      - "${chat.title}" (${chat.messageCount} msgs)`);
                            });
                        }
                    }
                } catch (error) {
                    console.error(`   ❌ Erro: ${error.message}`);
                }
            } else {
                console.log(`❌ Não encontrado: ${sourceName} (${filePath})`);
            }
        }
    }

    // Detectar duplicatas
    detectDuplicates() {
        console.log('\n🔍 VERIFICANDO DUPLICATAS');
        console.log('-'.repeat(30));

        const allChats = [];
        this.sources.forEach(source => {
            source.chatDetails.forEach(chat => {
                allChats.push({
                    ...chat,
                    source: source.source
                });
            });
        });

        const chatIds = allChats.map(chat => chat.id);
        const duplicateIds = chatIds.filter((id, index) => chatIds.indexOf(id) !== index);
        const uniqueDuplicates = [...new Set(duplicateIds)];

        if (uniqueDuplicates.length > 0) {
            console.log(`⚠️ Encontradas ${uniqueDuplicates.length} duplicatas:`);
            uniqueDuplicates.forEach(id => {
                const duplicates = allChats.filter(chat => chat.id === id);
                console.log(`   ID: ${id}`);
                duplicates.forEach(dup => {
                    console.log(`      - "${dup.title}" em ${dup.source}`);
                });
            });
        } else {
            console.log('✅ Nenhuma duplicata encontrada');
        }

        return uniqueDuplicates.length;
    }

    // Gerar relatório detalhado
    generateDetailedReport() {
        console.log('\n📊 RELATÓRIO DETALHADO');
        console.log('='.repeat(50));

        console.log(`📁 Fontes encontradas: ${this.sources.length}`);
        console.log(`💬 Total de chats: ${this.totalChats}`);
        console.log(`📝 Total de mensagens: ${this.totalMessages}`);

        if (this.sources.length > 0) {
            console.log('\n📋 DETALHES POR FONTE:');
            this.sources.forEach((source, index) => {
                console.log(`\n${index + 1}. ${source.type}`);
                console.log(`   Arquivo: ${source.source}`);
                console.log(`   Chats: ${source.chats}`);
                console.log(`   Mensagens: ${source.messages}`);
                
                if (source.chatDetails.length > 0) {
                    console.log(`   Chats mais recentes:`);
                    source.chatDetails.slice(0, 5).forEach(chat => {
                        const contextInfo = chat.hasContext ? ' [+context]' : '';
                        console.log(`      - "${chat.title}" (${chat.messageCount} msgs)${contextInfo}`);
                    });
                }
            });
        }

        // Salvar relatório em arquivo
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const reportFile = `migration-check-${timestamp}.json`;
        
        const report = {
            timestamp: new Date().toISOString(),
            summary: {
                totalSources: this.sources.length,
                totalChats: this.totalChats,
                totalMessages: this.totalMessages
            },
            sources: this.sources
        };

        fs.writeFileSync(reportFile, JSON.stringify(report, null, 2));
        console.log(`\n📄 Relatório salvo em: ${reportFile}`);
    }

    // Executar verificação completa
    async run() {
        try {
            await this.checkAllSources();
            const duplicates = this.detectDuplicates();
            this.generateDetailedReport();

            console.log('\n🎯 RESUMO PARA MIGRAÇÃO:');
            console.log(`   ✅ Dados encontrados: ${this.sources.length > 0 ? 'Sim' : 'Não'}`);
            console.log(`   📊 Total para migrar: ${this.totalChats} chats, ${this.totalMessages} mensagens`);
            console.log(`   ⚠️ Duplicatas: ${duplicates} encontradas`);
            
            if (this.sources.length > 0) {
                console.log('\n🚀 Pronto para migração!');
                console.log('   Execute: node migrate-to-render.js');
            } else {
                console.log('\n💡 Nenhum dado local encontrado para migrar.');
            }

            return this.sources.length > 0;
        } catch (error) {
            console.error('❌ Erro na verificação:', error.message);
            return false;
        }
    }
}

// Executar se chamado diretamente
if (require.main === module) {
    const checker = new MigrationDataChecker();
    checker.run().then(hasData => {
        process.exit(hasData ? 0 : 1);
    });
}

module.exports = MigrationDataChecker;
