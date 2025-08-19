/**
 * Script para importar dados locais para database na cloud
 * Versão corporativa - contorna problemas SSL
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

// Configuração para ambiente corporativo
process.env["NODE_TLS_REJECT_UNAUTHORIZED"] = 0;

// Configurar agent HTTPS personalizado
const httpsAgent = new https.Agent({
    rejectUnauthorized: false,
    secureProtocol: 'TLSv1_2_method'
});

const RENDER_URL = process.argv[2] || 'https://gemini-chat-cloud.onrender.com';
const EXPORT_FILE = process.argv[3];

console.log('📦 Import de Dados para Cloud (Corporativo)');
console.log('===========================================');
console.log(`🌐 URL: ${RENDER_URL}`);
console.log(`📁 Arquivo: ${EXPORT_FILE || 'Auto-detectar'}`);
console.log('⚠️  SSL Validation: DISABLED (ambiente corporativo)');
console.log('');

// Função para fazer request HTTP/HTTPS com configuração corporativa
function makeRequest(url, options = {}) {
    return new Promise((resolve, reject) => {
        const urlObj = new URL(url);
        const isHttps = urlObj.protocol === 'https:';
        const client = isHttps ? https : http;
        
        const requestOptions = {
            hostname: urlObj.hostname,
            port: urlObj.port || (isHttps ? 443 : 80),
            path: urlObj.pathname + urlObj.search,
            method: options.method || 'GET',
            headers: {
                'Content-Type': 'application/json',
                'User-Agent': 'Corporate-Data-Importer/1.0',
                ...options.headers
            },
            agent: isHttps ? httpsAgent : undefined,
            rejectUnauthorized: false,
            timeout: 60000 // 60 segundos para import
        };

        const req = client.request(requestOptions, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const jsonData = JSON.parse(data);
                    resolve({ 
                        success: res.statusCode >= 200 && res.statusCode < 300, 
                        status: res.statusCode, 
                        data: jsonData
                    });
                } catch (error) {
                    resolve({ 
                        success: false, 
                        error: 'Invalid JSON response',
                        rawData: data,
                        status: res.statusCode
                    });
                }
            });
        });

        req.on('error', (error) => {
            resolve({ success: false, error: error.message, code: error.code });
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

// Função para encontrar arquivo de export mais recente
function findLatestExportFile() {
    try {
        const files = fs.readdirSync('.')
            .filter(file => file.startsWith('database_export_') && file.endsWith('.json'))
            .sort()
            .reverse();
        
        return files.length > 0 ? files[0] : null;
    } catch (error) {
        return null;
    }
}

// Função para validar arquivo de export
function validateExportFile(filePath) {
    try {
        if (!fs.existsSync(filePath)) {
            return { valid: false, error: 'Arquivo não encontrado' };
        }
        
        const content = fs.readFileSync(filePath, 'utf8');
        const data = JSON.parse(content);
        
        if (!data.export_info) {
            return { valid: false, error: 'Estrutura inválida: export_info ausente' };
        }
        
        if (!Array.isArray(data.chats)) {
            return { valid: false, error: 'Estrutura inválida: chats deve ser array' };
        }
        
        if (!Array.isArray(data.messages)) {
            return { valid: false, error: 'Estrutura inválida: messages deve ser array' };
        }
        
        return { 
            valid: true, 
            data,
            stats: {
                totalChats: data.chats.length,
                totalMessages: data.messages.length,
                source: data.export_info.source,
                timestamp: data.export_info.timestamp
            }
        };
    } catch (error) {
        return { valid: false, error: `Erro ao ler arquivo: ${error.message}` };
    }
}

// Função para verificar se cloud está pronta
async function checkCloudReadiness() {
    console.log('🔍 Verificando se cloud está pronta...');
    
    const healthResult = await makeRequest(`${RENDER_URL}/api/health`);
    if (!healthResult.success) {
        return { ready: false, error: `Health check falhou: ${healthResult.error}` };
    }
    
    if (!healthResult.data.database_configured) {
        return { ready: false, error: 'Database não está configurado na cloud' };
    }
    
    // Testar endpoint de import
    const importTest = await makeRequest(`${RENDER_URL}/api/import`, {
        method: 'POST',
        body: { export_info: { test: true }, chats: [], messages: [] }
    });
    
    if (!importTest.success) {
        return { ready: false, error: `Endpoint /api/import não funciona: ${importTest.error}` };
    }
    
    console.log('✅ Cloud está pronta para receber dados');
    return { ready: true };
}

// Função para fazer backup dos dados atuais
async function backupCloudData() {
    console.log('💾 Fazendo backup dos dados atuais...');
    
    const result = await makeRequest(`${RENDER_URL}/api/chats`);
    if (result.success && result.data.length > 0) {
        const backupData = {
            export_info: {
                timestamp: new Date().toISOString(),
                source: 'cloud-backup',
                total_chats: result.data.length,
                total_messages: result.data.reduce((sum, chat) => sum + (chat.messages?.length || 0), 0)
            },
            chats: result.data,
            messages: []
        };
        
        const backupFile = `cloud_backup_${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
        fs.writeFileSync(backupFile, JSON.stringify(backupData, null, 2));
        console.log(`✅ Backup salvo em: ${backupFile}`);
        return backupFile;
    } else {
        console.log('ℹ️ Nenhum dado na cloud para backup');
        return null;
    }
}

// Função principal de import
async function importDataToCloud(exportFile) {
    console.log(`📤 Importando dados de: ${exportFile}`);
    
    const validation = validateExportFile(exportFile);
    if (!validation.valid) {
        console.log(`❌ Arquivo inválido: ${validation.error}`);
        return false;
    }
    
    const { data, stats } = validation;
    console.log(`📊 Dados a importar:`);
    console.log(`   📝 Chats: ${stats.totalChats}`);
    console.log(`   💬 Mensagens: ${stats.totalMessages}`);
    console.log(`   📅 Origem: ${stats.source}`);
    console.log(`   🕒 Data: ${stats.timestamp}`);
    
    const readiness = await checkCloudReadiness();
    if (!readiness.ready) {
        console.log(`❌ Cloud não está pronta: ${readiness.error}`);
        return false;
    }
    
    await backupCloudData();
    
    console.log('📤 Enviando dados para cloud...');
    console.log('⏳ Aguarde, isso pode levar alguns minutos...');
    
    const importResult = await makeRequest(`${RENDER_URL}/api/import`, {
        method: 'POST',
        body: data
    });
    
    if (importResult.success) {
        console.log('✅ Import realizado com sucesso!');
        console.log(`📊 Resultado: ${JSON.stringify(importResult.data)}`);
        return true;
    } else {
        console.log('❌ Falha no import');
        console.log(`📊 Status: ${importResult.status}`);
        console.log(`📊 Erro: ${importResult.error || 'Unknown error'}`);
        if (importResult.rawData) {
            console.log(`📊 Resposta: ${importResult.rawData.substring(0, 500)}...`);
        }
        return false;
    }
}

// Função para verificar dados após import
async function verifyImportedData(originalStats) {
    console.log('\n🔍 Verificando dados importados...');
    
    const statsResult = await makeRequest(`${RENDER_URL}/api/stats`);
    if (!statsResult.success) {
        console.log('❌ Falha ao obter stats após import');
        return false;
    }
    
    const currentStats = statsResult.data;
    console.log(`📊 Stats após import:`);
    console.log(`   📝 Chats: ${currentStats.total_chats}`);
    console.log(`   💬 Mensagens: ${currentStats.total_messages}`);
    
    if (originalStats) {
        const chatsMatch = currentStats.total_chats >= originalStats.totalChats;
        const messagesMatch = currentStats.total_messages >= originalStats.totalMessages;
        
        if (chatsMatch && messagesMatch) {
            console.log('✅ Dados importados corretamente!');
            return true;
        } else {
            console.log('⚠️ Possível problema na importação:');
            console.log(`   📝 Esperado: ${originalStats.totalChats}, atual: ${currentStats.total_chats}`);
            console.log(`   💬 Esperado: ${originalStats.totalMessages}, atual: ${currentStats.total_messages}`);
            return false;
        }
    }
    
    return true;
}

// Função principal
async function main() {
    try {
        let exportFile = EXPORT_FILE;
        if (!exportFile) {
            exportFile = findLatestExportFile();
            if (!exportFile) {
                console.log('❌ Nenhum arquivo de export encontrado');
                console.log('💡 Execute primeiro: python export-database.py');
                return;
            }
            console.log(`📁 Arquivo auto-detectado: ${exportFile}`);
        }
        
        const validation = validateExportFile(exportFile);
        if (!validation.valid) {
            console.log(`❌ ${validation.error}`);
            return;
        }
        
        const success = await importDataToCloud(exportFile);
        if (success) {
            await verifyImportedData(validation.stats);
            
            console.log('\n🎉 Import concluído com sucesso!');
            console.log(`🌐 Acesse: ${RENDER_URL}`);
            console.log('✅ Seus dados locais agora estão na cloud');
        } else {
            console.log('\n❌ Import falhou');
            console.log('🔧 Verifique a configuração e tente novamente');
        }
        
    } catch (error) {
        console.log(`❌ Erro durante import: ${error.message}`);
    }
}

if (require.main === module) {
    main().catch(console.error);
}

module.exports = { importDataToCloud, validateExportFile, checkCloudReadiness };
