#!/usr/bin/env node
/**
 * Test CRUD Operations
 * Comprehensive test of all chat management functions (Create, Read, Update, Delete)
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

async function testCRUDOperations() {
    console.log('🧪 TESTE COMPLETO DE OPERAÇÕES CRUD');
    console.log('='.repeat(50));
    console.log(`📍 Server: ${SERVER_URL}`);
    console.log('');

    const testChatId = `crud_test_${Date.now()}`;
    let testResults = {
        create: false,
        read: false,
        update: false,
        delete: false,
        list: false
    };

    try {
        // 0. Health Check
        console.log('0️⃣ Verificando saúde do servidor...');
        const healthResponse = await makeRequest(`${SERVER_URL}/api/health`);
        
        if (healthResponse.status === 200) {
            console.log('✅ Servidor está saudável');
            console.log(`   Database type: ${healthResponse.data.database_type}`);
        } else {
            throw new Error(`Health check falhou: ${healthResponse.status}`);
        }
        console.log('');

        // 1. CREATE - Test chat creation
        console.log('1️⃣ TESTE CREATE - Criando chat de teste...');
        const createResponse = await makeRequest(`${SERVER_URL}/api/chats`, {
            method: 'POST',
            body: {
                id: testChatId,
                title: 'CRUD Test Chat',
                model: 'gemini-pro',
                messages: [
                    {
                        id: `msg_${Date.now()}_1`,
                        sender: 'user',
                        content: 'Mensagem de teste para CRUD'
                    },
                    {
                        id: `msg_${Date.now()}_2`,
                        sender: 'assistant',
                        content: 'Resposta de teste para CRUD'
                    }
                ],
                context: {
                    testType: 'CRUD',
                    timestamp: new Date().toISOString()
                }
            }
        });

        if (createResponse.status === 200 || createResponse.status === 201) {
            console.log('✅ CREATE: Chat criado com sucesso');
            console.log(`   Chat ID: ${testChatId}`);
            testResults.create = true;
        } else {
            console.log(`❌ CREATE: Falhou - HTTP ${createResponse.status}`);
            console.log(`   Response: ${JSON.stringify(createResponse.data)}`);
        }
        console.log('');

        // 2. READ - Test individual chat retrieval
        console.log('2️⃣ TESTE READ - Recuperando chat específico...');
        const readResponse = await makeRequest(`${SERVER_URL}/api/chats/${testChatId}`);
        
        if (readResponse.status === 200) {
            console.log('✅ READ: Chat recuperado com sucesso');
            console.log(`   Título: ${readResponse.data.title}`);
            console.log(`   Mensagens: ${readResponse.data.messages ? readResponse.data.messages.length : 0}`);
            console.log(`   Contexto: ${readResponse.data.context ? 'Presente' : 'Ausente'}`);
            testResults.read = true;
        } else {
            console.log(`❌ READ: Falhou - HTTP ${readResponse.status}`);
        }
        console.log('');

        // 3. LIST - Test chat listing
        console.log('3️⃣ TESTE LIST - Listando todos os chats...');
        const listResponse = await makeRequest(`${SERVER_URL}/api/chats`);
        
        if (listResponse.status === 200) {
            const testChatFound = listResponse.data.find(chat => chat.id === testChatId);
            if (testChatFound) {
                console.log('✅ LIST: Chat encontrado na lista');
                console.log(`   Total de chats: ${listResponse.data.length}`);
                console.log(`   Chat de teste presente: Sim`);
                testResults.list = true;
            } else {
                console.log('❌ LIST: Chat de teste não encontrado na lista');
            }
        } else {
            console.log(`❌ LIST: Falhou - HTTP ${listResponse.status}`);
        }
        console.log('');

        // 4. UPDATE - Test context update
        console.log('4️⃣ TESTE UPDATE - Atualizando contexto do chat...');
        const updateResponse = await makeRequest(`${SERVER_URL}/api/chats/${testChatId}/context`, {
            method: 'PUT',
            body: {
                testType: 'CRUD_UPDATED',
                timestamp: new Date().toISOString(),
                updateCount: 1,
                status: 'updated'
            }
        });

        if (updateResponse.status === 200) {
            console.log('✅ UPDATE: Contexto atualizado com sucesso');
            
            // Verify update by reading again
            const verifyResponse = await makeRequest(`${SERVER_URL}/api/chats/${testChatId}`);
            if (verifyResponse.status === 200 && verifyResponse.data.context) {
                const context = verifyResponse.data.context;
                if (context.testType === 'CRUD_UPDATED' && context.updateCount === 1) {
                    console.log('✅ UPDATE: Verificação confirmada - contexto foi atualizado');
                    testResults.update = true;
                } else {
                    console.log('❌ UPDATE: Verificação falhou - contexto não foi atualizado corretamente');
                }
            }
        } else {
            console.log(`❌ UPDATE: Falhou - HTTP ${updateResponse.status}`);
            console.log(`   Response: ${JSON.stringify(updateResponse.data)}`);
        }
        console.log('');

        // 5. DELETE - Test chat deletion (the critical test!)
        console.log('5️⃣ TESTE DELETE - Deletando chat de teste...');
        const deleteResponse = await makeRequest(`${SERVER_URL}/api/chats/${testChatId}`, {
            method: 'DELETE'
        });

        if (deleteResponse.status === 200) {
            console.log('✅ DELETE: Chat deletado com sucesso');
            console.log(`   Response: ${JSON.stringify(deleteResponse.data)}`);
            
            // Verify deletion by trying to read the chat
            const verifyDeleteResponse = await makeRequest(`${SERVER_URL}/api/chats/${testChatId}`);
            if (verifyDeleteResponse.status === 404) {
                console.log('✅ DELETE: Verificação confirmada - chat não existe mais');
                testResults.delete = true;
            } else {
                console.log('❌ DELETE: Verificação falhou - chat ainda existe');
            }
        } else {
            console.log(`❌ DELETE: Falhou - HTTP ${deleteResponse.status}`);
            console.log(`   Response: ${JSON.stringify(deleteResponse.data)}`);
        }
        console.log('');

        // Final Report
        console.log('📊 RELATÓRIO FINAL DOS TESTES CRUD');
        console.log('='.repeat(50));
        
        const operations = [
            { name: 'CREATE', status: testResults.create, description: 'Criar chat' },
            { name: 'READ', status: testResults.read, description: 'Ler chat específico' },
            { name: 'LIST', status: testResults.list, description: 'Listar todos os chats' },
            { name: 'UPDATE', status: testResults.update, description: 'Atualizar contexto' },
            { name: 'DELETE', status: testResults.delete, description: 'Deletar chat' }
        ];

        operations.forEach(op => {
            const icon = op.status ? '✅' : '❌';
            const status = op.status ? 'PASSOU' : 'FALHOU';
            console.log(`${icon} ${op.name}: ${status} - ${op.description}`);
        });

        const passedTests = operations.filter(op => op.status).length;
        const totalTests = operations.length;
        
        console.log('');
        console.log(`📈 RESULTADO: ${passedTests}/${totalTests} testes passaram`);
        
        if (passedTests === totalTests) {
            console.log('🎉 SUCESSO COMPLETO! Todas as operações CRUD estão funcionando');
            console.log('✅ O problema do deleteChat foi resolvido');
            console.log('✅ PostgreSQL está funcionando perfeitamente');
        } else {
            console.log('⚠️ ALGUNS TESTES FALHARAM');
            const failedOps = operations.filter(op => !op.status);
            console.log('❌ Operações com falha:');
            failedOps.forEach(op => {
                console.log(`   - ${op.name}: ${op.description}`);
            });
        }

        // Get final stats
        try {
            const statsResponse = await makeRequest(`${SERVER_URL}/api/stats`);
            if (statsResponse.status === 200) {
                console.log('');
                console.log('📊 ESTATÍSTICAS FINAIS:');
                console.log(`   Total de chats: ${statsResponse.data.total_chats}`);
                console.log(`   Total de mensagens: ${statsResponse.data.total_messages}`);
                console.log(`   Tipo de servidor: ${statsResponse.data.server_type}`);
            }
        } catch (error) {
            console.log('⚠️ Não foi possível obter estatísticas finais');
        }

        return passedTests === totalTests;

    } catch (error) {
        console.error('❌ ERRO FATAL NO TESTE:', error.message);
        console.error('');
        console.error('🔍 Possíveis causas:');
        console.error('   - Servidor não está respondendo');
        console.error('   - Problemas de conectividade');
        console.error('   - Erro no código da aplicação');
        return false;
    }
}

if (require.main === module) {
    testCRUDOperations().then(success => {
        process.exit(success ? 0 : 1);
    });
}

module.exports = { testCRUDOperations };
