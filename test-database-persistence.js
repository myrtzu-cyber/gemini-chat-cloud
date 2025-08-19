/**
 * Script para testar persistência de dados na cloud
 * Executa uma série de testes para verificar se o database está funcionando
 */

const baseUrl = process.argv[2] || 'http://localhost:3000';

console.log('🧪 Teste de Persistência de Database');
console.log('=====================================');
console.log(`🌐 URL Base: ${baseUrl}`);
console.log('');

// Função para fazer requests HTTP
async function makeRequest(url, options = {}) {
    try {
        const fetch = (await import('node-fetch')).default;
        const response = await fetch(url, options);
        const data = await response.json();
        return { success: response.ok, status: response.status, data };
    } catch (error) {
        // Fallback para ambientes sem node-fetch
        return { success: false, error: error.message };
    }
}

// Função para fazer request usando módulos nativos
function makeNativeRequest(url, options = {}) {
    return new Promise((resolve, reject) => {
        const urlObj = new URL(url);
        const isHttps = urlObj.protocol === 'https:';
        const http = isHttps ? require('https') : require('http');
        
        const requestOptions = {
            hostname: urlObj.hostname,
            port: urlObj.port || (isHttps ? 443 : 80),
            path: urlObj.pathname + urlObj.search,
            method: options.method || 'GET',
            headers: {
                'Content-Type': 'application/json',
                ...options.headers
            }
        };

        const req = http.request(requestOptions, (res) => {
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
                    resolve({ success: false, error: 'Invalid JSON response' });
                }
            });
        });

        req.on('error', (error) => {
            resolve({ success: false, error: error.message });
        });

        if (options.body) {
            req.write(JSON.stringify(options.body));
        }

        req.end();
    });
}

// Função para delay
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Teste 1: Health Check
async function testHealthCheck() {
    console.log('🔍 Teste 1: Health Check');
    const result = await makeNativeRequest(`${baseUrl}/api/health`);
    
    if (result.success) {
        console.log('✅ Health Check passou');
        console.log(`📊 Environment: ${result.data.environment}`);
        console.log(`💾 Database configurado: ${result.data.database_configured}`);
        return true;
    } else {
        console.log('❌ Health Check falhou:', result.error || result.status);
        return false;
    }
}

// Teste 2: Stats iniciais
async function testInitialStats() {
    console.log('\n🔍 Teste 2: Stats Iniciais');
    const result = await makeNativeRequest(`${baseUrl}/api/stats`);
    
    if (result.success) {
        console.log('✅ Stats obtidas com sucesso');
        console.log(`📊 Chats: ${result.data.total_chats}`);
        console.log(`📊 Mensagens: ${result.data.total_messages}`);
        console.log(`🖥️ Server Type: ${result.data.server_type}`);
        return result.data;
    } else {
        console.log('❌ Falha ao obter stats:', result.error || result.status);
        return null;
    }
}

// Teste 3: Criar chat de teste
async function testCreateChat() {
    console.log('\n🔍 Teste 3: Criar Chat');
    const testChatId = 'persistence-test-' + Date.now();
    
    const result = await makeNativeRequest(`${baseUrl}/api/chats`, {
        method: 'POST',
        body: {
            id: testChatId,
            title: 'Teste de Persistência',
            model: 'gemini-pro',
            messages: [
                {
                    role: 'user',
                    content: 'Teste de persistência de dados',
                    timestamp: new Date().toISOString()
                }
            ]
        }
    });
    
    if (result.success) {
        console.log('✅ Chat criado com sucesso');
        console.log(`🆔 ID: ${testChatId}`);
        return testChatId;
    } else {
        console.log('❌ Falha ao criar chat:', result.error || result.status);
        return null;
    }
}

// Teste 4: Recuperar chat criado
async function testRetrieveChat(chatId) {
    console.log('\n🔍 Teste 4: Recuperar Chat');
    const result = await makeNativeRequest(`${baseUrl}/api/chats/${chatId}`);
    
    if (result.success) {
        console.log('✅ Chat recuperado com sucesso');
        console.log(`📝 Título: ${result.data.title}`);
        console.log(`📊 Mensagens: ${result.data.messages.length}`);
        return result.data;
    } else {
        console.log('❌ Falha ao recuperar chat:', result.error || result.status);
        return null;
    }
}

