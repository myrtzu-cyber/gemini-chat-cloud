#!/usr/bin/env node
/**
 * Test Context Persistence Across Refresh and Redeploy
 * Comprehensive test to verify context data survives browser refresh and redeployments
 */

const https = require('https');
const fs = require('fs');

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

async function testContextPersistence() {
    console.log('🔍 TESTE CRÍTICO: PERSISTÊNCIA DE CONTEXTO');
    console.log('='.repeat(50));
    console.log(`📍 Server: ${SERVER_URL}`);
    console.log('');

    const testChatId = `persistence_test_${Date.now()}`;
    const testContext = {
        aventura: "Esta é uma aventura épica com dragões e heróis corajosos que deve persistir através de refreshes e redeployments. O contexto contém informações críticas sobre a jornada do usuário.",
        userPreferences: {
            theme: "dark",
            language: "pt-BR",
            difficulty: "hard"
        },
        gameState: {
            level: 15,
            experience: 2500,
            inventory: ["sword", "shield", "potion"],
            location: "Dragon's Lair",
            questProgress: {
                mainQuest: "Defeat the Ancient Dragon",
                sideQuests: ["Find the Lost Artifact", "Help the Village"]
            }
        },
        metadata: {
            testType: "persistence_verification",
            timestamp: new Date().toISOString(),
            version: "1.0.0",
            criticalData: true
        }
    };

    try {
        // Step 1: Verify server health and PostgreSQL
        console.log('1️⃣ Verificando saúde do servidor e PostgreSQL...');
        const healthResponse = await makeRequest(`${SERVER_URL}/api/health`);
        
        if (healthResponse.status === 200) {
            console.log('✅ Servidor saudável');
            console.log(`   Database type: ${healthResponse.data.database_type}`);
            
            if (healthResponse.data.database_type !== 'postgresql-database') {
                throw new Error('❌ Servidor não está usando PostgreSQL!');
            }
        } else {
            throw new Error(`❌ Health check falhou: ${healthResponse.status}`);
        }
        console.log('');

        // Step 2: Create chat with rich context
        console.log('2️⃣ Criando chat com contexto rico...');
        const createResponse = await makeRequest(`${SERVER_URL}/api/chats`, {
            method: 'POST',
            body: {
                id: testChatId,
                title: 'Context Persistence Test',
                model: 'gemini-pro',
                messages: [
                    {
                        id: `msg_${Date.now()}_1`,
                        sender: 'user',
                        content: 'Iniciando teste de persistência de contexto'
                    }
                ],
                context: testContext
            }
        });

        if (createResponse.status === 200 || createResponse.status === 201) {
            console.log('✅ Chat criado com contexto');
            console.log(`   Chat ID: ${testChatId}`);
            console.log(`   Aventura length: ${testContext.aventura.length} caracteres`);
            console.log(`   Game level: ${testContext.gameState.level}`);
        } else {
            throw new Error(`❌ Falha ao criar chat: ${createResponse.status}`);
        }
        console.log('');

        // Step 3: Immediate verification - simulate "refresh"
        console.log('3️⃣ TESTE REFRESH: Verificando contexto imediatamente (simula refresh)...');
        const immediateCheck = await makeRequest(`${SERVER_URL}/api/chats/${testChatId}`);
        
        if (immediateCheck.status === 200) {
            const chat = immediateCheck.data;
            
            if (chat.context) {
                console.log('✅ Contexto encontrado após "refresh"');
                console.log(`   Aventura length: ${chat.context.aventura ? chat.context.aventura.length : 0} caracteres`);
                console.log(`   Game level: ${chat.context.gameState?.level || 'undefined'}`);
                console.log(`   User theme: ${chat.context.userPreferences?.theme || 'undefined'}`);
                
                // Detailed verification
                const checks = [
                    { name: 'aventura', value: chat.context.aventura, expected: testContext.aventura },
                    { name: 'game level', value: chat.context.gameState?.level, expected: testContext.gameState.level },
                    { name: 'user theme', value: chat.context.userPreferences?.theme, expected: testContext.userPreferences.theme },
                    { name: 'inventory', value: JSON.stringify(chat.context.gameState?.inventory), expected: JSON.stringify(testContext.gameState.inventory) }
                ];
                
                console.log('   Verificações detalhadas:');
                checks.forEach(check => {
                    const match = check.value === check.expected;
                    const icon = match ? '✅' : '❌';
                    console.log(`     ${icon} ${check.name}: ${match ? 'OK' : 'FALHOU'}`);
                    if (!match) {
                        console.log(`       Esperado: ${check.expected}`);
                        console.log(`       Recebido: ${check.value}`);
                    }
                });
            } else {
                console.log('❌ CRÍTICO: Contexto não encontrado após refresh!');
            }
        } else {
            console.log(`❌ Falha ao recuperar chat: ${immediateCheck.status}`);
        }
        console.log('');

        // Step 4: Test context update and persistence
        console.log('4️⃣ TESTE UPDATE: Atualizando contexto e verificando persistência...');
        const updatedContext = {
            ...testContext,
            aventura: testContext.aventura + " ATUALIZADO após teste de persistência.",
            gameState: {
                ...testContext.gameState,
                level: testContext.gameState.level + 1,
                experience: testContext.gameState.experience + 500
            },
            metadata: {
                ...testContext.metadata,
                lastUpdate: new Date().toISOString(),
                updateCount: 1
            }
        };

        const updateResponse = await makeRequest(`${SERVER_URL}/api/chats/${testChatId}/context`, {
            method: 'PUT',
            body: updatedContext
        });

        if (updateResponse.status === 200) {
            console.log('✅ Contexto atualizado');
            
            // Verify update persistence
            const updateCheck = await makeRequest(`${SERVER_URL}/api/chats/${testChatId}`);
            
            if (updateCheck.status === 200 && updateCheck.data.context) {
                const ctx = updateCheck.data.context;
                console.log(`   Aventura length após update: ${ctx.aventura ? ctx.aventura.length : 0} caracteres`);
                console.log(`   Game level após update: ${ctx.gameState?.level || 'undefined'}`);
                console.log(`   Update count: ${ctx.metadata?.updateCount || 'undefined'}`);
                
                if (ctx.aventura && ctx.aventura.includes('ATUALIZADO')) {
                    console.log('✅ Update persistiu corretamente');
                } else {
                    console.log('❌ Update não persistiu');
                }
            }
        } else {
            console.log(`❌ Falha ao atualizar contexto: ${updateResponse.status}`);
        }
        console.log('');

        // Step 5: Test context in chat list
        console.log('5️⃣ TESTE LIST: Verificando contexto na lista de chats...');
        const listResponse = await makeRequest(`${SERVER_URL}/api/chats`);
        
        if (listResponse.status === 200) {
            const testChatInList = listResponse.data.find(chat => chat.id === testChatId);
            
            if (testChatInList && testChatInList.context) {
                console.log('✅ Contexto presente na lista');
                console.log(`   Aventura length na lista: ${testChatInList.context.aventura ? testChatInList.context.aventura.length : 0} caracteres`);
            } else {
                console.log('❌ Contexto ausente na lista de chats');
            }
        }
        console.log('');

        // Step 6: Database verification
        console.log('6️⃣ VERIFICAÇÃO DATABASE: Checando stats do PostgreSQL...');
        const statsResponse = await makeRequest(`${SERVER_URL}/api/stats`);
        
        if (statsResponse.status === 200) {
            console.log('✅ Stats do database:');
            console.log(`   Total chats: ${statsResponse.data.total_chats}`);
            console.log(`   Total messages: ${statsResponse.data.total_messages}`);
            console.log(`   Server type: ${statsResponse.data.server_type}`);
            
            if (statsResponse.data.server_type === 'postgresql-database') {
                console.log('✅ PostgreSQL ativo - dados devem persistir');
            } else {
                console.log('❌ Não está usando PostgreSQL!');
            }
        }
        console.log('');

        // Step 7: Save test data for redeploy verification
        console.log('7️⃣ SALVANDO dados para verificação pós-redeploy...');
        const testData = {
            chatId: testChatId,
            originalContext: testContext,
            updatedContext: updatedContext,
            timestamp: new Date().toISOString(),
            testType: 'context_persistence'
        };
        
        fs.writeFileSync('context-persistence-test.json', JSON.stringify(testData, null, 2));
        console.log('✅ Dados salvos em context-persistence-test.json');
        console.log('');

        // Step 8: Instructions for redeploy test
        console.log('8️⃣ INSTRUÇÕES PARA TESTE DE REDEPLOY:');
        console.log('   1. Anote o Chat ID:', testChatId);
        console.log('   2. Trigger um redeploy no Render');
        console.log('   3. Após redeploy, execute:');
        console.log('      node verify-context-after-redeploy.js');
        console.log('');

        // Step 9: Final verification
        console.log('9️⃣ VERIFICAÇÃO FINAL: Testando contexto uma última vez...');
        const finalCheck = await makeRequest(`${SERVER_URL}/api/chats/${testChatId}`);
        
        if (finalCheck.status === 200 && finalCheck.data.context) {
            const ctx = finalCheck.data.context;
            
            console.log('✅ RESULTADO FINAL:');
            console.log(`   ✅ Chat existe: Sim`);
            console.log(`   ✅ Contexto existe: Sim`);
            console.log(`   ✅ Aventura length: ${ctx.aventura ? ctx.aventura.length : 0} caracteres`);
            console.log(`   ✅ Game level: ${ctx.gameState?.level || 'undefined'}`);
            console.log(`   ✅ Metadata presente: ${ctx.metadata ? 'Sim' : 'Não'}`);
            
            if (ctx.aventura && ctx.aventura.length > 100) {
                console.log('🎉 SUCESSO: Contexto está persistindo corretamente!');
                return true;
            } else {
                console.log('❌ FALHA: Contexto aventura está vazio ou truncado');
                return false;
            }
        } else {
            console.log('❌ FALHA CRÍTICA: Contexto perdido na verificação final');
            return false;
        }

    } catch (error) {
        console.error('❌ ERRO NO TESTE:', error.message);
        return false;
    }
}

if (require.main === module) {
    testContextPersistence().then(success => {
        process.exit(success ? 0 : 1);
    });
}

module.exports = { testContextPersistence };
