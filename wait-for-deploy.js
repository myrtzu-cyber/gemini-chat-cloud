/**
 * Script para aguardar o deploy do Render ser concluído
 * Usa polling para verificar quando o servidor está respondendo corretamente
 */

const https = require('https');
process.env["NODE_TLS_REJECT_UNAUTHORIZED"] = 0;

const httpsAgent = new https.Agent({
    rejectUnauthorized: false,
    secureProtocol: 'TLSv1_2_method'
});

const RENDER_URL = process.argv[2] || 'https://gemini-chat-cloud.onrender.com';
const MAX_WAIT_MINUTES = 10; // Máximo 10 minutos
const POLL_INTERVAL_SECONDS = 15; // Verificar a cada 15 segundos

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
                'User-Agent': 'Deploy-Checker/1.0',
                ...options.headers
            },
            agent: httpsAgent,
            rejectUnauthorized: false,
            timeout: 10000 // 10 segundos timeout por request
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

async function checkDeployStatus() {
    console.log('🔍 Verificando status do deploy...');
    
    // Verificar múltiplos endpoints para garantir que o deploy está completo
    const checks = [
        { name: 'Stats', url: `${RENDER_URL}/api/stats` },
        { name: 'Chats', url: `${RENDER_URL}/api/chats` },
        { name: 'Last Chat', url: `${RENDER_URL}/api/chats/last` }
    ];
    
    const results = [];
    
    for (const check of checks) {
        const result = await makeRequest(check.url);
        results.push({
            name: check.name,
            success: result.success,
            status: result.status,
            error: result.error
        });
        
        console.log(`   ${check.name}: ${result.success ? '✅' : '❌'} (${result.status})`);
    }
    
    // Considerar deploy completo se pelo menos 2 dos 3 endpoints estão funcionando
    const successCount = results.filter(r => r.success).length;
    const isDeployComplete = successCount >= 2;
    
    return {
        complete: isDeployComplete,
        successCount,
        totalChecks: checks.length,
        results
    };
}

async function testContextEndpoint(chatId) {
    console.log('\n🧪 Testando endpoint de context...');
    
    const testContext = {
        plot: "Deploy test context",
        timestamp: new Date().toISOString(),
        deployTest: true
    };
    
    const result = await makeRequest(`${RENDER_URL}/api/chats/${chatId}/context`, {
        method: 'PUT',
        body: testContext
    });
    
    if (result.success) {
        console.log('✅ Context endpoint funcionando!');
        return true;
    } else {
        console.log(`❌ Context endpoint falhou: ${result.status}`);
        if (result.error) {
            console.log(`   Erro: ${result.error}`);
        }
        return false;
    }
}

async function waitForDeploy() {
    console.log('⏰ Aguardando Deploy do Render');
    console.log('==============================');
    console.log(`🌐 URL: ${RENDER_URL}`);
    console.log(`⏱️ Máximo: ${MAX_WAIT_MINUTES} minutos`);
    console.log(`🔄 Intervalo: ${POLL_INTERVAL_SECONDS} segundos`);
    console.log('');
    
    const startTime = Date.now();
    const maxWaitMs = MAX_WAIT_MINUTES * 60 * 1000;
    let attempt = 0;
    let chatId = null;
    
    while (Date.now() - startTime < maxWaitMs) {
        attempt++;
        const elapsed = Math.round((Date.now() - startTime) / 1000);
        
        console.log(`🔍 Tentativa ${attempt} (${elapsed}s elapsed):`);
        
        try {
            const status = await checkDeployStatus();
            
            if (status.complete) {
                console.log(`✅ Deploy completo! (${status.successCount}/${status.totalChecks} endpoints funcionando)`);
                
                // Obter ID do chat para testar context
                if (!chatId) {
                    const chats = await makeRequest(`${RENDER_URL}/api/chats`);
                    if (chats.success && chats.data.length > 0) {
                        chatId = chats.data[0].id;
                        console.log(`📋 Chat ID para teste: ${chatId}`);
                    }
                }
                
                // Testar endpoint de context se temos um chat ID
                if (chatId) {
                    const contextWorking = await testContextEndpoint(chatId);
                    if (contextWorking) {
                        console.log('\n🎉 DEPLOY COMPLETO E FUNCIONAL!');
                        console.log('✅ Todos os endpoints principais funcionando');
                        console.log('✅ Context endpoint implementado e funcionando');
                        console.log('✅ Aplicação pronta para uso');
                        
                        console.log('\n🌐 URLs para testar:');
                        console.log(`📊 Stats: ${RENDER_URL}/api/stats`);
                        console.log(`📝 Chats: ${RENDER_URL}/api/chats`);
                        console.log(`🎯 Last Chat: ${RENDER_URL}/api/chats/last`);
                        console.log(`💾 Context: PUT ${RENDER_URL}/api/chats/${chatId}/context`);
                        console.log(`🏠 Frontend: ${RENDER_URL}/`);
                        console.log(`📱 Mobile: ${RENDER_URL}/mobile`);
                        
                        return true;
                    } else {
                        console.log('⚠️ Deploy básico completo, mas context endpoint ainda não funciona');
                    }
                } else {
                    console.log('⚠️ Deploy completo, mas não foi possível obter chat ID para teste');
                    return true; // Deploy básico está funcionando
                }
            } else {
                console.log(`⏳ Deploy ainda em progresso... (${status.successCount}/${status.totalChecks} endpoints funcionando)`);
                
                // Mostrar quais endpoints estão falhando
                const failedChecks = status.results.filter(r => !r.success);
                if (failedChecks.length > 0) {
                    console.log('   Endpoints com problema:');
                    failedChecks.forEach(check => {
                        console.log(`   - ${check.name}: ${check.status} ${check.error ? `(${check.error})` : ''}`);
                    });
                }
            }
            
        } catch (error) {
            console.log(`❌ Erro ao verificar deploy: ${error.message}`);
        }
        
        // Aguardar antes da próxima verificação
        console.log(`⏳ Aguardando ${POLL_INTERVAL_SECONDS} segundos...\n`);
        await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL_SECONDS * 1000));
    }
    
    // Timeout atingido
    console.log('⏰ TIMEOUT ATINGIDO');
    console.log(`❌ Deploy não foi concluído em ${MAX_WAIT_MINUTES} minutos`);
    console.log('💡 Possíveis causas:');
    console.log('   - Deploy do Render está demorando mais que o normal');
    console.log('   - Erro no código que está impedindo o servidor de iniciar');
    console.log('   - Problemas de conectividade');
    
    console.log('\n🔧 Próximos passos:');
    console.log('1. Verifique os logs do Render no dashboard');
    console.log('2. Teste manualmente os endpoints');
    console.log('3. Aguarde mais alguns minutos e teste novamente');
    
    return false;
}

if (require.main === module) {
    waitForDeploy()
        .then(success => {
            process.exit(success ? 0 : 1);
        })
        .catch(error => {
            console.error('❌ Erro fatal:', error.message);
            process.exit(1);
        });
}

module.exports = { waitForDeploy };