// Teste 5: Listar todos os chats
async function testListChats() {
    console.log('\n🔍 Teste 5: Listar Chats');
    const result = await makeNativeRequest(`${baseUrl}/api/chats`);
    
    if (result.success) {
        console.log('✅ Lista de chats obtida');
        console.log(`📊 Total de chats: ${result.data.length}`);
        return result.data;
    } else {
        console.log('❌ Falha ao listar chats:', result.error || result.status);
        return null;
    }
}

// Teste 6: Verificar stats atualizadas
async function testUpdatedStats(initialStats) {
    console.log('\n🔍 Teste 6: Stats Atualizadas');
    const result = await makeNativeRequest(`${baseUrl}/api/stats`);
    
    if (result.success) {
        const chatsDiff = result.data.total_chats - (initialStats?.total_chats || 0);
        console.log('✅ Stats atualizadas obtidas');
        console.log(`📊 Chats adicionados: ${chatsDiff}`);
        console.log(`📊 Total atual: ${result.data.total_chats} chats`);
        return chatsDiff > 0;
    } else {
        console.log('❌ Falha ao obter stats atualizadas:', result.error || result.status);
        return false;
    }
}

// Teste 7: Deletar chat de teste
async function testDeleteChat(chatId) {
    console.log('\n🔍 Teste 7: Deletar Chat');
    const result = await makeNativeRequest(`${baseUrl}/api/chats/${chatId}`, {
        method: 'DELETE'
    });
    
    if (result.success) {
        console.log('✅ Chat deletado com sucesso');
        return true;
    } else {
        console.log('❌ Falha ao deletar chat:', result.error || result.status);
        return false;
    }
}

// Executar todos os testes
async function runAllTests() {
    console.log('🚀 Iniciando testes de persistência...\n');
    
    let testsPassed = 0;
    let totalTests = 7;
    
    // Teste 1: Health Check
    if (await testHealthCheck()) testsPassed++;
    
    // Teste 2: Stats iniciais
    const initialStats = await testInitialStats();
    if (initialStats) testsPassed++;
    
    // Teste 3: Criar chat
    const chatId = await testCreateChat();
    if (chatId) testsPassed++;
    
    // Aguardar um pouco para garantir persistência
    console.log('\n⏳ Aguardando 2 segundos...');
    await sleep(2000);
    
    // Teste 4: Recuperar chat
    const retrievedChat = await testRetrieveChat(chatId);
    if (retrievedChat) testsPassed++;
    
    // Teste 5: Listar chats
    const chatsList = await testListChats();
    if (chatsList) testsPassed++;
    
    // Teste 6: Stats atualizadas
    const statsUpdated = await testUpdatedStats(initialStats);
    if (statsUpdated) testsPassed++;
    
    // Teste 7: Deletar chat (cleanup)
    if (chatId && await testDeleteChat(chatId)) testsPassed++;
    
    // Resultado final
    console.log('\n🎯 Resultado dos Testes');
    console.log('========================');
    console.log(`✅ Testes passaram: ${testsPassed}/${totalTests}`);
    console.log(`📊 Taxa de sucesso: ${Math.round((testsPassed/totalTests)*100)}%`);
    
    if (testsPassed === totalTests) {
        console.log('🎉 Todos os testes passaram! Database funcionando corretamente.');
    } else {
        console.log('⚠️ Alguns testes falharam. Verifique a configuração do database.');
    }
    
    // Informações sobre persistência
    console.log('\n💡 Informações sobre Persistência:');
    if (baseUrl.includes('localhost')) {
        console.log('🏠 Ambiente local: dados podem ser perdidos ao reiniciar');
    } else {
        console.log('☁️ Ambiente cloud: verifique se DATABASE_URL está configurada');
    }
}

// Executar testes
if (require.main === module) {
    runAllTests().catch(console.error);
}

module.exports = {
    runAllTests,
    testHealthCheck,
    testCreateChat,
    testRetrieveChat
};
