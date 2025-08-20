#!/usr/bin/env node
/**
 * Migração via API REST - Sem dependências externas
 * Para ambientes corporativos com restrições
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

class APIMigration {
    constructor() {
        this.DATABASE_URL = 'postgresql://gemini_user:G0RKN3hY6K3C2bUDTjCs1PI6itVYTTbA@dpg-d2ivltruibrs73abk0h0-a.oregon-postgres.render.com/gemini_chat';
        this.sqlitePath = this.findSQLiteDatabase();
        this.renderAppUrl = 'https://gemini-chat-cloud.onrender.com'; // Será atualizado quando souber a URL real
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

    // Método 1: Exportar para JSON e fazer upload manual
    async exportToJSON() {
        if (!this.sqlitePath) {
            console.log('❌ Banco SQLite não encontrado');
            return;
        }

        console.log('📦 Exportando dados para JSON...');

        // Para environments sem sqlite3, vamos ler o arquivo de backup se existir
        const backupPath = path.join(__dirname, 'simple-db-data.json');
        
        if (fs.existsSync(backupPath)) {
            console.log('📁 Usando backup JSON existente...');
            const data = JSON.parse(fs.readFileSync(backupPath, 'utf8'));
            
            const exportData = {
                timestamp: new Date().toISOString(),
                source: 'simple-db-data.json',
                chats: data.chats || [],
                messages: data.messages || [],
                metadata: {
                    total_chats: (data.chats || []).length,
                    export_method: 'json_backup'
                }
            };

            const exportFile = path.join(__dirname, '../migration-export.json');
            fs.writeFileSync(exportFile, JSON.stringify(exportData, null, 2));
            
            console.log(`✅ Dados exportados para: ${exportFile}`);
            console.log(`📊 Total de chats: ${exportData.chats.length}`);
            
            return exportData;
        } else {
            console.log('❌ Arquivo de backup JSON não encontrado');
            console.log('💡 Execute o servidor local uma vez para gerar o backup');
            return null;
        }
    }

    // Método 2: Criar SQL Insert Statements
    async generateSQLInserts() {
        const data = await this.exportToJSON();
        
        if (!data) {
            console.log('❌ Não foi possível exportar dados');
            return;
        }

        console.log('🔧 Gerando statements SQL...');

        let sql = '-- Migração de dados para PostgreSQL\n\n';
        
        // Criar tabelas
        sql += `-- Criar tabelas\n`;
        sql += `CREATE TABLE IF NOT EXISTS chats (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    model TEXT DEFAULT 'gemini-2.5-pro',
    messages JSONB DEFAULT '[]',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);\n\n`;

        sql += `CREATE TABLE IF NOT EXISTS messages (
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
);\n\n`;

        // Inserir chats
        sql += `-- Inserir chats\n`;
        for (const chat of data.chats) {
            const messages = Array.isArray(chat.messages) ? chat.messages : [];
            const title = (chat.title || 'Conversa Sem Título').replace(/'/g, "''");
            const model = chat.model || 'gemini-2.5-pro';
            
            sql += `INSERT INTO chats (id, title, model, messages) VALUES (
    '${chat.id}',
    '${title}',
    '${model}',
    '${JSON.stringify(messages).replace(/'/g, "''")}'
) ON CONFLICT (id) DO NOTHING;\n`;
        }

        sql += '\n-- Migração concluída\n';

        const sqlFile = path.join(__dirname, '../migration.sql');
        fs.writeFileSync(sqlFile, sql);
        
        console.log(`✅ Arquivo SQL gerado: ${sqlFile}`);
        console.log('💡 Execute este SQL no console do PostgreSQL do Render');
        
        return sqlFile;
    }

    // Método 3: Migração via curl/PowerShell
    async generateCurlCommands() {
        const data = await this.exportToJSON();
        
        if (!data) {
            console.log('❌ Não foi possível exportar dados');
            return;
        }

        console.log('📡 Gerando comandos para migração via API...');

        let commands = '# Comandos para migração via API\n\n';
        commands += '# Configure sua URL do app Render:\n';
        commands += '# APP_URL=https://seu-app.onrender.com\n\n';

        for (const chat of data.chats) {
            const chatData = {
                id: chat.id,
                title: chat.title || 'Conversa Sem Título',
                model: chat.model || 'gemini-2.5-pro',
                messages: Array.isArray(chat.messages) ? chat.messages : []
            };

            commands += `# Migrar chat: ${chat.title}\n`;
            commands += `curl -X POST "$APP_URL/api/chats" ^\n`;
            commands += `  -H "Content-Type: application/json" ^\n`;
            commands += `  -d '${JSON.stringify(chatData)}'\n\n`;
        }

        const cmdFile = path.join(__dirname, '../migration-commands.txt');
        fs.writeFileSync(cmdFile, commands);
        
        console.log(`✅ Comandos gerados: ${cmdFile}`);
        console.log('💡 Execute estes comandos após fazer deploy no Render');
        
        return cmdFile;
    }

    async generatePowerShellScript() {
        const data = await this.exportToJSON();
        
        if (!data) return;

        let script = '# Script PowerShell para migração\n';
        script += '$APP_URL = "https://gemini-chat-cloud.onrender.com"\n\n';

        for (const chat of data.chats) {
            const chatData = {
                id: chat.id,
                title: chat.title || 'Conversa Sem Título',
                model: chat.model || 'gemini-2.5-pro',
                messages: Array.isArray(chat.messages) ? chat.messages : []
            };

            script += `# Migrar chat: ${chat.title}\n`;
            script += `$body = '${JSON.stringify(chatData).replace(/'/g, "''").replace(/"/g, '\\"')}'\n`;
            script += `Invoke-RestMethod -Uri "$APP_URL/api/chats" -Method POST -ContentType "application/json" -Body $body\n`;
            script += `Start-Sleep -Seconds 1\n\n`;
        }

        const psFile = path.join(__dirname, '../migration.ps1');
        fs.writeFileSync(psFile, script);
        
        console.log(`✅ Script PowerShell gerado: ${psFile}`);
        return psFile;
    }

    async generateReport() {
        console.log('\n📊 RELATÓRIO DE EXPORTAÇÃO');
        console.log('==========================');
        console.log(`📁 Banco SQLite: ${this.sqlitePath ? 'Encontrado' : 'Não encontrado'}`);
        console.log(`📦 Backup JSON: ${fs.existsSync(path.join(__dirname, 'simple-db-data.json')) ? 'Disponível' : 'Não disponível'}`);
        console.log('\n📁 Arquivos gerados:');
        
        const files = [
            '../migration-export.json',
            '../migration.sql',
            '../migration-commands.txt',
            '../migration.ps1'
        ];

        for (const file of files) {
            const fullPath = path.join(__dirname, file);
            if (fs.existsSync(fullPath)) {
                console.log(`✅ ${file}`);
            }
        }

        console.log('\n🎯 PRÓXIMOS PASSOS:');
        console.log('1. Fazer deploy do app no Render');
        console.log('2. Escolher método de migração:');
        console.log('   - SQL direto no console PostgreSQL');
        console.log('   - PowerShell script');
        console.log('   - Comandos curl');
        console.log('3. Executar o método escolhido');
        console.log('4. Verificar dados no app');
    }
}

async function main() {
    console.log('🔄 MIGRAÇÃO PARA RENDER - MODO CORPORATIVO');
    console.log('==========================================\n');

    const migration = new APIMigration();

    try {
        // Exportar dados
        await migration.exportToJSON();
        
        // Gerar diferentes métodos de migração
        await migration.generateSQLInserts();
        await migration.generateCurlCommands();
        await migration.generatePowerShellScript();
        
        // Relatório final
        await migration.generateReport();

    } catch (error) {
        console.error('❌ ERRO:', error.message);
    }
}

if (require.main === module) {
    main();
}

module.exports = { APIMigration };
