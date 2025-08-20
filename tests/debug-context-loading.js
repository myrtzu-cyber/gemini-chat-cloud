#!/usr/bin/env node
/**
 * Debug Context Loading Issue
 * Investigates why context might appear empty after browser refresh
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

async function debugContextLoading() {
    console.log('🔍 DEBUG: Investigando Problema de Carregamento de Contexto');
    console.log('='.repeat(60));
    console.log(`📍 Server: ${SERVER_URL}`);
    console.log('');

    try {
        // Step 1: Check if we have existing test data
        const fs = require('fs');
        let testChatId = null;
        
        if (fs.existsSync('context-persistence-test.json')) {
            const testData = JSON.parse(fs.readFileSync('context-persistence-test.json', 'utf8'));
            testChatId = testData.chatId;
            console.log(`📋 Usando chat de teste existente: ${testChatId}`);
        } else {
            console.log('📋 Criando novo chat para debug...');
            testChatId = `debug_${Date.now()}`;
        }
        console.log('');

        // Step 2: Create or verify chat with specific problematic context
        console.log('1️⃣ Criando/verificando chat com contexto problemático...');
        
        const problematicContext = {
            aventura: "Esta é uma aventura muito longa que deveria aparecer no frontend mas às vezes aparece como 0 caracteres. O problema pode estar na serialização, deserialização, ou no carregamento do contexto no frontend. Vamos investigar cada etapa do processo para identificar onde os dados estão sendo perdidos.",
            userSettings: {
                theme: "dark",
                language: "pt-BR",
                autoSave: true
            },
            gameData: {
                level: 25,
                experience: 5000,
                achievements: ["First Steps", "Dragon Slayer", "Master Explorer"],
                currentQuest: "Investigate the Missing Context Bug"
            },
            debugInfo: {
                testType: "context_loading_debug",
                timestamp: new Date().toISOString(),
                expectedLength: 0 // Will be calculated
            }
        };
        
        problematicContext.debugInfo.expectedLength = problematicContext.aventura.length;

        // Create or update the chat
        const createResponse = await makeRequest(`${SERVER_URL}/api/chats`, {
            method: 'POST',
            body: {
                id: testChatId,
                title: 'Context Loading Debug Chat',
                model: 'gemini-pro',
                messages: [
                    {
                        id: `msg_${Date.now()}_debug`,
                        sender: 'user',
                        content: 'Debug: Testando carregamento de contexto'
                    }
                ],
                context: problematicContext
            }
        });

        if (createResponse.status === 200 || createResponse.status === 201) {
            console.log('✅ Chat criado/atualizado com contexto debug');
            console.log(`   Aventura length esperado: ${problematicContext.aventura.length} caracteres`);
        } else {
            console.log(`❌ Falha ao criar chat: ${createResponse.status}`);
            console.log(`   Response: ${JSON.stringify(createResponse.data)}`);
        }
        console.log('');

        // Step 3: Test different retrieval methods
        console.log('2️⃣ TESTANDO DIFERENTES MÉTODOS DE RECUPERAÇÃO:');
        console.log('');

        // Method 1: Individual chat retrieval
        console.log('   📖 Método 1: GET /api/chats/{id} (getChatWithMessages)');
        const individualResponse = await makeRequest(`${SERVER_URL}/api/chats/${testChatId}`);
        
        if (individualResponse.status === 200) {
            const chat = individualResponse.data;
            console.log(`   ✅ Status: ${individualResponse.status}`);
            console.log(`   📊 Chat title: ${chat.title}`);
            console.log(`   📊 Messages: ${chat.messages ? chat.messages.length : 0}`);
            
            if (chat.context) {
                console.log(`   ✅ Context presente: Sim`);
                console.log(`   📊 Aventura length: ${chat.context.aventura ? chat.context.aventura.length : 0} caracteres`);
                console.log(`   📊 Game level: ${chat.context.gameData?.level || 'undefined'}`);
                console.log(`   📊 Debug timestamp: ${chat.context.debugInfo?.timestamp || 'undefined'}`);
                
                if (chat.context.aventura && chat.context.aventura.length > 0) {
                    console.log(`   ✅ Aventura content: "${chat.context.aventura.substring(0, 50)}..."`);
                } else {
                    console.log(`   ❌ PROBLEMA: Aventura está vazia ou ausente!`);
                }
            } else {
                console.log(`   ❌ PROBLEMA CRÍTICO: Context ausente!`);
            }
        } else {
            console.log(`   ❌ Falha: HTTP ${individualResponse.status}`);
        }
        console.log('');

        // Method 2: Chat list retrieval
        console.log('   📋 Método 2: GET /api/chats (getAllChats)');
        const listResponse = await makeRequest(`${SERVER_URL}/api/chats`);
        
        if (listResponse.status === 200) {
            const testChatInList = listResponse.data.find(chat => chat.id === testChatId);
            
            if (testChatInList) {
                console.log(`   ✅ Chat encontrado na lista`);
                
                if (testChatInList.context) {
                    console.log(`   ✅ Context na lista: Sim`);
                    console.log(`   📊 Aventura length na lista: ${testChatInList.context.aventura ? testChatInList.context.aventura.length : 0} caracteres`);
                } else {
                    console.log(`   ❌ PROBLEMA: Context ausente na lista!`);
                }
            } else {
                console.log(`   ❌ Chat não encontrado na lista`);
            }
        } else {
            console.log(`   ❌ Falha na lista: HTTP ${listResponse.status}`);
        }
        console.log('');

        // Step 4: Test raw database query simulation
        console.log('3️⃣ SIMULANDO CONSULTA DIRETA AO DATABASE:');
        
        // Use debug endpoint to get more detailed info
        const debugResponse = await makeRequest(`${SERVER_URL}/api/debug/database`);
        
        if (debugResponse.status === 200) {
            console.log('   ✅ Debug endpoint acessível');
            console.log(`   📊 Database type: ${debugResponse.data.database_info?.type}`);
            console.log(`   📊 Server type: ${debugResponse.data.database_info?.server_type}`);
            console.log(`   📊 PostgreSQL available: ${debugResponse.data.database_info?.pg_module_available}`);
        } else {
            console.log(`   ❌ Debug endpoint falhou: ${debugResponse.status}`);
        }
        console.log('');

        // Step 5: Test context update to see if it works
        console.log('4️⃣ TESTANDO ATUALIZAÇÃO DE CONTEXTO:');
        
        const updateTest = {
            ...problematicContext,
            aventura: problematicContext.aventura + " [ATUALIZADO DURANTE DEBUG]",
            debugInfo: {
                ...problematicContext.debugInfo,
                lastDebugUpdate: new Date().toISOString(),
                debugUpdateCount: 1
            }
        };

        const updateResponse = await makeRequest(`${SERVER_URL}/api/chats/${testChatId}/context`, {
            method: 'PUT',
            body: updateTest
        });

        if (updateResponse.status === 200) {
            console.log('   ✅ Update realizado com sucesso');
            
            // Verify update
            const verifyResponse = await makeRequest(`${SERVER_URL}/api/chats/${testChatId}`);
            
            if (verifyResponse.status === 200 && verifyResponse.data.context) {
                const ctx = verifyResponse.data.context;
                console.log(`   ✅ Verificação pós-update:`);
                console.log(`   📊 Aventura length: ${ctx.aventura ? ctx.aventura.length : 0} caracteres`);
                console.log(`   📊 Update count: ${ctx.debugInfo?.debugUpdateCount || 'undefined'}`);
                
                if (ctx.aventura && ctx.aventura.includes('[ATUALIZADO DURANTE DEBUG]')) {
                    console.log('   ✅ Update persistiu corretamente');
                } else {
                    console.log('   ❌ Update não persistiu');
                }
            }
        } else {
            console.log(`   ❌ Update falhou: HTTP ${updateResponse.status}`);
            console.log(`   Response: ${JSON.stringify(updateResponse.data)}`);
        }
        console.log('');

        // Step 6: Multiple rapid retrievals to test consistency
        console.log('5️⃣ TESTE DE CONSISTÊNCIA: Múltiplas recuperações rápidas...');
        
        for (let i = 1; i <= 5; i++) {
            const rapidResponse = await makeRequest(`${SERVER_URL}/api/chats/${testChatId}`);
            
            if (rapidResponse.status === 200 && rapidResponse.data.context) {
                const aventuraLength = rapidResponse.data.context.aventura ? rapidResponse.data.context.aventura.length : 0;
                console.log(`   Tentativa ${i}: ${aventuraLength} caracteres`);
            } else {
                console.log(`   Tentativa ${i}: FALHA ou contexto ausente`);
            }
            
            // Small delay between requests
            await new Promise(resolve => setTimeout(resolve, 500));
        }
        console.log('');

        // Step 7: Final analysis
        console.log('6️⃣ ANÁLISE FINAL:');
        console.log('');
        
        const finalCheck = await makeRequest(`${SERVER_URL}/api/chats/${testChatId}`);
        
        if (finalCheck.status === 200 && finalCheck.data.context) {
            const ctx = finalCheck.data.context;
            
            console.log('📊 ESTADO FINAL DO CONTEXTO:');
            console.log(`   ✅ Context existe: Sim`);
            console.log(`   📊 Aventura length: ${ctx.aventura ? ctx.aventura.length : 0} caracteres`);
            console.log(`   📊 Expected length: ${ctx.debugInfo?.expectedLength || 'undefined'}`);
            console.log(`   📊 Game level: ${ctx.gameData?.level || 'undefined'}`);
            console.log(`   📊 User theme: ${ctx.userSettings?.theme || 'undefined'}`);
            
            if (ctx.aventura && ctx.aventura.length > 100) {
                console.log('');
                console.log('🎉 DIAGNÓSTICO: Contexto está funcionando corretamente!');
                console.log('✅ PostgreSQL está salvando e carregando dados');
                console.log('✅ Serialização/deserialização funcionando');
                console.log('');
                console.log('🔍 Se o frontend mostra 0 caracteres, o problema pode ser:');
                console.log('   1. Cache do browser');
                console.log('   2. JavaScript frontend não atualizando');
                console.log('   3. Timing de carregamento no frontend');
                console.log('   4. Erro na renderização do contexto');
            } else {
                console.log('');
                console.log('❌ PROBLEMA CONFIRMADO: Contexto está vazio no backend!');
                console.log('🔍 Possíveis causas:');
                console.log('   1. Erro na serialização JSON');
                console.log('   2. Problema na query PostgreSQL');
                console.log('   3. Erro no método getChat/getChatWithMessages');
                console.log('   4. Problema na deserialização');
            }
        } else {
            console.log('❌ PROBLEMA CRÍTICO: Contexto ausente na verificação final');
        }

        return true;

    } catch (error) {
        console.error('❌ ERRO NO DEBUG:', error.message);
        return false;
    }
}

if (require.main === module) {
    debugContextLoading().then(success => {
        process.exit(success ? 0 : 1);
    });
}

module.exports = { debugContextLoading };
