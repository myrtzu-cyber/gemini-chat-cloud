/**
 * Script para testar o endpoint /api/chats/last
 * Verifica se a rota foi implementada corretamente
 */

const https = require('https');
process.env["NODE_TLS_REJECT_UNAUTHORIZED"] = 0;

const httpsAgent = new https.Agent({
    rejectUnauthorized: false,
    secureProtocol: 'TLSv1_2_method'
});

const RENDER_URL = process.argv[2] || 'https://gemini-chat-cloud.onrender.com';

function makeRequest(url) {
    return new Promise((resolve) => {
        const urlObj = new URL(url);
        const options = {
            hostname: urlObj.hostname,
            port: 443,
            path: urlObj.pathname,
            method: 'GET',
            agent: httpsAgent,
            rejectUnauthorized: false
        };

        const req = https.request(options, (res) => {
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
                        success: false, 
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

        req.end();
    });
}

async function testChatsLastEndpoint() {
    console.log('🧪 Teste do Endpoint /api/chats/last');
    console.log('====================================');
    console.log(`🌐 URL: ${RENDER_URL}`);
    console.log('');

    // Teste 1: Verificar se há chats no sistema
    console.log('📊 1. Verificando chats disponíveis...');
    const allChats = await makeRequest(`${RENDER_URL}/api/chats`);
    
    if (!allChats.success) {
        console.log('❌ Falha ao obter lista de chats');
        console.log(`   Status: ${allChats.status}`);
        console.log(`   Erro: ${allChats.error || 'Unknown'}`);
        return;
    }

    console.log(`✅ Total de chats: ${allChats.data.length}`);
    
    if (allChats.data.length === 0) {
        console.log('⚠️ Nenhum chat encontrado no sistema');
        console.log('💡 Execute o import de dados primeiro');
        return;
    }

    // Mostrar lista de chats
    console.log('\n📋 Chats disponíveis:');
    allChats.data.forEach((chat, index) => {
        console.log(`${index + 1}. "${chat.title}" (ID: ${chat.id})`);
        console.log(`   📅 Criado: ${chat.created_at}`);
        console.log(`   🔄 Atualizado: ${chat.updated_at}`);
        console.log(`   💬 Mensagens: ${chat.messages ? chat.messages.length : 0}`);
    });

    // Teste 2: Testar endpoint /api/chats/last
    console.log('\n🎯 2. Testando /api/chats/last...');
    const lastChat = await makeRequest(`${RENDER_URL}/api/chats/last`);
    
    if (!lastChat.success) {
        console.log('❌ Falha no endpoint /api/chats/last');
        console.log(`   Status: ${lastChat.status}`);
        console.log(`   Erro: ${lastChat.error || 'Unknown'}`);
        
        if (lastChat.status === 404) {
            console.log('💡 Possíveis causas:');
            console.log('   - Rota não implementada no servidor');
            console.log('   - Conflito com rota genérica /api/chats/{id}');
            console.log('   - Problema na ordenação dos chats');
        }
        
        if (lastChat.rawData) {
            console.log(`   Resposta: ${lastChat.rawData.substring(0, 200)}...`);
        }
        return;
    }

    console.log('✅ Endpoint /api/chats/last funcionando!');
    console.log(`   Chat retornado: "${lastChat.data.title}"`);
    console.log(`   ID: ${lastChat.data.id}`);
    console.log(`   Criado: ${lastChat.data.created_at}`);
    console.log(`   Atualizado: ${lastChat.data.updated_at}`);
    console.log(`   Mensagens: ${lastChat.data.messages ? lastChat.data.messages.length : 0}`);

    // Teste 3: Verificar se é realmente o último chat
    console.log('\n🔍 3. Verificando se é o chat mais recente...');
    
    // Ordenar chats localmente para comparar
    const sortedChats = allChats.data.sort((a, b) => {
        const dateA = new Date(a.updated_at || a.created_at);
        const dateB = new Date(b.updated_at || b.created_at);
        return dateB - dateA; // Mais recente primeiro
    });
    
    const expectedLastChat = sortedChats[0];
    
    if (lastChat.data.id === expectedLastChat.id) {
        console.log('✅ Correto! É o chat mais recente');
        console.log(`   Esperado: ${expectedLastChat.title} (${expectedLastChat.id})`);
        console.log(`   Retornado: ${lastChat.data.title} (${lastChat.data.id})`);
    } else {
        console.log('❌ PROBLEMA: Não é o chat mais recente!');
        console.log(`   Esperado: ${expectedLastChat.title} (${expectedLastChat.id})`);
        console.log(`   Retornado: ${lastChat.data.title} (${lastChat.data.id})`);
    }

    // Teste 4: Verificar se frontend pode carregar o chat
    console.log('\n🖥️ 4. Testando carregamento do chat específico...');
    const specificChat = await makeRequest(`${RENDER_URL}/api/chats/${lastChat.data.id}`);
    
    if (specificChat.success) {
        console.log('✅ Chat específico carregado com sucesso');
        console.log(`   Título: ${specificChat.data.title}`);
        console.log(`   Mensagens: ${specificChat.data.messages ? specificChat.data.messages.length : 0}`);
        
        if (specificChat.data.messages && specificChat.data.messages.length > 0) {
            console.log('   📝 Primeiras mensagens:');
            specificChat.data.messages.slice(0, 3).forEach((msg, index) => {
                const content = msg.content.substring(0, 50);
                console.log(`   ${index + 1}. ${msg.role}: ${content}...`);
            });
        }
    } else {
        console.log('❌ Falha ao carregar chat específico');
        console.log(`   Status: ${specificChat.status}`);
    }

    // Resultado final
    console.log('\n🎯 Resultado do Teste');
    console.log('=====================');
    
    if (lastChat.success && lastChat.data.id === expectedLastChat.id) {
        console.log('🎉 Endpoint /api/chats/last funcionando perfeitamente!');
        console.log('✅ Frontend deve conseguir carregar o último chat automaticamente');
        
        console.log('\n💡 Próximos passos:');
        console.log('1. Acesse a aplicação: ' + RENDER_URL);
        console.log('2. O chat "' + lastChat.data.title + '" deve carregar automaticamente');
        console.log('3. Se não carregar, pressione F12 e verifique o console');
        console.log('4. Limpe o cache do navegador (Ctrl+F5) se necessário');
    } else {
        console.log('❌ Problemas detectados no endpoint');
        console.log('🔧 Verifique a implementação da rota no servidor');
    }
    
    console.log('\n🌐 URLs para testar manualmente:');
    console.log(`📊 Stats: ${RENDER_URL}/api/stats`);
    console.log(`📝 Todos os chats: ${RENDER_URL}/api/chats`);
    console.log(`🎯 Último chat: ${RENDER_URL}/api/chats/last`);
    console.log(`🏠 Frontend: ${RENDER_URL}/`);
}

testChatsLastEndpoint().catch(console.error);
