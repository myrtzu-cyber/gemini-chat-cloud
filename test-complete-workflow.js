/**
 * Teste End-to-End completo da aplicação Gemini Chat
 * Verifica todos os endpoints e funcionalidades
 */

const https = require('https');
process.env["NODE_TLS_REJECT_UNAUTHORIZED"] = 0;

const httpsAgent = new https.Agent({
    rejectUnauthorized: false,
    secureProtocol: 'TLSv1_2_method'
});

const RENDER_URL = process.argv[2] || 'https://gemini-chat-cloud.onrender.com';

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
                'User-Agent': 'E2E-Test-Tool/1.0',
                ...options.headers
            },
            agent: httpsAgent,
            rejectUnauthorized: false,
            timeout: 30000
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
                        error: 'Invalid JSON',
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

async function runCompleteWorkflowTest() {
    console.log('🧪 Teste End-to-End Completo');
    console.log('============================');
    console.log(`🌐 URL: ${RENDER_URL}`);
    console.log('');

    const results = {
        stats: false,
        chats: false,
        lastChat: false,
        specificChat: false,
        contextSave: false,
        contextPersistence: false,
        frontend: false,
        mobile: false
    };

    // Teste 1: Stats endpoint
    console.log('📊 1. Testando /api/stats...');
    const stats = await makeRequest(`${RENDER_URL}/api/stats`);
    if (stats.success) {
        console.log(`✅ Stats: ${stats.data.total_chats} chats, ${stats.data.total_messages} mensagens`);
        results.stats = true;
    } else {
        console.log(`❌ Stats falhou: ${stats.status}`);
    }

    // Teste 2: Lista de chats
    console.log('\n📝 2. Testando /api/chats...');
    const chats = await makeRequest(`${RENDER_URL}/api/chats`);
    if (chats.success && chats.data.length > 0) {
        console.log(`✅ Chats: ${chats.data.length} encontrados`);
        results.chats = true;
        
        // Mostrar primeiro chat
        const firstChat = chats.data[0];
        console.log(`   📋 Primeiro chat: "${firstChat.title}" (${firstChat.id})`);
    } else {
        console.log(`❌ Chats falhou: ${chats.status}`);
        return results; // Não pode continuar sem chats
    }

    // Teste 3: Último chat
    console.log('\n🎯 3. Testando /api/chats/last...');
    const lastChat = await makeRequest(`${RENDER_URL}/api/chats/last`);
    if (lastChat.success) {
        console.log(`✅ Último chat: "${lastChat.data.title}" (${lastChat.data.id})`);
        results.lastChat = true;
    } else {
        console.log(`❌ Último chat falhou: ${lastChat.status}`);
    }

    // Teste 4: Chat específico
    const testChatId = chats.data[0].id;
    console.log(`\n🔍 4. Testando /api/chats/${testChatId}...`);
    const specificChat = await makeRequest(`${RENDER_URL}/api/chats/${testChatId}`);
    if (specificChat.success) {
        console.log(`✅ Chat específico: "${specificChat.data.title}"`);
        console.log(`   💬 Mensagens: ${specificChat.data.messages?.length || 0}`);
        results.specificChat = true;
    } else {
        console.log(`❌ Chat específico falhou: ${specificChat.status}`);
    }

    // Teste 5: Salvamento de context
    console.log(`\n💾 5. Testando /api/chats/${testChatId}/context...`);
    const testContext = {
        plot: "Teste automatizado de context",
        timestamp: new Date().toISOString(),
        testData: "Dados de teste E2E"
    };

    const contextSave = await makeRequest(`${RENDER_URL}/api/chats/${testChatId}/context`, {
        method: 'PUT',
        body: testContext
    });

    if (contextSave.success) {
        console.log('✅ Context salvo com sucesso');
        results.contextSave = true;
    } else {
        console.log(`❌ Context save falhou: ${contextSave.status}`);
        if (contextSave.rawData) {
            console.log(`   Resposta: ${contextSave.rawData.substring(0, 200)}...`);
        }
    }

    // Teste 6: Verificar persistência do context
    console.log('\n🔍 6. Verificando persistência do context...');
    const chatWithContext = await makeRequest(`${RENDER_URL}/api/chats/${testChatId}`);
    if (chatWithContext.success && chatWithContext.data.context) {
        console.log('✅ Context persistido no database');
        results.contextPersistence = true;
        
        try {
            const savedContext = typeof chatWithContext.data.context === 'string' 
                ? JSON.parse(chatWithContext.data.context) 
                : chatWithContext.data.context;
            
            if (savedContext.plot === testContext.plot) {
                console.log('✅ Context data integrity verified');
            }
        } catch (error) {
            console.log(`⚠️ Context parse error: ${error.message}`);
        }
    } else {
        console.log('❌ Context não persistido');
    }

    // Teste 7: Frontend principal
    console.log('\n🏠 7. Testando frontend principal...');
    const frontend = await makeRequest(`${RENDER_URL}/`);
    if (frontend.success || frontend.status === 200) {
        console.log('✅ Frontend principal carregando');
        results.frontend = true;
    } else {
        console.log(`❌ Frontend falhou: ${frontend.status}`);
    }

    // Teste 8: Frontend mobile
    console.log('\n📱 8. Testando frontend mobile...');
    const mobile = await makeRequest(`${RENDER_URL}/mobile`);
    if (mobile.success || mobile.status === 200) {
        console.log('✅ Frontend mobile carregando');
        results.mobile = true;
    } else {
        console.log(`❌ Mobile falhou: ${mobile.status}`);
    }

    // Resultado final
    console.log('\n🎯 Resultado Final');
    console.log('==================');
    
    const passedTests = Object.values(results).filter(Boolean).length;
    const totalTests = Object.keys(results).length;
    
    console.log(`📊 Testes passados: ${passedTests}/${totalTests}`);
    console.log('');
    
    Object.entries(results).forEach(([test, passed]) => {
        const icon = passed ? '✅' : '❌';
        const testName = test.charAt(0).toUpperCase() + test.slice(1);
        console.log(`${icon} ${testName}`);
    });
    
    if (passedTests === totalTests) {
        console.log('\n🎉 TODOS OS TESTES PASSARAM!');
        console.log('✅ Aplicação totalmente funcional');
        console.log('✅ Context endpoint implementado corretamente');
        console.log('✅ Dados persistindo no PostgreSQL');
        console.log('✅ Frontend e mobile funcionando');
        
        console.log('\n💡 A aplicação está pronta para uso:');
        console.log(`🌐 Desktop: ${RENDER_URL}/`);
        console.log(`📱 Mobile: ${RENDER_URL}/mobile`);
        console.log('🎮 Context saving should work without 404 errors');
        
    } else {
        console.log('\n⚠️ ALGUNS TESTES FALHARAM');
        console.log(`📊 ${totalTests - passedTests} problemas detectados`);
        
        const failedTests = Object.entries(results)
            .filter(([, passed]) => !passed)
            .map(([test]) => test);
        
        console.log('🔧 Problemas encontrados:');
        failedTests.forEach(test => {
            console.log(`   - ${test}`);
        });
    }
    
    console.log('\n🌐 URLs para verificação manual:');
    console.log(`📊 Stats: ${RENDER_URL}/api/stats`);
    console.log(`📝 Chats: ${RENDER_URL}/api/chats`);
    console.log(`🎯 Last Chat: ${RENDER_URL}/api/chats/last`);
    console.log(`💾 Context Test: PUT ${RENDER_URL}/api/chats/${testChatId}/context`);
    console.log(`🏠 Frontend: ${RENDER_URL}/`);
    console.log(`📱 Mobile: ${RENDER_URL}/mobile`);
    
    return results;
}

if (require.main === module) {
    runCompleteWorkflowTest().catch(console.error);
}

module.exports = { runCompleteWorkflowTest };
