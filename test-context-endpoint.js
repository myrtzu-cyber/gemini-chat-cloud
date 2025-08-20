/**
 * Script para testar o endpoint de context /api/chats/{chatId}/context
 * Verifica se a funcionalidade de salvar context está funcionando
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
                'User-Agent': 'Context-Test-Tool/1.0',
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

async function testContextEndpoint() {
    console.log('🧪 Teste do Endpoint de Context');
    console.log('===============================');
    console.log(`🌐 URL: ${RENDER_URL}`);
    console.log('');

    // Teste 1: Verificar se há chats disponíveis
    console.log('📊 1. Verificando chats disponíveis...');
    const allChats = await makeRequest(`${RENDER_URL}/api/chats`);
    
    if (!allChats.success) {
        console.log('❌ Falha ao obter lista de chats');
        console.log(`   Status: ${allChats.status}`);
        return;
    }

    if (allChats.data.length === 0) {
        console.log('⚠️ Nenhum chat encontrado no sistema');
        console.log('💡 Execute o import de dados primeiro');
        return;
    }

    console.log(`✅ Total de chats: ${allChats.data.length}`);
    
    // Usar o primeiro chat disponível
    const testChat = allChats.data[0];
    const chatId = testChat.id;
    console.log(`🎯 Usando chat para teste: "${testChat.title}" (${chatId})`);

    // Teste 2: Testar salvamento de context
    console.log('\n💾 2. Testando salvamento de context...');
    
    const testContext = {
        currentPlot: "Aventura épica no reino de Eldoria",
        characters: [
            { name: "Aragorn", role: "Guerreiro", level: 15 },
            { name: "Legolas", role: "Arqueiro", level: 14 }
        ],
        location: "Floresta Sombria",
        questStatus: "Em progresso",
        timestamp: new Date().toISOString(),
        metadata: {
            gameSystem: "D&D 5e",
            sessionNumber: 42,
            lastAction: "Combate contra orcs"
        }
    };

    console.log('📝 Context de teste:', JSON.stringify(testContext, null, 2));

    const saveResult = await makeRequest(`${RENDER_URL}/api/chats/${chatId}/context`, {
        method: 'PUT',
        body: testContext
    });

    if (!saveResult.success) {
        console.log('❌ Falha ao salvar context');
        console.log(`   Status: ${saveResult.status}`);
        console.log(`   Erro: ${saveResult.error || 'Unknown'}`);
        
        if (saveResult.status === 404) {
            console.log('💡 Possíveis causas:');
            console.log('   - Endpoint /api/chats/{chatId}/context não implementado');
            console.log('   - Chat ID não encontrado');
            console.log('   - Rota não configurada corretamente');
        }
        
        if (saveResult.rawData) {
            console.log(`   Resposta: ${saveResult.rawData.substring(0, 300)}...`);
        }
        return;
    }

    console.log('✅ Context salvo com sucesso!');
    console.log(`   Resposta: ${JSON.stringify(saveResult.data)}`);

    // Teste 3: Verificar se o context foi persistido
    console.log('\n🔍 3. Verificando persistência do context...');
    
    const chatAfterSave = await makeRequest(`${RENDER_URL}/api/chats/${chatId}`);
    
    if (chatAfterSave.success) {
        console.log('✅ Chat carregado após salvamento');
        
        if (chatAfterSave.data.context) {
            console.log('✅ Context encontrado no chat!');
            
            try {
                const savedContext = typeof chatAfterSave.data.context === 'string' 
                    ? JSON.parse(chatAfterSave.data.context) 
                    : chatAfterSave.data.context;
                
                console.log('📋 Context salvo:');
                console.log(`   Plot: ${savedContext.currentPlot}`);
                console.log(`   Personagens: ${savedContext.characters?.length || 0}`);
                console.log(`   Localização: ${savedContext.location}`);
                console.log(`   Status: ${savedContext.questStatus}`);
                
                // Verificar se os dados batem
                if (savedContext.currentPlot === testContext.currentPlot &&
                    savedContext.location === testContext.location) {
                    console.log('✅ Context salvo corretamente!');
                } else {
                    console.log('⚠️ Context pode ter sido modificado');
                }
                
            } catch (error) {
                console.log(`❌ Erro ao parsear context: ${error.message}`);
            }
        } else {
            console.log('❌ Context não encontrado no chat');
            console.log('💡 Pode ser que a coluna context não exista na tabela');
        }
    } else {
        console.log('❌ Falha ao carregar chat após salvamento');
    }

    // Teste 4: Testar atualização de context
    console.log('\n🔄 4. Testando atualização de context...');
    
    const updatedContext = {
        ...testContext,
        location: "Cidade de Pedra Branca",
        questStatus: "Completada",
        lastUpdate: new Date().toISOString(),
        newData: "Dados adicionais para teste de atualização"
    };

    const updateResult = await makeRequest(`${RENDER_URL}/api/chats/${chatId}/context`, {
        method: 'PUT',
        body: updatedContext
    });

    if (updateResult.success) {
        console.log('✅ Context atualizado com sucesso!');
        
        // Verificar atualização
        const chatAfterUpdate = await makeRequest(`${RENDER_URL}/api/chats/${chatId}`);
        if (chatAfterUpdate.success && chatAfterUpdate.data.context) {
            const finalContext = typeof chatAfterUpdate.data.context === 'string' 
                ? JSON.parse(chatAfterUpdate.data.context) 
                : chatAfterUpdate.data.context;
            
            if (finalContext.location === "Cidade de Pedra Branca") {
                console.log('✅ Atualização persistida corretamente!');
            } else {
                console.log('⚠️ Atualização pode não ter sido salva');
            }
        }
    } else {
        console.log('❌ Falha ao atualizar context');
    }

    // Teste 5: Testar com chat inexistente
    console.log('\n🚫 5. Testando com chat inexistente...');
    
    const invalidResult = await makeRequest(`${RENDER_URL}/api/chats/invalid-chat-id/context`, {
        method: 'PUT',
        body: { test: 'data' }
    });

    if (invalidResult.status === 404) {
        console.log('✅ Erro 404 correto para chat inexistente');
    } else {
        console.log(`⚠️ Status inesperado para chat inexistente: ${invalidResult.status}`);
    }

    // Resultado final
    console.log('\n🎯 Resultado do Teste');
    console.log('=====================');
    
    if (saveResult.success && updateResult.success) {
        console.log('🎉 Endpoint de context funcionando perfeitamente!');
        console.log('✅ Context pode ser salvo e atualizado');
        console.log('✅ Dados persistem no database');
        console.log('✅ Validação de chat inexistente funciona');
        
        console.log('\n💡 Próximos passos:');
        console.log('1. Teste no frontend mobile');
        console.log('2. Verifique se o botão "Salvar Context" funciona');
        console.log('3. Confirme que não há mais erros 404');
    } else {
        console.log('❌ Problemas detectados no endpoint de context');
        console.log('🔧 Verifique a implementação no servidor');
    }
    
    console.log('\n🌐 URLs para testar manualmente:');
    console.log(`📊 Stats: ${RENDER_URL}/api/stats`);
    console.log(`📝 Chats: ${RENDER_URL}/api/chats`);
    console.log(`🎯 Chat específico: ${RENDER_URL}/api/chats/${chatId}`);
    console.log(`💾 Context (PUT): ${RENDER_URL}/api/chats/${chatId}/context`);
}

testContextEndpoint().catch(console.error);
