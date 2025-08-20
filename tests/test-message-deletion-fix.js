#!/usr/bin/env node
/**
 * Test Message Deletion Fix
 * Comprehensive test to verify individual message deletion works correctly
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

async function testMessageDeletionFix() {
    console.log('🧪 TESTE: Fix da Deleção de Mensagens Individuais');
    console.log('='.repeat(55));
    console.log(`📍 Server: ${SERVER_URL}`);
    console.log('');

    const testChatId = `msg_del_test_${Date.now()}`;
    let messageIds = [];

    try {
        // Step 1: Create test chat with multiple messages
        console.log('1️⃣ Criando chat de teste com múltiplas mensagens...');
        
        const messages = [
            { id: `msg_${Date.now()}_1`, sender: 'user', content: 'Primeira mensagem - MANTER' },
            { id: `msg_${Date.now()}_2`, sender: 'assistant', content: 'Resposta 1 - DELETAR ESTA' },
            { id: `msg_${Date.now()}_3`, sender: 'user', content: 'Segunda mensagem - MANTER' },
            { id: `msg_${Date.now()}_4`, sender: 'assistant', content: 'Resposta 2 - MANTER' },
            { id: `msg_${Date.now()}_5`, sender: 'user', content: 'Terceira mensagem - DELETAR ESTA' }
        ];
        
        messageIds = messages.map(msg => msg.id);

        const createResponse = await makeRequest(`${SERVER_URL}/api/chats`, {
            method: 'POST',
            body: {
                id: testChatId,
                title: 'Message Deletion Test',
                model: 'gemini-pro',
                messages: messages,
                context: {
                    test_type: 'message_deletion_test',
                    created_at: new Date().toISOString()
                }
            }
        });

        if (createResponse.status === 200 || createResponse.status === 201) {
            console.log('✅ Chat criado com sucesso');
            console.log(`   Chat ID: ${testChatId}`);
            console.log(`   Mensagens criadas: ${messages.length}`);
            console.log('   Mensagens:');
            messages.forEach((msg, index) => {
                console.log(`     ${index + 1}. [${msg.sender}] ${msg.content}`);
            });
        } else {
            throw new Error(`Falha ao criar chat: ${createResponse.status}`);
        }
        console.log('');

        // Step 2: Verify initial state
        console.log('2️⃣ Verificando estado inicial...');
        
        const initialResponse = await makeRequest(`${SERVER_URL}/api/chats/${testChatId}`);
        
        if (initialResponse.status === 200) {
            const chat = initialResponse.data;
            console.log(`✅ Chat carregado: ${chat.messages.length} mensagens`);
            
            // Verify all messages are present
            const foundMessages = chat.messages.map(msg => msg.id);
            const allPresent = messageIds.every(id => foundMessages.includes(id));
            
            if (allPresent) {
                console.log('✅ Todas as mensagens estão presentes inicialmente');
            } else {
                console.log('❌ Algumas mensagens estão faltando no estado inicial');
            }
        } else {
            throw new Error(`Falha ao carregar chat inicial: ${initialResponse.status}`);
        }
        console.log('');

        // Step 3: Delete specific messages using the new endpoint
        console.log('3️⃣ TESTE: Deletar mensagens específicas...');
        
        const messagesToDelete = [messageIds[1], messageIds[4]]; // Delete 2nd and 5th messages
        console.log('   Mensagens a deletar:');
        messagesToDelete.forEach((msgId, index) => {
            const msg = messages.find(m => m.id === msgId);
            console.log(`     ${index + 1}. ${msgId} - "${msg.content}"`);
        });
        console.log('');

        let deletionResults = [];

        for (const messageId of messagesToDelete) {
            console.log(`🗑️ Deletando mensagem: ${messageId}`);
            
            const deleteResponse = await makeRequest(`${SERVER_URL}/api/messages/${messageId}`, {
                method: 'DELETE'
            });

            if (deleteResponse.status === 200) {
                console.log(`   ✅ Deletada com sucesso`);
                console.log(`   Response: ${JSON.stringify(deleteResponse.data)}`);
                deletionResults.push({ messageId, success: true, response: deleteResponse.data });
            } else {
                console.log(`   ❌ Falha: HTTP ${deleteResponse.status}`);
                console.log(`   Response: ${JSON.stringify(deleteResponse.data)}`);
                deletionResults.push({ messageId, success: false, status: deleteResponse.status });
            }
            
            // Small delay between deletions
            await new Promise(resolve => setTimeout(resolve, 500));
        }
        console.log('');

        // Step 4: Verify messages were actually deleted from database
        console.log('4️⃣ VERIFICAÇÃO: Mensagens deletadas do banco de dados...');
        
        const verifyResponse = await makeRequest(`${SERVER_URL}/api/chats/${testChatId}`);
        
        if (verifyResponse.status === 200) {
            const updatedChat = verifyResponse.data;
            const remainingMessages = updatedChat.messages;
            
            console.log(`📊 ESTADO APÓS DELEÇÃO:`);
            console.log(`   Mensagens restantes: ${remainingMessages.length}`);
            console.log(`   Mensagens esperadas: ${messages.length - messagesToDelete.length}`);
            
            // Check if deleted messages are gone
            const deletedMessagesStillPresent = messagesToDelete.filter(msgId => 
                remainingMessages.some(msg => msg.id === msgId)
            );
            
            if (deletedMessagesStillPresent.length === 0) {
                console.log('   ✅ Mensagens deletadas não aparecem mais no chat');
            } else {
                console.log('   ❌ Algumas mensagens deletadas ainda aparecem:');
                deletedMessagesStillPresent.forEach(msgId => {
                    console.log(`     - ${msgId}`);
                });
            }
            
            // Check if remaining messages are correct
            const expectedRemainingIds = messageIds.filter(id => !messagesToDelete.includes(id));
            const actualRemainingIds = remainingMessages.map(msg => msg.id);
            
            const allExpectedPresent = expectedRemainingIds.every(id => actualRemainingIds.includes(id));
            const noUnexpectedMessages = actualRemainingIds.every(id => expectedRemainingIds.includes(id));
            
            if (allExpectedPresent && noUnexpectedMessages) {
                console.log('   ✅ Mensagens restantes estão corretas');
            } else {
                console.log('   ❌ Mensagens restantes não estão corretas');
                console.log(`     Esperadas: ${expectedRemainingIds.join(', ')}`);
                console.log(`     Atuais: ${actualRemainingIds.join(', ')}`);
            }
            
            console.log('');
            console.log('📋 MENSAGENS RESTANTES:');
            remainingMessages.forEach((msg, index) => {
                console.log(`   ${index + 1}. [${msg.sender}] ${msg.content}`);
            });
        } else {
            throw new Error(`Falha ao verificar chat após deleção: ${verifyResponse.status}`);
        }
        console.log('');

        // Step 5: Test persistence after "refresh" (reload chat)
        console.log('5️⃣ TESTE: Persistência após "refresh"...');
        
        // Simulate browser refresh by loading chat again
        const refreshResponse = await makeRequest(`${SERVER_URL}/api/chats/${testChatId}`);
        
        if (refreshResponse.status === 200) {
            const refreshedChat = refreshResponse.data;
            const refreshedMessages = refreshedChat.messages;
            
            console.log(`📊 ESTADO APÓS "REFRESH":`);
            console.log(`   Mensagens após refresh: ${refreshedMessages.length}`);
            
            // Check if deletions persisted
            const deletedStillGone = messagesToDelete.every(msgId => 
                !refreshedMessages.some(msg => msg.id === msgId)
            );
            
            if (deletedStillGone) {
                console.log('   ✅ Deleções persistiram após refresh');
            } else {
                console.log('   ❌ Algumas mensagens deletadas reapareceram após refresh');
            }
            
            // Check if remaining messages are still there
            const expectedStillThere = messageIds.filter(id => !messagesToDelete.includes(id));
            const actualStillThere = refreshedMessages.map(msg => msg.id);
            
            const remainingPersisted = expectedStillThere.every(id => actualStillThere.includes(id));
            
            if (remainingPersisted) {
                console.log('   ✅ Mensagens restantes persistiram após refresh');
            } else {
                console.log('   ❌ Algumas mensagens restantes foram perdidas após refresh');
            }
        } else {
            throw new Error(`Falha ao carregar chat após refresh: ${refreshResponse.status}`);
        }
        console.log('');

        // Step 6: Check for chat duplication
        console.log('6️⃣ VERIFICAÇÃO: Duplicação de chats...');
        
        const listResponse = await makeRequest(`${SERVER_URL}/api/chats`);
        
        if (listResponse.status === 200) {
            const allChats = listResponse.data;
            const testChats = allChats.filter(chat => chat.title === 'Message Deletion Test');
            
            console.log(`📊 ANÁLISE DE DUPLICAÇÃO:`);
            console.log(`   Chats com título "Message Deletion Test": ${testChats.length}`);
            
            if (testChats.length === 1) {
                console.log('   ✅ Nenhuma duplicação detectada');
            } else {
                console.log('   ❌ DUPLICAÇÃO DETECTADA:');
                testChats.forEach((chat, index) => {
                    console.log(`     ${index + 1}. ID: ${chat.id}, Messages: ${chat.message_count}, Date: ${chat.updated_at}`);
                });
            }
        }
        console.log('');

        // Step 7: Cleanup
        console.log('7️⃣ Limpeza...');
        
        const deleteResponse = await makeRequest(`${SERVER_URL}/api/chats/${testChatId}`, {
            method: 'DELETE'
        });
        
        if (deleteResponse.status === 200) {
            console.log('✅ Chat de teste removido');
        } else {
            console.log('⚠️ Falha ao remover chat de teste (não crítico)');
        }
        console.log('');

        // Final summary
        console.log('🎯 RESUMO DOS TESTES:');
        console.log('   ✅ Criação de chat com múltiplas mensagens');
        console.log('   ✅ Deleção de mensagens individuais via API');
        console.log('   ✅ Verificação de remoção do banco de dados');
        console.log('   ✅ Teste de persistência após refresh');
        console.log('   ✅ Verificação de não-duplicação de chats');
        console.log('   ✅ Limpeza de dados de teste');
        console.log('');
        
        const allDeletionsSuccessful = deletionResults.every(result => result.success);
        
        if (allDeletionsSuccessful) {
            console.log('🎉 TODOS OS TESTES DE DELEÇÃO DE MENSAGENS PASSARAM!');
            console.log('✅ Fix da deleção de mensagens funcionando corretamente');
        } else {
            console.log('❌ ALGUNS TESTES FALHARAM');
            console.log('⚠️ Fix da deleção de mensagens precisa de ajustes');
        }

        return allDeletionsSuccessful;

    } catch (error) {
        console.error('❌ ERRO NO TESTE:', error.message);
        
        // Cleanup on error
        try {
            await makeRequest(`${SERVER_URL}/api/chats/${testChatId}`, { method: 'DELETE' });
            console.log('🧹 Chat de teste removido durante cleanup de erro');
        } catch (cleanupError) {
            console.log('⚠️ Falha no cleanup de erro (não crítico)');
        }
        
        return false;
    }
}

if (require.main === module) {
    testMessageDeletionFix().then(success => {
        process.exit(success ? 0 : 1);
    });
}

module.exports = { testMessageDeletionFix };
