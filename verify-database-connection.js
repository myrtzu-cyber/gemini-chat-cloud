/**
 * Script para verificar conexão com database na cloud
 * Testa se DATABASE_URL está configurada e funcionando
 */

const https = require('https');
const http = require('http');

// Configuração
const RENDER_URL = process.argv[2] || 'https://gemini-chat-cloud.onrender.com';

console.log('🔗 Verificação de Conexão Database');
console.log('==================================');
console.log(`🌐 URL: ${RENDER_URL}`);
console.log('');

// Função para fazer request HTTP/HTTPS
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
                'User-Agent': 'Database-Connection-Verifier/1.0',
                ...options.headers
            }
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
                        data: jsonData,
                        headers: res.headers
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
            resolve({ success: false, error: error.message });
        });

        if (options.body) {
            req.write(typeof options.body === 'string' ? options.body : JSON.stringify(options.body));
        }

        req.end();
    });
}

// Teste 1: Health Check com foco em database
async function testDatabaseHealth() {
    console.log('🔍 Teste 1: Database Health Check');
    console.log('----------------------------------');
    
    const result = await makeRequest(`${RENDER_URL}/api/health`);
    
    if (result.success) {
        const { data } = result;
        console.log('✅ Health Check passou');
        console.log(`📊 Environment: ${data.environment}`);
        console.log(`💾 Database configurado: ${data.database_configured}`);
        console.log(`🕒 Timestamp: ${data.timestamp}`);
        
        if (data.database_configured) {
            console.log('🎉 DATABASE_URL está configurada corretamente!');
            return true;
        } else {
            console.log('⚠️ DATABASE_URL não está configurada - usando fallback');
            return false;
        }
    } else {
        console.log('❌ Health Check falhou');
        console.log(`📊 Status: ${result.status}`);
        console.log(`📊 Erro: ${result.error || 'Unknown error'}`);
        if (result.rawData) {
            console.log(`📊 Raw response: ${result.rawData}`);
        }
        return false;
    }
}

// Teste 2: Stats para verificar tipo de database
async function testDatabaseStats() {
    console.log('\n🔍 Teste 2: Database Stats');
    console.log('---------------------------');
    
    const result = await makeRequest(`${RENDER_URL}/api/stats`);
    
    if (result.success) {
        const { data } = result;
        console.log('✅ Stats obtidas com sucesso');
        console.log(`📊 Total chats: ${data.total_chats}`);
        console.log(`📊 Total mensagens: ${data.total_messages}`);
        console.log(`🖥️ Server type: ${data.server_type}`);
        console.log(`💾 Database URL configurada: ${data.database_url_configured}`);
        
        if (data.server_type === 'cloud-database') {
            console.log('🎉 Usando database externo (PostgreSQL)!');
            return true;
        } else if (data.server_type === 'memory-fallback') {
            console.log('⚠️ Usando fallback em memória - DATABASE_URL não configurada');
            return false;
        } else {
            console.log(`ℹ️ Server type: ${data.server_type}`);
            return data.database_url_configured;
        }
    } else {
        console.log('❌ Falha ao obter stats');
        console.log(`📊 Status: ${result.status}`);
        console.log(`📊 Erro: ${result.error || 'Unknown error'}`);
        return false;
    }
}

