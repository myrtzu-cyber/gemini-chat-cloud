#!/usr/bin/env node
/**
 * Test Context Operations
 * Comprehensive test of all context-related functions in PostgreSQL
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

async function testContextOperations() {
    console.log('🧪 TESTE COMPLETO DE OPERAÇÕES DE CONTEXTO');
    console.log('='.repeat(55));
    console.log(`📍 Server: ${SERVER_URL}`);
    console.log('');

    const testChatId = `context_test_${Date.now()}`;
    let testResults = {
        contextSaving: false,
        contextUpdates: false,
        contextRetrieval: false,
        contextInList: false,
        contextPersistence: false
    };

    try {
        // 0. Health Check
        console.log('0️⃣ Verificando saúde do servidor...');
        const healthResponse = await makeRequest(`${SERVER_URL}/api/health`);
        
        if (healthResponse.status === 200) {
            console.log('✅ Servidor está saudável');
            console.log(`   Database type: ${healthResponse.data.database_type}`);
            
            if (healthResponse.data.database_type !== 'postgresql-database') {
                throw new Error('Servidor não está usando PostgreSQL!');
            }
        } else {
            throw new Error(`Health check falhou: ${healthResponse.status}`);
        }
        console.log('');

        // 1. TEST CONTEXT SAVING - Create chat with complex context
        console.log('1️⃣ TESTE CONTEXT SAVING - Criando chat com contexto complexo...');
        
        const complexContext = {
            userPreferences: {
                language: 'pt-BR',
                theme: 'dark',
                notifications: true
            },
            conversationState: {
                topic: 'PostgreSQL Testing',
                mood: 'technical',
                complexity: 'advanced'
            },
            metadata: {
                testType: 'context_operations',
                timestamp: new Date().toISOString(),
                version: '1.0.0',
                tags: ['test', 'context', 'postgresql']
            },
            customData: {
                numbers: [1, 2, 3, 4, 5],
                boolean: true,
                nested: {
                    deep: {
                        value: 'deeply nested value'
                    }
                }
            }
        };

        const createResponse = await makeRequest(`${SERVER_URL}/api/chats`, {
            method: 'POST',
            body: {
                id: testChatId,
                title: 'Context Test Chat',
                model: 'gemini-pro',
                messages: [
                    {
                        id: `msg_${Date.now()}_1`,
                        sender: 'user',
                        content: 'Testando salvamento de contexto complexo'
                    }
                ],
                context: complexContext
            }
        });

        if (createResponse.status === 200 || createResponse.status === 201) {
            console.log('✅ CONTEXT SAVING: Chat com contexto criado com sucesso');
            console.log(`   Chat ID: ${testChatId}`);
            console.log(`   Contexto salvo: ${Object.keys(complexContext).length} propriedades principais`);
            testResults.contextSaving = true;
        } else {
            console.log(`❌ CONTEXT SAVING: Falhou - HTTP ${createResponse.status}`);
            console.log(`   Response: ${JSON.stringify(createResponse.data)}`);
        }
        console.log('');

        // 2. TEST CONTEXT RETRIEVAL - Get individual chat with context
        console.log('2️⃣ TESTE CONTEXT RETRIEVAL - Recuperando chat com contexto...');
        const retrievalResponse = await makeRequest(`${SERVER_URL}/api/chats/${testChatId}`);
        
        if (retrievalResponse.status === 200) {
            const chat = retrievalResponse.data;
            
            if (chat.context) {
                console.log('✅ CONTEXT RETRIEVAL: Contexto recuperado com sucesso');
                console.log(`   Propriedades principais: ${Object.keys(chat.context).length}`);
                
                // Verify complex context structure
                const ctx = chat.context;
                const checks = [
                    ctx.userPreferences?.language === 'pt-BR',
                    ctx.conversationState?.topic === 'PostgreSQL Testing',
                    ctx.metadata?.testType === 'context_operations',
                    Array.isArray(ctx.customData?.numbers),
                    ctx.customData?.nested?.deep?.value === 'deeply nested value'
                ];
                
                const passedChecks = checks.filter(Boolean).length;
                console.log(`   Verificações estruturais: ${passedChecks}/${checks.length} passaram`);
                
                if (passedChecks === checks.length) {
                    console.log('✅ CONTEXT RETRIEVAL: Estrutura do contexto íntegra');
                    testResults.contextRetrieval = true;
                } else {
                    console.log('❌ CONTEXT RETRIEVAL: Estrutura do contexto corrompida');
                    console.log(`   Contexto recebido:`, JSON.stringify(ctx, null, 2));
                }
            } else {
                console.log('❌ CONTEXT RETRIEVAL: Contexto não encontrado no chat');
            }
        } else {
            console.log(`❌ CONTEXT RETRIEVAL: Falhou - HTTP ${retrievalResponse.status}`);
        }
        console.log('');

        // 3. TEST CONTEXT IN LIST - Verify context appears in chat list
        console.log('3️⃣ TESTE CONTEXT IN LIST - Verificando contexto na lista de chats...');
        const listResponse = await makeRequest(`${SERVER_URL}/api/chats`);
        
        if (listResponse.status === 200) {
            const testChatInList = listResponse.data.find(chat => chat.id === testChatId);
            
            if (testChatInList && testChatInList.context) {
                console.log('✅ CONTEXT IN LIST: Contexto presente na lista de chats');
                console.log(`   Propriedades: ${Object.keys(testChatInList.context).length}`);
                console.log(`   Test type: ${testChatInList.context.metadata?.testType}`);
                testResults.contextInList = true;
            } else if (testChatInList) {
                console.log('❌ CONTEXT IN LIST: Chat encontrado mas sem contexto');
            } else {
                console.log('❌ CONTEXT IN LIST: Chat não encontrado na lista');
            }
        } else {
            console.log(`❌ CONTEXT IN LIST: Falhou - HTTP ${listResponse.status}`);
        }
        console.log('');

        // 4. TEST CONTEXT UPDATES - Update existing context
        console.log('4️⃣ TESTE CONTEXT UPDATES - Atualizando contexto existente...');
        
        const updatedContext = {
            ...complexContext,
            userPreferences: {
                ...complexContext.userPreferences,
                theme: 'light', // Changed
                fontSize: 'large' // Added
            },
            conversationState: {
                ...complexContext.conversationState,
                mood: 'friendly', // Changed
                lastUpdate: new Date().toISOString() // Added
            },
            metadata: {
                ...complexContext.metadata,
                version: '1.1.0', // Updated
                updateCount: 1 // Added
            },
            newSection: {
                addedDuringUpdate: true,
                timestamp: new Date().toISOString()
            }
        };

        const updateResponse = await makeRequest(`${SERVER_URL}/api/chats/${testChatId}/context`, {
            method: 'PUT',
            body: updatedContext
        });

        if (updateResponse.status === 200) {
            console.log('✅ CONTEXT UPDATES: Contexto atualizado com sucesso');
            
            // Verify update by retrieving again
            const verifyResponse = await makeRequest(`${SERVER_URL}/api/chats/${testChatId}`);
            
            if (verifyResponse.status === 200 && verifyResponse.data.context) {
                const updatedCtx = verifyResponse.data.context;
                
                const updateChecks = [
                    updatedCtx.userPreferences?.theme === 'light',
                    updatedCtx.userPreferences?.fontSize === 'large',
                    updatedCtx.conversationState?.mood === 'friendly',
                    updatedCtx.metadata?.version === '1.1.0',
                    updatedCtx.metadata?.updateCount === 1,
                    updatedCtx.newSection?.addedDuringUpdate === true
                ];
                
                const passedUpdates = updateChecks.filter(Boolean).length;
                console.log(`   Verificações de atualização: ${passedUpdates}/${updateChecks.length} passaram`);
                
                if (passedUpdates === updateChecks.length) {
                    console.log('✅ CONTEXT UPDATES: Atualizações verificadas com sucesso');
                    testResults.contextUpdates = true;
                } else {
                    console.log('❌ CONTEXT UPDATES: Algumas atualizações não persistiram');
                    console.log(`   Contexto atualizado:`, JSON.stringify(updatedCtx, null, 2));
                }
            } else {
                console.log('❌ CONTEXT UPDATES: Falha na verificação da atualização');
            }
        } else {
            console.log(`❌ CONTEXT UPDATES: Falhou - HTTP ${updateResponse.status}`);
            console.log(`   Response: ${JSON.stringify(updateResponse.data)}`);
        }
        console.log('');

        // 5. TEST CONTEXT PERSISTENCE - Simulate restart by checking stats
        console.log('5️⃣ TESTE CONTEXT PERSISTENCE - Verificando persistência...');
        
        // Get current stats to verify PostgreSQL is being used
        const statsResponse = await makeRequest(`${SERVER_URL}/api/stats`);
        
        if (statsResponse.status === 200) {
            const stats = statsResponse.data;
            
            if (stats.server_type === 'postgresql-database') {
                console.log('✅ CONTEXT PERSISTENCE: PostgreSQL ativo - dados persistem');
                console.log(`   Total de chats: ${stats.total_chats}`);
                console.log(`   Total de mensagens: ${stats.total_messages}`);
                
                // Final verification - retrieve context one more time
                const finalCheck = await makeRequest(`${SERVER_URL}/api/chats/${testChatId}`);
                
                if (finalCheck.status === 200 && finalCheck.data.context) {
                    console.log('✅ CONTEXT PERSISTENCE: Contexto ainda acessível');
                    testResults.contextPersistence = true;
                } else {
                    console.log('❌ CONTEXT PERSISTENCE: Contexto perdido');
                }
            } else {
                console.log('❌ CONTEXT PERSISTENCE: Não está usando PostgreSQL');
            }
        } else {
            console.log('❌ CONTEXT PERSISTENCE: Não foi possível verificar stats');
        }
        console.log('');

        // 6. CLEANUP - Delete test chat
        console.log('6️⃣ LIMPEZA - Removendo chat de teste...');
        const deleteResponse = await makeRequest(`${SERVER_URL}/api/chats/${testChatId}`, {
            method: 'DELETE'
        });
        
        if (deleteResponse.status === 200) {
            console.log('✅ LIMPEZA: Chat de teste removido com sucesso');
        } else {
            console.log('⚠️ LIMPEZA: Falha ao remover chat de teste (não crítico)');
        }
        console.log('');

        // FINAL REPORT
        console.log('📊 RELATÓRIO FINAL - OPERAÇÕES DE CONTEXTO');
        console.log('='.repeat(55));
        
        const operations = [
            { name: 'CONTEXT SAVING', status: testResults.contextSaving, description: 'Salvar contexto ao criar chat' },
            { name: 'CONTEXT RETRIEVAL', status: testResults.contextRetrieval, description: 'Recuperar contexto de chat individual' },
            { name: 'CONTEXT IN LIST', status: testResults.contextInList, description: 'Contexto presente na lista de chats' },
            { name: 'CONTEXT UPDATES', status: testResults.contextUpdates, description: 'Atualizar contexto existente' },
            { name: 'CONTEXT PERSISTENCE', status: testResults.contextPersistence, description: 'Persistência em PostgreSQL' }
        ];

        operations.forEach(op => {
            const icon = op.status ? '✅' : '❌';
            const status = op.status ? 'PASSOU' : 'FALHOU';
            console.log(`${icon} ${op.name}: ${status} - ${op.description}`);
        });

        const passedTests = operations.filter(op => op.status).length;
        const totalTests = operations.length;
        
        console.log('');
        console.log(`📈 RESULTADO: ${passedTests}/${totalTests} testes de contexto passaram`);
        
        if (passedTests === totalTests) {
            console.log('🎉 SUCESSO COMPLETO! Todas as operações de contexto funcionam perfeitamente');
            console.log('✅ PostgreSQL está gerenciando contextos corretamente');
            console.log('✅ Serialização/deserialização JSON funcionando');
            console.log('✅ Contextos complexos e aninhados suportados');
        } else {
            console.log('⚠️ ALGUNS TESTES DE CONTEXTO FALHARAM');
            const failedOps = operations.filter(op => !op.status);
            console.log('❌ Operações com falha:');
            failedOps.forEach(op => {
                console.log(`   - ${op.name}: ${op.description}`);
            });
        }

        return passedTests === totalTests;

    } catch (error) {
        console.error('❌ ERRO FATAL NO TESTE DE CONTEXTO:', error.message);
        console.error('');
        console.error('🔍 Possíveis causas:');
        console.error('   - Servidor não está respondendo');
        console.error('   - Problemas de conectividade');
        console.error('   - Erro no código da aplicação');
        console.error('   - Método getChat() ainda ausente');
        return false;
    }
}

if (require.main === module) {
    testContextOperations().then(success => {
        process.exit(success ? 0 : 1);
    });
}

module.exports = { testContextOperations };
