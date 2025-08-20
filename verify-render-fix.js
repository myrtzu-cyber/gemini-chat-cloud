#!/usr/bin/env node
/**
 * Verify Render Fix
 * Checks if the Render configuration fixes resolved the pg module issue
 */

const https = require('https');

const SERVER_URL = 'https://gemini-chat-cloud.onrender.com';

function makeRequest(url) {
    return new Promise((resolve, reject) => {
        const req = https.request(url, { rejectUnauthorized: false }, (res) => {
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
        req.end();
    });
}

async function verifyRenderFix() {
    console.log('🔍 Verificando se o fix do Render funcionou');
    console.log(`📍 Server: ${SERVER_URL}`);
    console.log('');

    try {
        // Check debug endpoint
        console.log('1️⃣ Verificando endpoint de debug...');
        const debugResponse = await makeRequest(`${SERVER_URL}/api/debug/database`);
        
        if (debugResponse.status === 200) {
            console.log('✅ Debug endpoint respondeu com sucesso');
            
            const debug = debugResponse.data;
            const info = debug.database_info;
            
            console.log('');
            console.log('📊 RESULTADOS DO DEBUG:');
            console.log(`🔧 Tipo de Database: ${info.type}`);
            console.log(`📊 Server Type: ${info.server_type}`);
            console.log(`🐘 Módulo pg disponível: ${info.pg_module_available ? '✅ SIM' : '❌ NÃO'}`);
            
            if (info.pg_module_error) {
                console.log(`❌ Erro do módulo pg: ${info.pg_module_error}`);
            }
            
            console.log(`🔗 DATABASE_URL configurado: ${info.database_url_configured ? '✅ SIM' : '❌ NÃO'}`);
            console.log(`📏 Tamanho da DATABASE_URL: ${info.database_url_length} caracteres`);
            console.log(`🖥️ Versão do Node.js: ${info.node_version}`);
            console.log(`🖥️ Plataforma: ${info.platform}`);
            
            console.log('');
            console.log('📈 ESTATÍSTICAS:');
            console.log(`   Total de chats: ${debug.stats.total_chats}`);
            console.log(`   Total de mensagens: ${debug.stats.total_messages}`);
            console.log(`   Tipo de servidor: ${debug.stats.server_type}`);
            
            console.log('');
            console.log('🔍 ANÁLISE:');
            
            if (info.type === 'PostgresDatabase') {
                console.log('🎉 SUCESSO! PostgreSQL está sendo usado!');
                console.log('✅ O problema de persistência de dados foi resolvido');
                console.log('✅ Os dados agora persistirão entre redeployments');
                
                // Test persistence
                console.log('');
                console.log('2️⃣ Testando persistência de dados...');
                await testDataPersistence();
                
            } else if (info.pg_module_available) {
                console.log('⚠️ Módulo pg está disponível, mas PostgreSQL não está sendo usado');
                console.log('🔍 Possível problema na inicialização do PostgreSQL');
                console.log('💡 Verifique os logs do servidor para erros de conexão');
                
            } else {
                console.log('❌ PROBLEMA AINDA EXISTE: Módulo pg não está disponível');
                console.log('');
                console.log('🔧 PRÓXIMOS PASSOS:');
                console.log('1. Verifique se o Build Command foi atualizado no Render Dashboard');
                console.log('2. Confirme que o comando é: npm install --verbose && npm rebuild pg --verbose');
                console.log('3. Trigger um manual deploy após fazer as mudanças');
                console.log('4. Monitore os logs de build para ver se o pg está sendo instalado');
                
                if (info.pg_module_error) {
                    console.log('');
                    console.log('📍 Erro específico do módulo pg:');
                    console.log(`   ${info.pg_module_error}`);
                }
            }
            
        } else {
            console.log(`❌ Debug endpoint falhou: HTTP ${debugResponse.status}`);
            console.log(`Resposta: ${JSON.stringify(debugResponse.data)}`);
        }
        
    } catch (error) {
        console.error('❌ Erro ao verificar o fix:', error.message);
    }
}

async function testDataPersistence() {
    try {
        // Create a test chat
        const testChatId = `persistence_test_${Date.now()}`;
        
        const createResponse = await makeRequest(`${SERVER_URL}/api/chats`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                id: testChatId,
                title: 'Teste de Persistência PostgreSQL',
                model: 'gemini-pro',
                messages: [{
                    id: `msg_${Date.now()}`,
                    sender: 'user',
                    content: 'Esta mensagem deve persistir no PostgreSQL'
                }]
            })
        });

        if (createResponse.status === 200 || createResponse.status === 201) {
            console.log('✅ Chat de teste criado com sucesso');
            console.log(`   ID do chat: ${testChatId}`);
            
            // Retrieve the chat
            const getResponse = await makeRequest(`${SERVER_URL}/api/chats/${testChatId}`);
            
            if (getResponse.status === 200) {
                console.log('✅ Chat de teste recuperado com sucesso');
                console.log(`   Título: ${getResponse.data.title}`);
                console.log(`   Mensagens: ${getResponse.data.messages ? getResponse.data.messages.length : 0}`);
                console.log('');
                console.log('🎯 TESTE DE PERSISTÊNCIA CONCLUÍDO');
                console.log('💡 Para testar completamente, aguarde um redeploy e verifique se o chat ainda existe');
            } else {
                console.log('⚠️ Falha ao recuperar chat de teste');
            }
        } else {
            console.log('⚠️ Falha ao criar chat de teste');
        }
        
    } catch (error) {
        console.log('⚠️ Erro no teste de persistência:', error.message);
    }
}

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

if (require.main === module) {
    verifyRenderFix();
}

module.exports = { verifyRenderFix };
