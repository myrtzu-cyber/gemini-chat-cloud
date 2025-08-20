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
                    resolve({ status: res.statusCode, data: responseData });
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

async function testContextPersistence() {
    console.log('🧪 Testando Persistência de Contexto\n');

    const chatId = 'b9xzyx67w';
    const baseUrl = 'https://gemini-chat-cloud.onrender.com';

    // 1. Verificar estado inicial do chat
    console.log('1️⃣ Verificando estado inicial do chat...');
    const initialChat = await makeRequest(`${baseUrl}/api/chats/${chatId}`);
    console.log(`   Status: ${initialChat.status}`);
    console.log(`   Context atual: ${initialChat.data.context ? 'Existe' : 'Null'}`);
    if (initialChat.data.context) {
        console.log(`   Tamanho do context: ${initialChat.data.context.length} chars`);
    }
    console.log('');

    // 2. Salvar novo contexto
    console.log('2️⃣ Salvando novo contexto...');
    const testContext = {
        plot: "Teste de persistência de contexto",
        characters: ["Herói", "Vilão"],
        location: "Cidade Teste",
        timestamp: new Date().toISOString(),
        testId: Math.random().toString(36).substring(7)
    };

    const saveResult = await makeRequest(`${baseUrl}/api/chats/${chatId}/context`, 'PUT', testContext);
    console.log(`   Status: ${saveResult.status}`);
    console.log(`   Response:`, saveResult.data);
    console.log('');

    // 3. Verificar se foi salvo imediatamente
    console.log('3️⃣ Verificando se foi salvo imediatamente...');
    const afterSave = await makeRequest(`${baseUrl}/api/chats/${chatId}`);
    console.log(`   Status: ${afterSave.status}`);
    console.log(`   Context após save: ${afterSave.data.context ? 'Existe' : 'Null'}`);
    if (afterSave.data.context) {
        try {
            const parsedContext = JSON.parse(afterSave.data.context);
            console.log(`   Test ID encontrado: ${parsedContext.testId === testContext.testId ? 'SIM' : 'NÃO'}`);
            console.log(`   Plot: "${parsedContext.plot}"`);
        } catch (e) {
            console.log(`   Erro ao parsear context: ${e.message}`);
        }
    }
    console.log('');

    // 4. Aguardar um pouco e verificar novamente
    console.log('4️⃣ Aguardando 5 segundos e verificando persistência...');
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    const afterWait = await makeRequest(`${baseUrl}/api/chats/${chatId}`);
    console.log(`   Status: ${afterWait.status}`);
    console.log(`   Context após espera: ${afterWait.data.context ? 'Existe' : 'Null'}`);
    if (afterWait.data.context) {
        try {
            const parsedContext = JSON.parse(afterWait.data.context);
            console.log(`   Test ID ainda existe: ${parsedContext.testId === testContext.testId ? 'SIM' : 'NÃO'}`);
        } catch (e) {
            console.log(`   Erro ao parsear context: ${e.message}`);
        }
    }

    console.log('\n🏁 Teste de persistência concluído!');
}

testContextPersistence().catch(console.error);
