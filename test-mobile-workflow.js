#!/usr/bin/env node

const https = require('https');

// Ignorar certificados SSL para teste
process.env["NODE_TLS_REJECT_UNAUTHORIZED"] = 0;

function makeRequest(url, method = 'GET', data = null) {
    return new Promise((resolve, reject) => {
        const urlObj = new URL(url);
        const options = {
            hostname: urlObj.hostname,
            port: urlObj.port || 443,
            path: urlObj.pathname,
            method: method,
            headers: {
                'Content-Type': 'application/json',
            }
        };

        if (data) {
            const jsonData = JSON.stringify(data);
            options.headers['Content-Length'] = Buffer.byteLength(jsonData);
        }

        const req = https.request(options, (res) => {
            let responseData = '';
            res.on('data', chunk => responseData += chunk);
            res.on('end', () => {
                try {
                    const json = JSON.parse(responseData);
                    resolve({ status: res.statusCode, data: json });
                } catch (e) {
                    resolve({ status: res.statusCode, data: responseData, raw: true });
                }
            });
        });

        req.on('error', reject);

        if (data) {
            req.write(JSON.stringify(data));
        }
        req.end();
    });
}

function generateId() {
    return Math.random().toString(36).substring(2, 15);
}

async function testMobileWorkflow() {
    console.log('🧪 TESTE COMPLETO DO WORKFLOW MOBILE FRONTEND\n');

    const baseUrl = 'https://gemini-chat-cloud.onrender.com';
    const testChatId = `test_chat_${Date.now()}_${generateId()}`;
    const testMessageId = `msg_${Date.now()}_${generateId()}`;

    console.log(`🆔 IDs de teste:`);
    console.log(`   Chat ID: ${testChatId}`);
    console.log(`   Message ID: ${testMessageId}`);
    console.log('');

    // 1. Criar novo chat (simular mobile frontend)
    console.log('1️⃣ CRIANDO NOVO CHAT...');
    const newChatData = {
        id: testChatId,
        title: 'Teste Mobile Workflow',
        model: 'gemini-2.5-pro',
        messages: [
            {
                id: testMessageId,
                sender: 'user',
                content: 'Mensagem de teste do workflow mobile',
                files: [],
                timestamp: Date.now()
            }
        ],
        context: {
            master_rules: 'Regras de teste',
            character_sheet: 'Personagem de teste',
            local_history: 'História local de teste',
            current_plot: 'Plot atual de teste',
            relations: 'Relações de teste',
            aventura: 'Aventura de teste com conteúdo importante para persistência',
            lastCompressionTime: null
        }
    };

    const createResult = await makeRequest(`${baseUrl}/api/chats`, 'POST', newChatData);
    console.log(`   Status: ${createResult.status}`);
    console.log(`   Response:`, createResult.data);
    console.log('');

    // 2. Verificar se chat foi criado com mensagens
    console.log('2️⃣ VERIFICANDO CHAT CRIADO...');
    const chatResult = await makeRequest(`${baseUrl}/api/chats/${testChatId}`);
    console.log(`   Status: ${chatResult.status}`);
    if (chatResult.data.messages) {
        console.log(`   Mensagens: ${chatResult.data.messages.length}`);
        const foundMessage = chatResult.data.messages.find(m => m.id === testMessageId);
        console.log(`   Mensagem teste encontrada: ${foundMessage ? 'SIM' : 'NÃO'}`);
    }
    if (chatResult.data.aventura) {
        console.log(`   Aventura field: ${chatResult.data.aventura.length} chars`);
        console.log(`   Aventura content: "${chatResult.data.aventura}"`);
    } else {
        console.log(`   ⚠️ Aventura field: NÃO ENCONTRADO`);
    }
    console.log('');

    // 3. Adicionar nova mensagem
    console.log('3️⃣ ADICIONANDO NOVA MENSAGEM...');
    const newMessageId = `msg_${Date.now()}_${generateId()}`;
    const newMessage = {
        id: newMessageId,
        chat_id: testChatId,
        sender: 'assistant',
        content: 'Resposta do assistente para teste de persistência',
        files: []
    };

    const messageResult = await makeRequest(`${baseUrl}/api/messages`, 'POST', newMessage);
    console.log(`   Status: ${messageResult.status}`);
    console.log(`   Response:`, messageResult.data);
    console.log('');

    // 4. Atualizar contexto
    console.log('4️⃣ ATUALIZANDO CONTEXTO...');
    const updatedContext = {
        master_rules: 'Regras atualizadas',
        character_sheet: 'Personagem atualizado',
        local_history: 'História local atualizada',
        current_plot: 'Plot atual atualizado',
        relations: 'Relações atualizadas',
        aventura: 'Aventura atualizada com muito mais conteúdo para testar a persistência completa do sistema',
        lastCompressionTime: Date.now()
    };

    const contextResult = await makeRequest(`${baseUrl}/api/chats/${testChatId}/context`, 'PUT', updatedContext);
    console.log(`   Status: ${contextResult.status}`);
    console.log(`   Response:`, contextResult.data);
    console.log('');

    // 5. Verificar estado final (simular refresh da página)
    console.log('5️⃣ VERIFICANDO ESTADO FINAL (SIMULANDO REFRESH)...');
    const finalResult = await makeRequest(`${baseUrl}/api/chats/${testChatId}`);
    console.log(`   Status: ${finalResult.status}`);
    if (finalResult.data.messages) {
        console.log(`   Mensagens finais: ${finalResult.data.messages.length}`);
        const originalMessage = finalResult.data.messages.find(m => m.id === testMessageId);
        const newMessageFound = finalResult.data.messages.find(m => m.id === newMessageId);
        console.log(`   Mensagem original persistiu: ${originalMessage ? 'SIM' : 'NÃO'}`);
        console.log(`   Nova mensagem persistiu: ${newMessageFound ? 'SIM' : 'NÃO'}`);
    }
    if (finalResult.data.aventura) {
        console.log(`   Aventura final: ${finalResult.data.aventura.length} chars`);
        console.log(`   Aventura content: "${finalResult.data.aventura}"`);
        console.log(`   Context atualizado: ${finalResult.data.aventura.includes('muito mais conteúdo') ? 'SIM' : 'NÃO'}`);
    } else {
        console.log(`   ❌ Aventura field: NÃO ENCONTRADO`);
    }

    // 6. Aguardar e verificar persistência
    console.log('');
    console.log('6️⃣ AGUARDANDO 5 SEGUNDOS E VERIFICANDO PERSISTÊNCIA...');
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    const persistenceResult = await makeRequest(`${baseUrl}/api/chats/${testChatId}`);
    console.log(`   Status: ${persistenceResult.status}`);
    if (persistenceResult.data.messages) {
        console.log(`   Mensagens após espera: ${persistenceResult.data.messages.length}`);
    }
    if (persistenceResult.data.aventura) {
        console.log(`   Aventura persistiu: ${persistenceResult.data.aventura.length} chars`);
        console.log(`   Context ainda atualizado: ${persistenceResult.data.aventura.includes('muito mais conteúdo') ? 'SIM' : 'NÃO'}`);
    }

    console.log('\n🏁 TESTE COMPLETO DO WORKFLOW MOBILE CONCLUÍDO!');
    console.log(`\n🧪 Para testar manualmente:`);
    console.log(`   1. Acesse: https://gemini-chat-cloud.onrender.com/mobile`);
    console.log(`   2. Carregue o chat: ${testChatId}`);
    console.log(`   3. Verifique se as mensagens e contexto estão presentes`);
}

testMobileWorkflow().catch(console.error);
