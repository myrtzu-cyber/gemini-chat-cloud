/**
 * Script para restaurar dados perdidos no database cloud
 * Re-importa dados do arquivo de export local
 */

const fs = require('fs');
const https = require('https');

// Configuração para ambiente corporativo
process.env["NODE_TLS_REJECT_UNAUTHORIZED"] = 0;

const httpsAgent = new https.Agent({
    rejectUnauthorized: false,
    secureProtocol: 'TLSv1_2_method'
});

const RENDER_URL = process.argv[2] || 'https://gemini-chat-cloud.onrender.com';
const EXPORT_FILE = process.argv[3] || 'database_export_20250819_202738.json';

console.log('🔄 Restauração de Dados Perdidos');
console.log('=================================');
console.log(`🌐 URL: ${RENDER_URL}`);
console.log(`📁 Arquivo: ${EXPORT_FILE}`);
console.log('');

// Função para fazer request
function makeRequest(url, options = {}) {
    return new Promise((resolve) => {
        const urlObj = new URL(url);
        const requestOptions = {
            hostname: urlObj.hostname,
            port: 443,
            path: urlObj.pathname,
            method: options.method || 'GET',
            headers: {
                'Content-Type': 'application/json',
                'User-Agent': 'Data-Restore-Tool/1.0',
                ...options.headers
            },
            agent: httpsAgent,
            rejectUnauthorized: false,
            timeout: 60000
        };

        const req = https.request(requestOptions, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    resolve({ 
                        success: res.statusCode >= 200 && res.statusCode < 300, 
                        status: res.statusCode, 
                        data: JSON.parse(data),
                        rawData: data
                    });
                } catch (error) {
                    resolve({ 
                        success: res.statusCode >= 200 && res.statusCode < 300,
                        status: res.statusCode,
                        error: 'Invalid JSON response',
                        rawData: data
                    });
                }
            });
        });

        req.on('error', (error) => {
            resolve({ success: false, error: error.message });
        });

        req.on('timeout', () => {
            req.destroy();
            resolve({ success: false, error: 'Request timeout' });
        });

        if (options.body) {
            req.write(typeof options.body === 'string' ? options.body : JSON.stringify(options.body));
        }

        req.end();
    });
}

// Verificar estado atual do database
async function checkCurrentState() {
    console.log('🔍 1. Verificando estado atual do database...');
    
    const stats = await makeRequest(`${RENDER_URL}/api/stats`);
    if (!stats.success) {
        console.log('❌ Falha ao obter stats');
        return false;
    }
    
    console.log(`📊 Chats atuais: ${stats.data.total_chats}`);
    console.log(`📊 Mensagens atuais: ${stats.data.total_messages}`);
    console.log(`📊 Server type: ${stats.data.server_type}`);
    
    if (stats.data.total_chats > 0) {
        console.log('⚠️ Database não está vazio!');
        console.log('💡 Continuando com import (dados serão mesclados)');
    } else {
        console.log('✅ Database vazio - pronto para restauração');
    }
    
    return true;
}

// Verificar arquivo de export
async function validateExportFile() {
    console.log('\n📁 2. Verificando arquivo de export...');
    
    if (!fs.existsSync(EXPORT_FILE)) {
        console.log(`❌ Arquivo não encontrado: ${EXPORT_FILE}`);
        console.log('💡 Arquivos disponíveis:');
        
        const files = fs.readdirSync('.')
            .filter(file => file.startsWith('database_export_') && file.endsWith('.json'))
            .sort()
            .reverse();
        
        if (files.length > 0) {
            files.forEach((file, index) => {
                console.log(`   ${index + 1}. ${file}`);
            });
            console.log(`💡 Use: node restore-lost-data.js ${RENDER_URL} ${files[0]}`);
        } else {
            console.log('   Nenhum arquivo de export encontrado');
            console.log('💡 Execute: python export-database.py');
        }
        return false;
    }
    
    try {
        const content = fs.readFileSync(EXPORT_FILE, 'utf8');
        const data = JSON.parse(content);
        
        console.log(`✅ Arquivo válido: ${EXPORT_FILE}`);
        console.log(`📊 Chats para restaurar: ${data.chats ? data.chats.length : 0}`);
        console.log(`📊 Mensagens para restaurar: ${data.messages ? data.messages.length : 0}`);
        
        if (data.chats && data.chats.length > 0) {
            console.log('📋 Chats encontrados:');
            data.chats.forEach((chat, index) => {
                console.log(`   ${index + 1}. "${chat.title}" (${chat.messages ? chat.messages.length : 0} mensagens)`);
            });
        }
        
        return data;
    } catch (error) {
        console.log(`❌ Erro ao ler arquivo: ${error.message}`);
        return false;
    }
}