// Teste 3: Teste de escrita/leitura para verificar persistência
async function testDatabasePersistence() {
    console.log('\n🔍 Teste 3: Database Persistence');
    console.log('--------------------------------');
    
    const testChatId = 'connection-test-' + Date.now();
    
    // Criar chat de teste
    console.log('📝 Criando chat de teste...');
    const createResult = await makeRequest(`${RENDER_URL}/api/chats`, {
        method: 'POST',
        body: {
            id: testChatId,
            title: 'Teste de Conexão Database',
            model: 'gemini-pro',
            messages: [{
                role: 'user',
                content: 'Teste de persistência',
                timestamp: new Date().toISOString()
            }]
        }
    });
    
    if (!createResult.success) {
        console.log('❌ Falha ao criar chat de teste');
        console.log(`📊 Status: ${createResult.status}`);
        console.log(`📊 Erro: ${createResult.error || 'Unknown error'}`);
        return false;
    }
    
    console.log('✅ Chat de teste criado');
    
    // Aguardar um pouco
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Recuperar chat
    console.log('📖 Recuperando chat de teste...');
    const getResult = await makeRequest(`${RENDER_URL}/api/chats/${testChatId}`);
    
    if (getResult.success) {
        console.log('✅ Chat recuperado com sucesso');
        console.log(`📝 Título: ${getResult.data.title}`);
        console.log(`📊 Mensagens: ${getResult.data.messages.length}`);
        
        // Limpar - deletar chat de teste
        console.log('🗑️ Removendo chat de teste...');
        const deleteResult = await makeRequest(`${RENDER_URL}/api/chats/${testChatId}`, {
            method: 'DELETE'
        });
        
        if (deleteResult.success) {
            console.log('✅ Chat de teste removido');
        }
        
        return true;
    } else {
        console.log('❌ Falha ao recuperar chat');
        console.log(`📊 Status: ${getResult.status}`);
        console.log(`📊 Erro: ${getResult.error || 'Unknown error'}`);
        return false;
    }
}

// Teste 4: Verificar se endpoint de import existe
async function testImportEndpoint() {
    console.log('\n🔍 Teste 4: Import Endpoint');
    console.log('----------------------------');
    
    // Testar com dados vazios para verificar se endpoint existe
    const testData = {
        export_info: {
            timestamp: new Date().toISOString(),
            source: 'connection-test',
            total_chats: 0,
            total_messages: 0
        },
        chats: [],
        messages: []
    };
    
    const result = await makeRequest(`${RENDER_URL}/api/import`, {
        method: 'POST',
        body: testData
    });
    
    if (result.success) {
        console.log('✅ Endpoint /api/import está funcionando');
        console.log(`📊 Resultado: ${JSON.stringify(result.data)}`);
        return true;
    } else {
        console.log('❌ Endpoint /api/import não está funcionando');
        console.log(`📊 Status: ${result.status}`);
        console.log(`📊 Erro: ${result.error || 'Unknown error'}`);
        return false;
    }
}

// Executar todos os testes
async function runConnectionTests() {
    console.log('🚀 Iniciando verificação de conexão database...\n');
    
    let testsPassed = 0;
    let totalTests = 4;
    
    // Executar testes
    if (await testDatabaseHealth()) testsPassed++;
    if (await testDatabaseStats()) testsPassed++;
    if (await testDatabasePersistence()) testsPassed++;
    if (await testImportEndpoint()) testsPassed++;
    
    // Resultado final
    console.log('\n🎯 Resultado da Verificação');
    console.log('============================');
    console.log(`✅ Testes passaram: ${testsPassed}/${totalTests}`);
    console.log(`📊 Taxa de sucesso: ${Math.round((testsPassed/totalTests)*100)}%`);
    
    if (testsPassed === totalTests) {
        console.log('🎉 Database conectado e funcionando perfeitamente!');
        console.log('✅ Pronto para importar dados locais');
    } else if (testsPassed >= 2) {
        console.log('⚠️ Database parcialmente funcionando');
        console.log('ℹ️ Verifique configuração DATABASE_URL no Render');
    } else {
        console.log('❌ Problemas na conexão database');
        console.log('🔧 Verifique configuração no Render dashboard');
    }
    
    console.log('\n💡 Próximos passos:');
    if (testsPassed === totalTests) {
        console.log('1. Execute: python export-database.py');
        console.log('2. Use o arquivo JSON gerado para importar dados');
        console.log('3. Teste a aplicação com seus dados migrados');
    } else {
        console.log('1. Verifique DATABASE_URL no Render dashboard');
        console.log('2. Confirme que database PostgreSQL está ativo');
        console.log('3. Execute este script novamente após correções');
    }
}

// Executar se chamado diretamente
if (require.main === module) {
    runConnectionTests().catch(console.error);
}

module.exports = { runConnectionTests, testDatabaseHealth, testDatabaseStats };
