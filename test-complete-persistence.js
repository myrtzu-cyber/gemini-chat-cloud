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

async function testCompletePersistence() {
    console.log('🧪 TESTE COMPLETO DE PERSISTÊNCIA - MENSAGENS E CONTEXTO\n');

    const chatId = 'b9xzyx67w';
    const baseUrl = 'https://gemini-chat-cloud.onrender.com';

    // 1. Estado inicial
    console.log('1️⃣ VERIFICANDO ESTADO INICIAL...');
    const initialChat = await makeRequest(`${baseUrl}/api/chats/${chatId}`);
    console.log(`   Status: ${initialChat.status}`);
    if (initialChat.data.messages) {
        console.log(`   Mensagens iniciais: ${initialChat.data.messages.length}`);
    }
    console.log(`   Context inicial: ${initialChat.data.context ? 'Existe' : 'Null'}`);
    console.log('');

    // 2. Testar salvamento de mensagem
    console.log('2️⃣ TESTANDO SALVAMENTO DE MENSAGEM...');
    const testMessage = {
        id: `msg_test_${Date.now()}_${Math.random().toString(36).substring(7)}`,
        chat_id: chatId,
        sender: 'user',
        content: `Mensagem de teste - ${new Date().toISOString()}`,
        files: []
    };

    console.log(`   Enviando mensagem: "${testMessage.content}"`);
    const messageResult = await makeRequest(`${baseUrl}/api/messages`, 'POST', testMessage);
    console.log(`   Status: ${messageResult.status}`);
    console.log(`   Response:`, messageResult.data);
    console.log('');

    // 3. Verificar se mensagem foi salva
    console.log('3️⃣ VERIFICANDO SE MENSAGEM FOI SALVA...');
    const afterMessage = await makeRequest(`${baseUrl}/api/chats/${chatId}`);
    console.log(`   Status: ${afterMessage.status}`);
    if (afterMessage.data.messages) {
        console.log(`   Mensagens após save: ${afterMessage.data.messages.length}`);
        const foundMessage = afterMessage.data.messages.find(m => m.id === testMessage.id);
        console.log(`   Mensagem teste encontrada: ${foundMessage ? 'SIM' : 'NÃO'}`);
        if (foundMessage) {
            console.log(`   Conteúdo: "${foundMessage.content}"`);
        }
    }
    console.log('');

    // 4. Testar salvamento de contexto
    console.log('4️⃣ TESTANDO SALVAMENTO DE CONTEXTO...');
    const testContext = {
        plot: "Teste de persistência de contexto",
        characters: ["Herói", "Vilão"],
        location: "Cidade Teste",
        timestamp: new Date().toISOString(),
        testId: Math.random().toString(36).substring(7),
        messageTestId: testMessage.id
    };

    console.log(`   Salvando contexto com testId: ${testContext.testId}`);
    const contextResult = await makeRequest(`${baseUrl}/api/chats/${chatId}/context`, 'PUT', testContext);
    console.log(`   Status: ${contextResult.status}`);
    console.log(`   Response:`, contextResult.data);
    console.log('');

    // 5. Verificar se contexto foi salvo
    console.log('5️⃣ VERIFICANDO SE CONTEXTO FOI SALVO...');
    const afterContext = await makeRequest(`${baseUrl}/api/chats/${chatId}`);
    console.log(`   Status: ${afterContext.status}`);
    console.log(`   Context após save: ${afterContext.data.context ? 'Existe' : 'Null'}`);
    if (afterContext.data.context) {
        try {
            const parsedContext = JSON.parse(afterContext.data.context);
            console.log(`   Test ID encontrado: ${parsedContext.testId === testContext.testId ? 'SIM' : 'NÃO'}`);
            console.log(`   Plot: "${parsedContext.plot}"`);
        } catch (e) {
            console.log(`   Erro ao parsear context: ${e.message}`);
        }
    }
    console.log('');

    // 6. Aguardar e verificar persistência
    console.log('6️⃣ AGUARDANDO 10 SEGUNDOS E VERIFICANDO PERSISTÊNCIA...');
    await new Promise(resolve => setTimeout(resolve, 10000));
    
    const finalCheck = await makeRequest(`${baseUrl}/api/chats/${chatId}`);
    console.log(`   Status: ${finalCheck.status}`);
    
    if (finalCheck.data.messages) {
        console.log(`   Mensagens finais: ${finalCheck.data.messages.length}`);
        const foundMessage = finalCheck.data.messages.find(m => m.id === testMessage.id);
        console.log(`   Mensagem teste persistiu: ${foundMessage ? 'SIM' : 'NÃO'}`);
    }
    
    console.log(`   Context final: ${finalCheck.data.context ? 'Existe' : 'Null'}`);
    if (finalCheck.data.context) {
        try {
            const parsedContext = JSON.parse(finalCheck.data.context);
            console.log(`   Context persistiu: ${parsedContext.testId === testContext.testId ? 'SIM' : 'NÃO'}`);
        } catch (e) {
            console.log(`   Erro ao parsear context final: ${e.message}`);
        }
    }

    console.log('\n🏁 TESTE COMPLETO CONCLUÍDO!');
}

testCompletePersistence().catch(console.error);
