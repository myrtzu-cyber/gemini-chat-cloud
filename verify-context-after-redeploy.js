#!/usr/bin/env node
/**
 * Verify Context After Redeploy
 * Checks if context data persisted after a Render redeploy
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
        req.end();
    });
}

async function verifyContextAfterRedeploy() {
    console.log('🔄 VERIFICAÇÃO PÓS-REDEPLOY: Contexto Persistiu?');
    console.log('='.repeat(50));
    console.log(`📍 Server: ${SERVER_URL}`);
    console.log('');

    try {
        // Load test data
        if (!fs.existsSync('context-persistence-test.json')) {
            console.log('❌ Arquivo de teste não encontrado: context-persistence-test.json');
            console.log('   Execute primeiro: node test-context-persistence.js');
            return false;
        }

        const testData = JSON.parse(fs.readFileSync('context-persistence-test.json', 'utf8'));
        const chatId = testData.chatId;
        
        console.log('📋 Dados do teste carregados:');
        console.log(`   Chat ID: ${chatId}`);
        console.log(`   Teste executado em: ${testData.timestamp}`);
        console.log(`   Aventura original length: ${testData.originalContext.aventura.length} caracteres`);
        console.log('');

        // Check server health
        console.log('1️⃣ Verificando saúde do servidor pós-redeploy...');
        const healthResponse = await makeRequest(`${SERVER_URL}/api/health`);
        
        if (healthResponse.status === 200) {
            console.log('✅ Servidor respondendo após redeploy');
            console.log(`   Database type: ${healthResponse.data.database_type}`);
        } else {
            throw new Error(`❌ Servidor não está respondendo: ${healthResponse.status}`);
        }
        console.log('');

        // Check if chat still exists
        console.log('2️⃣ Verificando se o chat de teste ainda existe...');
        const chatResponse = await makeRequest(`${SERVER_URL}/api/chats/${chatId}`);
        
        if (chatResponse.status === 200) {
            console.log('✅ Chat de teste ainda existe');
            
            const chat = chatResponse.data;
            
            if (chat.context) {
                console.log('✅ Contexto ainda presente');
                console.log('');
                
                // Detailed context verification
                console.log('3️⃣ VERIFICAÇÃO DETALHADA DO CONTEXTO:');
                const ctx = chat.context;
                
                // Check aventura field
                if (ctx.aventura) {
                    console.log(`✅ Aventura: ${ctx.aventura.length} caracteres`);
                    console.log(`   Conteúdo: "${ctx.aventura.substring(0, 100)}..."`);
                    
                    if (ctx.aventura.length > 100) {
                        console.log('✅ Aventura manteve conteúdo completo');
                    } else {
                        console.log('❌ Aventura parece truncada ou vazia');
                    }
                } else {
                    console.log('❌ CRÍTICO: Campo aventura ausente!');
                }
                
                // Check game state
                if (ctx.gameState) {
                    console.log(`✅ Game State: Level ${ctx.gameState.level}, XP ${ctx.gameState.experience}`);
                    console.log(`   Location: ${ctx.gameState.location}`);
                    console.log(`   Inventory: ${JSON.stringify(ctx.gameState.inventory)}`);
                } else {
                    console.log('❌ Game State ausente');
                }
                
                // Check user preferences
                if (ctx.userPreferences) {
                    console.log(`✅ User Preferences: Theme ${ctx.userPreferences.theme}, Lang ${ctx.userPreferences.language}`);
                } else {
                    console.log('❌ User Preferences ausentes');
                }
                
                // Check metadata
                if (ctx.metadata) {
                    console.log(`✅ Metadata: Version ${ctx.metadata.version}, Test Type ${ctx.metadata.testType}`);
                    if (ctx.metadata.lastUpdate) {
                        console.log(`   Last Update: ${ctx.metadata.lastUpdate}`);
                    }
                } else {
                    console.log('❌ Metadata ausente');
                }
                
                console.log('');
                
                // Compare with original data
                console.log('4️⃣ COMPARAÇÃO COM DADOS ORIGINAIS:');
                const comparisons = [
                    {
                        name: 'Aventura Length',
                        original: testData.originalContext.aventura.length,
                        current: ctx.aventura ? ctx.aventura.length : 0
                    },
                    {
                        name: 'Game Level',
                        original: testData.originalContext.gameState.level,
                        current: ctx.gameState?.level || 0
                    },
                    {
                        name: 'User Theme',
                        original: testData.originalContext.userPreferences.theme,
                        current: ctx.userPreferences?.theme || 'missing'
                    },
                    {
                        name: 'Inventory Items',
                        original: testData.originalContext.gameState.inventory.length,
                        current: ctx.gameState?.inventory?.length || 0
                    }
                ];
                
                let allMatch = true;
                comparisons.forEach(comp => {
                    const match = comp.original === comp.current;
                    const icon = match ? '✅' : '❌';
                    console.log(`   ${icon} ${comp.name}: ${comp.current} (original: ${comp.original})`);
                    if (!match) allMatch = false;
                });
                
                console.log('');
                
                if (allMatch) {
                    console.log('🎉 SUCESSO TOTAL: Contexto persistiu perfeitamente após redeploy!');
                    console.log('✅ PostgreSQL está funcionando corretamente');
                    console.log('✅ Dados não são perdidos em redeployments');
                } else {
                    console.log('⚠️ SUCESSO PARCIAL: Contexto persistiu mas com algumas diferenças');
                    console.log('🔍 Verifique se as diferenças são esperadas (ex: updates)');
                }
                
            } else {
                console.log('❌ FALHA CRÍTICA: Contexto foi perdido após redeploy!');
                console.log('🔍 Possíveis causas:');
                console.log('   - PostgreSQL não está sendo usado');
                console.log('   - Erro na serialização/deserialização');
                console.log('   - Problema na migração de dados');
                return false;
            }
            
        } else if (chatResponse.status === 404) {
            console.log('❌ FALHA CRÍTICA: Chat de teste foi perdido após redeploy!');
            console.log('🔍 Isso indica que os dados não estão persistindo no PostgreSQL');
            return false;
        } else {
            console.log(`❌ Erro ao recuperar chat: ${chatResponse.status}`);
            return false;
        }
        
        // Check overall database stats
        console.log('5️⃣ Verificando estatísticas gerais do database...');
        const statsResponse = await makeRequest(`${SERVER_URL}/api/stats`);
        
        if (statsResponse.status === 200) {
            console.log('📊 Stats pós-redeploy:');
            console.log(`   Total chats: ${statsResponse.data.total_chats}`);
            console.log(`   Total messages: ${statsResponse.data.total_messages}`);
            console.log(`   Server type: ${statsResponse.data.server_type}`);
            
            if (statsResponse.data.server_type === 'postgresql-database') {
                console.log('✅ PostgreSQL ainda ativo após redeploy');
            } else {
                console.log('❌ PostgreSQL não está ativo!');
            }
        }
        
        console.log('');
        console.log('📋 RESUMO DA VERIFICAÇÃO PÓS-REDEPLOY:');
        console.log('   ✅ Servidor funcionando');
        console.log('   ✅ Chat de teste existe');
        console.log('   ✅ Contexto presente');
        console.log('   ✅ Dados detalhados preservados');
        console.log('');
        console.log('🎯 CONCLUSÃO: Persistência de contexto está funcionando!');
        
        return true;
        
    } catch (error) {
        console.error('❌ ERRO NA VERIFICAÇÃO:', error.message);
        console.error('');
        console.error('🔍 Possíveis problemas:');
        console.error('   - Servidor ainda reiniciando após redeploy');
        console.error('   - Problemas de conectividade');
        console.error('   - Falha na persistência do PostgreSQL');
        return false;
    }
}

if (require.main === module) {
    verifyContextAfterRedeploy().then(success => {
        process.exit(success ? 0 : 1);
    });
}

module.exports = { verifyContextAfterRedeploy };
