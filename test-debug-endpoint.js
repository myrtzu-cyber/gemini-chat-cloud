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

async function testDebugEndpoint() {
    console.log('🔍 TESTANDO ENDPOINT DE DEBUG\n');

    const baseUrl = 'https://gemini-chat-cloud.onrender.com';

    // 1. Verificar estado atual do database
    console.log('1️⃣ VERIFICANDO ESTADO ATUAL DO DATABASE...');
    const debugResult = await makeRequest(`${baseUrl}/api/debug/database`);
    console.log(`   Status: ${debugResult.status}`);
    
    if (debugResult.data) {
        console.log(`   Database Type: ${debugResult.data.databaseType}`);
        console.log(`   Total Chats: ${debugResult.data.totalChats}`);
        console.log(`   Total Messages: ${debugResult.data.totalMessages}`);
        console.log(`   Timestamp: ${debugResult.data.timestamp}`);
        
        if (debugResult.data.chats && debugResult.data.chats.length > 0) {
            console.log(`\n   📋 CHATS ENCONTRADOS:`);
            debugResult.data.chats.forEach((chat, index) => {
                console.log(`      ${index + 1}. "${chat.title}" (${chat.id})`);
                console.log(`         Created: ${chat.created_at}`);
                console.log(`         Updated: ${chat.updated_at}`);
                console.log(`         Has Context: ${chat.hasContext}`);
            });
        }
        
        if (debugResult.data.recentMessages && debugResult.data.recentMessages.length > 0) {
            console.log(`\n   💬 MENSAGENS RECENTES:`);
            debugResult.data.recentMessages.forEach((msg, index) => {
                console.log(`      ${index + 1}. [${msg.sender}] ${msg.content}`);
                console.log(`         Chat: ${msg.chat_id}`);
                console.log(`         Created: ${msg.created_at}`);
            });
        }
    }
    console.log('');

    // 2. Verificar endpoint /api/chats/last
    console.log('2️⃣ VERIFICANDO /api/chats/last...');
    const lastChatResult = await makeRequest(`${baseUrl}/api/chats/last`);
    console.log(`   Status: ${lastChatResult.status}`);
    if (lastChatResult.data) {
        console.log(`   Last Chat ID: ${lastChatResult.data.id}`);
        console.log(`   Last Chat Title: "${lastChatResult.data.title}"`);
        console.log(`   Last Chat Updated: ${lastChatResult.data.updated_at}`);
        console.log(`   Messages Count: ${lastChatResult.data.messages ? lastChatResult.data.messages.length : 'N/A'}`);
    }
    console.log('');

    // 3. Verificar lista de chats
    console.log('3️⃣ VERIFICANDO LISTA DE CHATS...');
    const chatsResult = await makeRequest(`${baseUrl}/api/chats`);
    console.log(`   Status: ${chatsResult.status}`);
    if (chatsResult.data && Array.isArray(chatsResult.data)) {
        console.log(`   Total Chats na Lista: ${chatsResult.data.length}`);
        if (chatsResult.data.length > 0) {
            console.log(`   Primeiro Chat (mais recente): "${chatsResult.data[0].title}" (${chatsResult.data[0].id})`);
            console.log(`   Último Chat (mais antigo): "${chatsResult.data[chatsResult.data.length - 1].title}" (${chatsResult.data[chatsResult.data.length - 1].id})`);
        }
    }

    console.log('\n🏁 TESTE DE DEBUG CONCLUÍDO!');
}

testDebugEndpoint().catch(console.error);
