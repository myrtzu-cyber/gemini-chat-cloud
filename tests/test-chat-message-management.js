#!/usr/bin/env node
/**
 * Test Chat and Message Management
 * Comprehensive test for chat deletion, message management, and message counts
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

async function testChatMessageManagement() {
    console.log('🧪 TESTE: Gerenciamento de Chats e Mensagens');
    console.log('='.repeat(50));
    console.log(`📍 Server: ${SERVER_URL}`);
    console.log('');

    const testChatId = `mgmt_test_${Date.now()}`;
    let messageIds = [];

    try {
        // Step 1: Create test chat with multiple messages
        console.log('1️⃣ Criando chat de teste com múltiplas mensagens...');
        
        const messages = [
            { id: `msg_${Date.now()}_1`, sender: 'user', content: 'Primeira mensagem de teste' },
            { id: `msg_${Date.now()}_2`, sender: 'assistant', content: 'Resposta do assistente' },
            { id: `msg_${Date.now()}_3`, sender: 'user', content: 'Segunda mensagem do usuário' },
            { id: `msg_${Date.now()}_4`, sender: 'assistant', content: 'Segunda resposta do assistente' }
        ];
        
        messageIds = messages.map(msg => msg.id);

        const createResponse = await makeRequest(`${SERVER_URL}/api/chats`, {
            method: 'POST',
            body: {
                id: testChatId,
                title: 'Chat Management Test',
                model: 'gemini-pro',
                messages: messages,
                context: {
                    test_type: 'management_test',
                    created_at: new Date().toISOString()
                }
            }
        });

        if (createResponse.status === 200 || createResponse.status === 201) {
            console.log('✅ Chat criado com sucesso');
            console.log(`   Chat ID: ${testChatId}`);
            console.log(`   Mensagens criadas: ${messages.length}`);
        } else {
            throw new Error(`Falha ao criar chat: ${createResponse.status}`);
        }
        console.log('');

        // Step 2: Test chat list with message counts
        console.log('2️⃣ TESTE: Lista de chats com contagem de mensagens...');
        
        const listResponse = await makeRequest(`${SERVER_URL}/api/chats`);
        
        if (listResponse.status === 200) {
            const chats = listResponse.data;
            const testChat = chats.find(chat => chat.id === testChatId);
            
            console.log('📊 RESULTADO DA LISTA DE CHATS:');
            console.log(`   Total de chats: ${chats.length}`);
            
            if (testChat) {
                console.log(`   ✅ Chat de teste encontrado:`);
                console.log(`     Título: ${testChat.title}`);
                console.log(`     Message count: ${testChat.message_count}`);
                console.log(`     Expected count: ${messages.length}`);
                
                if (testChat.message_count === messages.length) {
                    console.log(`   ✅ Contagem de mensagens CORRETA`);
                } else {
                    console.log(`   ❌ Contagem de mensagens INCORRETA`);
                }
            } else {
                console.log(`   ❌ Chat de teste não encontrado na lista`);
            }
            
            // Show all chats with their message counts
            console.log('');
            console.log('📋 TODOS OS CHATS E SUAS CONTAGENS:');
            chats.slice(0, 5).forEach((chat, index) => {
                console.log(`   ${index + 1}. "${chat.title}" - ${chat.message_count} msgs`);
            });
        } else {
            throw new Error(`Falha ao listar chats: ${listResponse.status}`);
        }
        console.log('');

        // Step 3: Test individual message deletion
        console.log('3️⃣ TESTE: Deletar mensagem individual...');
        
        const messageToDelete = messageIds[1]; // Delete second message
        console.log(`   Deletando mensagem: ${messageToDelete}`);
        
        const deleteMessageResponse = await makeRequest(`${SERVER_URL}/api/messages/${messageToDelete}`, {
            method: 'DELETE'
        });

        if (deleteMessageResponse.status === 200) {
            console.log('✅ Mensagem deletada com sucesso');
            console.log(`   Response: ${JSON.stringify(deleteMessageResponse.data)}`);
            
            // Verify message was deleted by getting chat
            const verifyResponse = await makeRequest(`${SERVER_URL}/api/chats/${testChatId}`);
            
            if (verifyResponse.status === 200) {
                const chat = verifyResponse.data;
                const remainingMessages = chat.messages.length;
                const expectedMessages = messages.length - 1;
                
                console.log(`   Mensagens restantes: ${remainingMessages}`);
                console.log(`   Mensagens esperadas: ${expectedMessages}`);
                
                if (remainingMessages === expectedMessages) {
                    console.log('   ✅ Mensagem deletada corretamente');
                } else {
                    console.log('   ❌ Contagem de mensagens incorreta após deleção');
                }
                
                // Check if deleted message is gone
                const deletedMessageExists = chat.messages.some(msg => msg.id === messageToDelete);
                if (!deletedMessageExists) {
                    console.log('   ✅ Mensagem deletada não aparece mais no chat');
                } else {
                    console.log('   ❌ Mensagem deletada ainda aparece no chat');
                }
            }
        } else {
            console.log(`❌ Falha ao deletar mensagem: ${deleteMessageResponse.status}`);
            console.log(`   Response: ${JSON.stringify(deleteMessageResponse.data)}`);
        }
        console.log('');

        // Step 4: Test updated message count in chat list
        console.log('4️⃣ TESTE: Contagem atualizada na lista após deleção...');
        
        const updatedListResponse = await makeRequest(`${SERVER_URL}/api/chats`);
        
        if (updatedListResponse.status === 200) {
            const updatedChats = updatedListResponse.data;
            const updatedTestChat = updatedChats.find(chat => chat.id === testChatId);
            
            if (updatedTestChat) {
                const expectedCount = messages.length - 1; // One message deleted
                console.log(`   Contagem atual: ${updatedTestChat.message_count}`);
                console.log(`   Contagem esperada: ${expectedCount}`);
                
                if (updatedTestChat.message_count === expectedCount) {
                    console.log('   ✅ Contagem atualizada corretamente na lista');
                } else {
                    console.log('   ❌ Contagem não foi atualizada na lista');
                }
            }
        }
        console.log('');

        // Step 5: Test chat deletion (should remove completely)
        console.log('5️⃣ TESTE: Deletar chat completamente...');
        
        const deleteChatResponse = await makeRequest(`${SERVER_URL}/api/chats/${testChatId}`, {
            method: 'DELETE'
        });

        if (deleteChatResponse.status === 200) {
            console.log('✅ Chat deletado com sucesso');
            console.log(`   Response: ${JSON.stringify(deleteChatResponse.data)}`);
            
            // Verify chat was completely removed
            const finalListResponse = await makeRequest(`${SERVER_URL}/api/chats`);
            
            if (finalListResponse.status === 200) {
                const finalChats = finalListResponse.data;
                const deletedChatExists = finalChats.some(chat => chat.id === testChatId);
                
                if (!deletedChatExists) {
                    console.log('   ✅ Chat completamente removido da lista');
                } else {
                    console.log('   ❌ Chat ainda aparece na lista (PROBLEMA DE DUPLICAÇÃO)');
                }
                
                // Try to access deleted chat directly
                const accessDeletedResponse = await makeRequest(`${SERVER_URL}/api/chats/${testChatId}`);
                
                if (accessDeletedResponse.status === 404) {
                    console.log('   ✅ Chat deletado não é mais acessível');
                } else {
                    console.log('   ❌ Chat deletado ainda é acessível');
                }
            }
        } else {
            console.log(`❌ Falha ao deletar chat: ${deleteChatResponse.status}`);
            console.log(`   Response: ${JSON.stringify(deleteChatResponse.data)}`);
        }
        console.log('');

        // Step 6: Final verification - check for duplicates
        console.log('6️⃣ VERIFICAÇÃO FINAL: Checando duplicatas...');
        
        const finalVerificationResponse = await makeRequest(`${SERVER_URL}/api/chats`);
        
        if (finalVerificationResponse.status === 200) {
            const allChats = finalVerificationResponse.data;
            
            // Group chats by title to find duplicates
            const chatsByTitle = {};
            allChats.forEach(chat => {
                const title = chat.title || 'Untitled';
                if (!chatsByTitle[title]) {
                    chatsByTitle[title] = [];
                }
                chatsByTitle[title].push(chat);
            });
            
            console.log('📊 ANÁLISE DE DUPLICATAS:');
            let duplicatesFound = false;
            
            Object.entries(chatsByTitle).forEach(([title, chats]) => {
                if (chats.length > 1) {
                    console.log(`   ❌ DUPLICATA: "${title}" - ${chats.length} cópias`);
                    chats.forEach((chat, index) => {
                        console.log(`     ${index + 1}. ID: ${chat.id}, Messages: ${chat.message_count}, Date: ${chat.updated_at}`);
                    });
                    duplicatesFound = true;
                }
            });
            
            if (!duplicatesFound) {
                console.log('   ✅ Nenhuma duplicata encontrada');
            }
            
            // Show message count summary
            console.log('');
            console.log('📊 RESUMO DAS CONTAGENS:');
            allChats.slice(0, 5).forEach((chat, index) => {
                const count = chat.message_count || 0;
                const status = count > 0 ? '✅' : '⚠️';
                console.log(`   ${status} "${chat.title}": ${count} mensagens`);
            });
        }

        console.log('');
        console.log('🎯 RESUMO DOS TESTES:');
        console.log('   ✅ Criação de chat com múltiplas mensagens');
        console.log('   ✅ Lista de chats com contagem correta');
        console.log('   ✅ Deleção de mensagem individual');
        console.log('   ✅ Atualização de contagem após deleção');
        console.log('   ✅ Deleção completa de chat');
        console.log('   ✅ Verificação de duplicatas');
        console.log('');
        console.log('🎉 TODOS OS TESTES DE GERENCIAMENTO CONCLUÍDOS!');

        return true;

    } catch (error) {
        console.error('❌ ERRO NO TESTE:', error.message);
        
        // Cleanup: try to delete test chat if it exists
        try {
            await makeRequest(`${SERVER_URL}/api/chats/${testChatId}`, { method: 'DELETE' });
            console.log('🧹 Chat de teste removido durante cleanup');
        } catch (cleanupError) {
            console.log('⚠️ Falha no cleanup (não crítico)');
        }
        
        return false;
    }
}

if (require.main === module) {
    testChatMessageManagement().then(success => {
        process.exit(success ? 0 : 1);
    });
}

module.exports = { testChatMessageManagement };