// Fazer backup dos dados atuais (se existirem)
async function backupCurrentData() {
    console.log('\n💾 3. Fazendo backup dos dados atuais...');
    
    const chats = await makeRequest(`${RENDER_URL}/api/chats`);
    if (chats.success && chats.data.length > 0) {
        const backupData = {
            export_info: {
                timestamp: new Date().toISOString(),
                source: 'cloud-backup-before-restore',
                total_chats: chats.data.length,
                total_messages: chats.data.reduce((sum, chat) => sum + (chat.messages?.length || 0), 0)
            },
            chats: chats.data,
            messages: []
        };
        
        const backupFile = `cloud_backup_before_restore_${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
        fs.writeFileSync(backupFile, JSON.stringify(backupData, null, 2));
        console.log(`✅ Backup salvo: ${backupFile}`);
        return backupFile;
    } else {
        console.log('ℹ️ Nenhum dado atual para backup');
        return null;
    }
}

// Restaurar dados
async function restoreData(exportData) {
    console.log('\n📤 4. Restaurando dados...');
    console.log('⏳ Aguarde, isso pode levar alguns minutos...');
    
    const result = await makeRequest(`${RENDER_URL}/api/import`, {
        method: 'POST',
        body: exportData
    });
    
    if (result.success) {
        console.log('✅ Dados restaurados com sucesso!');
        console.log(`📊 Resultado: ${JSON.stringify(result.data)}`);
        return true;
    } else {
        console.log('❌ Falha na restauração');
        console.log(`📊 Status: ${result.status}`);
        console.log(`📊 Erro: ${result.error || 'Unknown error'}`);
        if (result.rawData) {
            console.log(`📊 Resposta: ${result.rawData.substring(0, 500)}...`);
        }
        return false;
    }
}

// Verificar dados após restauração
async function verifyRestoration(originalData) {
    console.log('\n🔍 5. Verificando dados restaurados...');
    
    // Stats
    const stats = await makeRequest(`${RENDER_URL}/api/stats`);
    if (stats.success) {
        console.log(`📊 Chats após restauração: ${stats.data.total_chats}`);
        console.log(`📊 Mensagens após restauração: ${stats.data.total_messages}`);
        
        const expectedChats = originalData.chats ? originalData.chats.length : 0;
        const expectedMessages = originalData.messages ? originalData.messages.length : 0;
        
        if (stats.data.total_chats >= expectedChats) {
            console.log('✅ Chats restaurados corretamente');
        } else {
            console.log(`⚠️ Possível problema: esperado ${expectedChats}, atual ${stats.data.total_chats}`);
        }
    }
    
    // Testar endpoint /api/chats/last
    const lastChat = await makeRequest(`${RENDER_URL}/api/chats/last`);
    if (lastChat.success) {
        console.log(`✅ Último chat: "${lastChat.data.title}"`);
        console.log(`📊 Mensagens: ${lastChat.data.messages ? lastChat.data.messages.length : 0}`);
    } else {
        console.log('❌ Falha ao obter último chat');
    }
    
    // Lista de chats
    const allChats = await makeRequest(`${RENDER_URL}/api/chats`);
    if (allChats.success) {
        console.log(`✅ Lista de chats: ${allChats.data.length} encontrados`);
        
        if (allChats.data.length > 0) {
            console.log('📋 Chats disponíveis:');
            allChats.data.forEach((chat, index) => {
                console.log(`   ${index + 1}. "${chat.title}" (${chat.messages ? chat.messages.length : 0} mensagens)`);
            });
        }
    }
}

// Função principal
async function restoreLostData() {
    try {
        // Verificar estado atual
        if (!(await checkCurrentState())) {
            return;
        }
        
        // Validar arquivo de export
        const exportData = await validateExportFile();
        if (!exportData) {
            return;
        }
        
        // Fazer backup dos dados atuais
        await backupCurrentData();
        
        // Restaurar dados
        const success = await restoreData(exportData);
        if (!success) {
            return;
        }
        
        // Verificar restauração
        await verifyRestoration(exportData);
        
        console.log('\n🎉 Restauração Concluída!');
        console.log('========================');
        console.log('✅ Dados restaurados com sucesso');
        console.log(`🌐 Acesse: ${RENDER_URL}`);
        console.log('💡 O chat deve carregar automaticamente');
        
        console.log('\n🧪 Próximos testes:');
        console.log(`1. Teste endpoint: node test-chats-last-endpoint.js ${RENDER_URL}`);
        console.log(`2. Acesse frontend: ${RENDER_URL}`);
        console.log(`3. Verifique mobile: ${RENDER_URL}/mobile`);
        
    } catch (error) {
        console.log(`❌ Erro durante restauração: ${error.message}`);
    }
}

if (require.main === module) {
    restoreLostData().catch(console.error);
}

module.exports = { restoreLostData };
