/**
 * Script para diagnosticar problemas entre frontend e backend
 * Testa todos os endpoints e verifica comunicação
 */

const https = require('https');
const http = require('http');

// Configuração para ambiente corporativo
process.env["NODE_TLS_REJECT_UNAUTHORIZED"] = 0;

const httpsAgent = new https.Agent({
    rejectUnauthorized: false,
    secureProtocol: 'TLSv1_2_method'
});

const RENDER_URL = process.argv[2] || 'https://gemini-chat-cloud.onrender.com';

console.log('🔍 Diagnóstico Frontend-Backend - Gemini Chat');
console.log('==============================================');
console.log(`🌐 URL: ${RENDER_URL}`);
console.log('');

// Função para fazer request
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
                'User-Agent': 'Frontend-Backend-Diagnostics/1.0',
                ...options.headers
            },
            agent: isHttps ? httpsAgent : undefined,
            rejectUnauthorized: false,
            timeout: 30000
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
                        headers: res.headers,
                        rawData: data
                    });
                } catch (error) {
                    resolve({ 
                        success: res.statusCode >= 200 && res.statusCode < 300,
                        status: res.statusCode,
                        error: 'Invalid JSON response',
                        rawData: data,
                        headers: res.headers
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

// Teste 1: Verificar dados no backend
async function testBackendData() {
    console.log('🔍 Teste 1: Verificando Dados no Backend');
    console.log('=========================================');
    
    // Health Check
    console.log('📊 Health Check...');
    const health = await makeRequest(`${RENDER_URL}/api/health`);
    if (health.success) {
        console.log('✅ Health Check: OK');
        console.log(`   Environment: ${health.data.environment}`);
        console.log(`   Database: ${health.data.database_configured ? 'Configurado' : 'Não configurado'}`);
    } else {
        console.log('❌ Health Check: FALHA');
        console.log(`   Erro: ${health.error}`);
        return false;
    }
    
    // Stats
    console.log('\n📊 Stats...');
    const stats = await makeRequest(`${RENDER_URL}/api/stats`);
    if (stats.success) {
        console.log('✅ Stats: OK');
        console.log(`   Total Chats: ${stats.data.total_chats}`);
        console.log(`   Total Mensagens: ${stats.data.total_messages}`);
        console.log(`   Server Type: ${stats.data.server_type}`);
        console.log(`   Database URL: ${stats.data.database_url_configured ? 'Configurada' : 'Não configurada'}`);
        
        if (stats.data.total_chats === 0) {
            console.log('⚠️  PROBLEMA: Nenhum chat encontrado no backend!');
            return false;
        }
    } else {
        console.log('❌ Stats: FALHA');
        console.log(`   Erro: ${stats.error}`);
        return false;
    }
    
    // Lista de Chats
    console.log('\n📝 Lista de Chats...');
    const chats = await makeRequest(`${RENDER_URL}/api/chats`);
    if (chats.success) {
        console.log('✅ Lista de Chats: OK');
        console.log(`   Quantidade: ${chats.data.length}`);
        
        if (chats.data.length > 0) {
            console.log('   Chats encontrados:');
            chats.data.forEach((chat, index) => {
                console.log(`   ${index + 1}. ID: ${chat.id}`);
                console.log(`      Título: ${chat.title}`);
                console.log(`      Mensagens: ${chat.messages ? chat.messages.length : 0}`);
                console.log(`      Criado: ${chat.created_at}`);
            });
        } else {
            console.log('⚠️  PROBLEMA: Lista de chats vazia!');
            return false;
        }
    } else {
        console.log('❌ Lista de Chats: FALHA');
        console.log(`   Erro: ${chats.error}`);
        return false;
    }
    
    return true;
}

// Teste 2: Verificar frontend
async function testFrontend() {
    console.log('\n🔍 Teste 2: Verificando Frontend');
    console.log('=================================');
    
    // Página principal
    console.log('🏠 Página Principal...');
    const homepage = await makeRequest(`${RENDER_URL}/`);
    if (homepage.success) {
        console.log('✅ Homepage: OK');
        
        // Verificar se contém elementos esperados
        const content = homepage.rawData;
        const hasApiCalls = content.includes('/api/chats') || content.includes('fetch');
        const hasJavaScript = content.includes('<script') || content.includes('.js');
        const hasChatElements = content.includes('chat') || content.includes('conversation');
        
        console.log(`   Contém chamadas API: ${hasApiCalls ? 'Sim' : 'Não'}`);
        console.log(`   Contém JavaScript: ${hasJavaScript ? 'Sim' : 'Não'}`);
        console.log(`   Contém elementos de chat: ${hasChatElements ? 'Sim' : 'Não'}`);
        
        if (!hasApiCalls) {
            console.log('⚠️  PROBLEMA: Frontend pode não estar fazendo chamadas para API!');
        }
    } else {
        console.log('❌ Homepage: FALHA');
        console.log(`   Erro: ${homepage.error}`);
        return false;
    }
    
    // Página mobile
    console.log('\n📱 Página Mobile...');
    const mobile = await makeRequest(`${RENDER_URL}/mobile`);
    if (mobile.success) {
        console.log('✅ Mobile: OK');
    } else {
        console.log('❌ Mobile: FALHA');
        console.log(`   Erro: ${mobile.error}`);
    }
    
    return true;
}

// Teste 3: Verificar CORS e headers
async function testCorsAndHeaders() {
    console.log('\n🔍 Teste 3: Verificando CORS e Headers');
    console.log('======================================');
    
    const result = await makeRequest(`${RENDER_URL}/api/chats`);
    if (result.success) {
        const headers = result.headers;
        console.log('✅ Headers recebidos:');
        console.log(`   Content-Type: ${headers['content-type']}`);
        console.log(`   Access-Control-Allow-Origin: ${headers['access-control-allow-origin'] || 'Não definido'}`);
        console.log(`   Access-Control-Allow-Methods: ${headers['access-control-allow-methods'] || 'Não definido'}`);
        
        if (!headers['access-control-allow-origin']) {
            console.log('⚠️  PROBLEMA: CORS pode estar bloqueando frontend!');
            return false;
        }
    }
    
    return true;
}

// Teste 4: Simular chamada do frontend
async function testFrontendApiCall() {
    console.log('\n🔍 Teste 4: Simulando Chamada do Frontend');
    console.log('==========================================');
    
    const result = await makeRequest(`${RENDER_URL}/api/chats`, {
        headers: {
            'Accept': 'application/json',
            'Origin': RENDER_URL,
            'Referer': `${RENDER_URL}/`
        }
    });
    
    if (result.success) {
        console.log('✅ Simulação de chamada frontend: OK');
        console.log(`   Dados recebidos: ${result.data.length} chats`);
        return true;
    } else {
        console.log('❌ Simulação de chamada frontend: FALHA');
        console.log(`   Erro: ${result.error}`);
        return false;
    }
}

// Teste 5: Criar chat de teste
async function testCreateChat() {
    console.log('\n🔍 Teste 5: Testando Criação de Chat');
    console.log('====================================');
    
    const testChat = {
        id: 'test-frontend-' + Date.now(),
        title: 'Teste Frontend-Backend',
        model: 'gemini-pro',
        messages: [{
            role: 'user',
            content: 'Teste de comunicação frontend-backend',
            timestamp: new Date().toISOString()
        }]
    };
    
    const result = await makeRequest(`${RENDER_URL}/api/chats`, {
        method: 'POST',
        body: testChat
    });
    
    if (result.success) {
        console.log('✅ Criação de chat: OK');
        console.log(`   Chat criado: ${testChat.id}`);
        
        // Verificar se aparece na lista
        const chats = await makeRequest(`${RENDER_URL}/api/chats`);
        if (chats.success) {
            const found = chats.data.find(c => c.id === testChat.id);
            if (found) {
                console.log('✅ Chat aparece na lista: OK');
                
                // Limpar - deletar chat de teste
                const deleteResult = await makeRequest(`${RENDER_URL}/api/chats/${testChat.id}`, {
                    method: 'DELETE'
                });
                if (deleteResult.success) {
                    console.log('✅ Limpeza: Chat de teste removido');
                }
            } else {
                console.log('❌ Chat NÃO aparece na lista!');
                return false;
            }
        }
        
        return true;
    } else {
        console.log('❌ Criação de chat: FALHA');
        console.log(`   Erro: ${result.error}`);
        return false;
    }
}

// Executar todos os testes
async function runDiagnostics() {
    console.log('🚀 Iniciando diagnóstico completo...\n');
    
    let testsPassed = 0;
    let totalTests = 5;
    
    if (await testBackendData()) testsPassed++;
    if (await testFrontend()) testsPassed++;
    if (await testCorsAndHeaders()) testsPassed++;
    if (await testFrontendApiCall()) testsPassed++;
    if (await testCreateChat()) testsPassed++;
    
    console.log('\n🎯 Resultado do Diagnóstico');
    console.log('============================');
    console.log(`✅ Testes passaram: ${testsPassed}/${totalTests}`);
    console.log(`📊 Taxa de sucesso: ${Math.round((testsPassed/totalTests)*100)}%`);
    
    if (testsPassed === totalTests) {
        console.log('🎉 Todos os testes passaram!');
        console.log('✅ Backend e frontend estão funcionando corretamente');
        console.log('\n💡 Se chats não aparecem no frontend:');
        console.log('1. Limpe cache do navegador (Ctrl+F5)');
        console.log('2. Verifique console do navegador (F12)');
        console.log('3. Teste em aba anônima/privada');
    } else {
        console.log('❌ Alguns testes falharam');
        console.log('\n🔧 Possíveis soluções:');
        console.log('1. Verificar logs do Render');
        console.log('2. Confirmar DATABASE_URL configurada');
        console.log('3. Verificar se server-cloud.js está sendo usado');
        console.log('4. Testar import novamente');
    }
    
    console.log('\n🌐 URLs para testar manualmente:');
    console.log(`📊 Stats: ${RENDER_URL}/api/stats`);
    console.log(`📝 Chats: ${RENDER_URL}/api/chats`);
    console.log(`🏠 Frontend: ${RENDER_URL}/`);
    console.log(`📱 Mobile: ${RENDER_URL}/mobile`);
}

if (require.main === module) {
    runDiagnostics().catch(console.error);
}

module.exports = { runDiagnostics, testBackendData, testFrontend };
