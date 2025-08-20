#!/usr/bin/env node
/**
 * Debug Message Deletion
 * Detailed debugging of message deletion to identify the persistence issue
 */

const https = require('https');

const SERVER_URL = 'https://gemini-chat-cloud.onrender.com';

function makeRequest(url, options = {}) {
    return new Promise((resolve, reject) => {
        const requestOptions = {
            ...options,
            headers: {
                'Content-Type': 'application/json',
                ...options.headers
            },
            rejectUnauthorized: false
        };

        const req = https.request(url, requestOptions, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const jsonData = JSON.parse(data);
                    resolve({ status: res.statusCode, data: jsonData });
                } catch (error) {
                    resolve({ status: res.statusCode, data: data });
                }
            });
        });

        req.on('error', reject);
        
        if (options.body) {
            req.write(typeof options.body === 'string' ? options.body : JSON.stringify(options.body));
        }
        
        req.end();
    });
}

async function debugMessageDeletion() {
    console.log('🔍 DEBUG: Investigação Detalhada da Deleção de Mensagens');
    console.log('='.repeat(60));
    console.log(`📍 Server: ${SERVER_URL}`);
    console.log('');

    const testChatId = `debug_del_${Date.now()}`;
    let messageIds = [];

    try {
        // Step 1: Create test chat
        console.log('1️⃣ Criando chat de teste...');
        
        const messages = [
            { id: `msg_${Date.now()}_A`, sender: 'user', content: 'Message A - Keep' },
            { id: `msg_${Date.now()}_B`, sender: 'assistant', content: 'Message B - DELETE' },
            { id: `msg_${Date.now()}_C`, sender: 'user', content: 'Message C - Keep' }
        ];
        
        messageIds = messages.map(msg => msg.id);

        const createResponse = await makeRequest(`${SERVER_URL}/api/chats`, {
            method: 'POST',
            body: {
                id: testChatId,
                title: 'Debug Message Deletion',
                model: 'gemini-pro',
                messages: messages,
                context: { debug: true }
            }
        });

        if (createResponse.status === 200 || createResponse.status === 201) {
            console.log('✅ Chat criado');
            console.log(`   Chat ID: ${testChatId}`);
            messages.forEach((msg, i) => {
                console.log(`   ${i + 1}. ${msg.id} - "${msg.content}"`);
            });
        } else {
            throw new Error(`Falha ao criar chat: ${createResponse.status}`);
        }
        console.log('');

        // Step 2: Verify initial state
        console.log('2️⃣ Estado inicial...');
        const initialCheck = await makeRequest(`${SERVER_URL}/api/chats/${testChatId}`);
        
        if (initialCheck.status === 200) {
            const chat = initialCheck.data;
            console.log(`✅ Chat carregado: ${chat.messages.length} mensagens`);
            chat.messages.forEach((msg, i) => {
                console.log(`   ${i + 1}. ${msg.id} - "${msg.content}"`);
            });
        }
        console.log('');

        // Step 3: Delete message B with detailed monitoring
        const messageToDelete = messageIds[1]; // Message B
        console.log(`3️⃣ Deletando mensagem: ${messageToDelete}`);
        console.log(`   Conteúdo: "${messages[1].content}"`);
        console.log('');

        // Check if message exists before deletion
        console.log('🔍 PRÉ-DELEÇÃO: Verificando existência da mensagem...');
        const preDeleteCheck = await makeRequest(`${SERVER_URL}/api/chats/${testChatId}`);
        
        if (preDeleteCheck.status === 200) {
            const preChat = preDeleteCheck.data;
            const messageExists = preChat.messages.some(msg => msg.id === messageToDelete);
            console.log(`   Mensagem ${messageToDelete} existe: ${messageExists ? 'SIM' : 'NÃO'}`);
            console.log(`   Total de mensagens: ${preChat.messages.length}`);
        }
        console.log('');

        // Perform deletion
        console.log('🗑️ EXECUTANDO DELEÇÃO...');
        const deleteResponse = await makeRequest(`${SERVER_URL}/api/messages/${messageToDelete}`, {
            method: 'DELETE'
        });

        console.log(`   Status: ${deleteResponse.status}`);
        console.log(`   Response: ${JSON.stringify(deleteResponse.data, null, 2)}`);
        console.log('');

        // Immediate check after deletion
        console.log('🔍 PÓS-DELEÇÃO IMEDIATA: Verificando estado...');
        const immediateCheck = await makeRequest(`${SERVER_URL}/api/chats/${testChatId}`);
        
        if (immediateCheck.status === 200) {
            const immediateChat = immediateCheck.data;
            const messageStillExists = immediateChat.messages.some(msg => msg.id === messageToDelete);
            console.log(`   Mensagem ${messageToDelete} ainda existe: ${messageStillExists ? 'SIM (PROBLEMA!)' : 'NÃO (OK)'}`);
            console.log(`   Total de mensagens: ${immediateChat.messages.length}`);
            console.log('   Mensagens restantes:');
            immediateChat.messages.forEach((msg, i) => {
                const status = msg.id === messageToDelete ? '❌ DEVERIA TER SIDO DELETADA' : '✅';
                console.log(`     ${i + 1}. ${status} ${msg.id} - "${msg.content}"`);
            });
        }
        console.log('');

        // Wait and check again
        console.log('⏳ AGUARDANDO 3 SEGUNDOS...');
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        console.log('🔍 VERIFICAÇÃO APÓS DELAY...');
        const delayedCheck = await makeRequest(`${SERVER_URL}/api/chats/${testChatId}`);
        
        if (delayedCheck.status === 200) {
            const delayedChat = delayedCheck.data;
            const messageStillExists = delayedChat.messages.some(msg => msg.id === messageToDelete);
            console.log(`   Mensagem ${messageToDelete} ainda existe: ${messageStillExists ? 'SIM (PROBLEMA!)' : 'NÃO (OK)'}`);
            console.log(`   Total de mensagens: ${delayedChat.messages.length}`);
        }
        console.log('');

        // Try to access the deleted message directly
        console.log('🔍 TESTE: Tentar acessar mensagem deletada diretamente...');
        const directAccessResponse = await makeRequest(`${SERVER_URL}/api/messages/${messageToDelete}`);
        console.log(`   Status: ${directAccessResponse.status}`);
        console.log(`   Response: ${JSON.stringify(directAccessResponse.data, null, 2)}`);
        console.log('');

        // Check database stats
        console.log('📊 VERIFICANDO ESTATÍSTICAS DO BANCO...');
        const statsResponse = await makeRequest(`${SERVER_URL}/api/stats`);
        
        if (statsResponse.status === 200) {
            console.log(`   Stats: ${JSON.stringify(statsResponse.data, null, 2)}`);
        }
        console.log('');

        // Try deleting another message to see if it's consistent
        const secondMessageToDelete = messageIds[0]; // Message A
        console.log(`4️⃣ TESTE ADICIONAL: Deletando segunda mensagem: ${secondMessageToDelete}`);
        
        const secondDeleteResponse = await makeRequest(`${SERVER_URL}/api/messages/${secondMessageToDelete}`, {
            method: 'DELETE'
        });

        console.log(`   Status: ${secondDeleteResponse.status}`);
        console.log(`   Response: ${JSON.stringify(secondDeleteResponse.data, null, 2)}`);
        console.log('');

        // Final check
        console.log('🔍 VERIFICAÇÃO FINAL...');
        const finalCheck = await makeRequest(`${SERVER_URL}/api/chats/${testChatId}`);
        
        if (finalCheck.status === 200) {
            const finalChat = finalCheck.data;
            console.log(`   Total de mensagens finais: ${finalChat.messages.length}`);
            console.log('   Mensagens restantes:');
            finalChat.messages.forEach((msg, i) => {
                console.log(`     ${i + 1}. ${msg.id} - "${msg.content}"`);
            });
            
            console.log('');
            console.log('📊 ANÁLISE FINAL:');
            console.log(`   Mensagens originais: ${messageIds.length}`);
            console.log(`   Tentativas de deleção: 2`);
            console.log(`   Mensagens restantes: ${finalChat.messages.length}`);
            console.log(`   Esperado: 1 mensagem restante`);
            
            const deletionsWorked = finalChat.messages.length === 1;
            console.log(`   Deleções funcionaram: ${deletionsWorked ? 'SIM' : 'NÃO'}`);
        }

        // Cleanup
        console.log('');
        console.log('🧹 Limpeza...');
        await makeRequest(`${SERVER_URL}/api/chats/${testChatId}`, { method: 'DELETE' });
        console.log('✅ Chat de teste removido');

    } catch (error) {
        console.error('❌ ERRO NO DEBUG:', error.message);
        
        // Cleanup on error
        try {
            await makeRequest(`${SERVER_URL}/api/chats/${testChatId}`, { method: 'DELETE' });
        } catch (cleanupError) {
            // Ignore cleanup errors
        }
    }
}

if (require.main === module) {
    debugMessageDeletion();
}

module.exports = { debugMessageDeletion };
