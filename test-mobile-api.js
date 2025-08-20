#!/usr/bin/env node

const https = require('https');

// Ignorar certificados SSL para teste
process.env["NODE_TLS_REJECT_UNAUTHORIZED"] = 0;

function testAPI(url, description) {
    return new Promise((resolve) => {
        console.log(`🔍 Testando: ${description}`);
        console.log(`   URL: ${url}`);
        
        https.get(url, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const json = JSON.parse(data);
                    console.log(`✅ ${description}:`);
                    console.log(`   Status: ${res.statusCode}`);
                    console.log(`   Response type: ${Array.isArray(json) ? 'Array' : 'Object'}`);
                    
                    if (Array.isArray(json)) {
                        console.log(`   Count: ${json.length}`);
                        if (json.length > 0) {
                            console.log(`   First item:`, JSON.stringify(json[0], null, 2).substring(0, 200) + '...');
                        }
                    } else {
                        if (json.messages) console.log(`   Messages: ${json.messages.length}`);
                        if (json.title) console.log(`   Title: "${json.title}"`);
                        if (json.id) console.log(`   ID: ${json.id}`);
                        console.log(`   Keys: ${Object.keys(json).join(', ')}`);
                    }
                    console.log('');
                    resolve();
                } catch (e) {
                    console.log(`❌ ${description}: Parse error - ${e.message}`);
                    console.log(`   Raw response: ${data.substring(0, 200)}...`);
                    console.log('');
                    resolve();
                }
            });
        }).on('error', (err) => {
            console.log(`❌ ${description}: Request failed - ${err.message}`);
            console.log('');
            resolve();
        });
    });
}

async function test() {
    console.log('🧪 Testando APIs do Mobile Frontend\n');
    
    await testAPI('https://gemini-chat-cloud.onrender.com/api/chats', 'Lista de Chats');
    await testAPI('https://gemini-chat-cloud.onrender.com/api/chats/last', 'Último Chat');
    await testAPI('https://gemini-chat-cloud.onrender.com/api/chats/b9xzyx67w', 'Chat Específico (Mestre)');
    
    console.log('🏁 Teste concluído!');
}

test();
