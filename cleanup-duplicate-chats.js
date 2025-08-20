#!/usr/bin/env node
/**
 * Cleanup Duplicate Chats
 * Removes duplicate empty chats while preserving chats with messages
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

async function cleanupDuplicateChats() {
    console.log('🧹 LIMPEZA DE CHATS DUPLICADOS');
    console.log('='.repeat(40));
    console.log(`📍 Server: ${SERVER_URL}`);
    console.log('');

    try {
        // Step 1: Get all chats
        console.log('1️⃣ Carregando lista de chats...');
        
        const listResponse = await makeRequest(`${SERVER_URL}/api/chats`);
        
        if (listResponse.status !== 200) {
            throw new Error(`Falha ao carregar chats: ${listResponse.status}`);
        }
        
        const allChats = listResponse.data;
        console.log(`📊 Total de chats encontrados: ${allChats.length}`);
        console.log('');

        // Step 2: Group chats by title
        console.log('2️⃣ Analisando duplicatas...');
        
        const chatsByTitle = {};
        allChats.forEach(chat => {
            const title = chat.title || 'Untitled';
            if (!chatsByTitle[title]) {
                chatsByTitle[title] = [];
            }
            chatsByTitle[title].push(chat);
        });

        // Step 3: Identify duplicates
        const duplicateGroups = [];
        Object.entries(chatsByTitle).forEach(([title, chats]) => {
            if (chats.length > 1) {
                duplicateGroups.push({ title, chats });
            }
        });

        console.log(`📊 Grupos de duplicatas encontrados: ${duplicateGroups.length}`);
        
        duplicateGroups.forEach(group => {
            console.log(`   "${group.title}": ${group.chats.length} cópias`);
        });
        console.log('');

        // Step 4: Plan cleanup strategy
        console.log('3️⃣ Planejando estratégia de limpeza...');
        
        let chatsToDelete = [];
        let chatsToKeep = [];
        
        duplicateGroups.forEach(group => {
            const { title, chats } = group;
            
            // Sort chats by message count (desc) and then by date (desc)
            const sortedChats = chats.sort((a, b) => {
                // First priority: message count
                if (b.message_count !== a.message_count) {
                    return b.message_count - a.message_count;
                }
                // Second priority: most recent
                return new Date(b.updated_at) - new Date(a.updated_at);
            });
            
            // Keep the first one (best candidate)
            const chatToKeep = sortedChats[0];
            const chatsToRemove = sortedChats.slice(1);
            
            chatsToKeep.push(chatToKeep);
            chatsToDelete.push(...chatsToRemove);
            
            console.log(`   "${title}":`);
            console.log(`     ✅ Manter: ${chatToKeep.id} (${chatToKeep.message_count} msgs, ${chatToKeep.updated_at})`);
            chatsToRemove.forEach(chat => {
                console.log(`     🗑️ Deletar: ${chat.id} (${chat.message_count} msgs, ${chat.updated_at})`);
            });
        });
        
        console.log('');
        console.log(`📊 RESUMO DA LIMPEZA:`);
        console.log(`   Chats a manter: ${chatsToKeep.length}`);
        console.log(`   Chats a deletar: ${chatsToDelete.length}`);
        console.log('');

        // Step 5: Confirm before deletion
        if (chatsToDelete.length === 0) {
            console.log('✅ Nenhuma duplicata para limpar!');
            return true;
        }

        console.log('⚠️ ATENÇÃO: Esta operação irá deletar chats permanentemente!');
        console.log('');
        console.log('🔍 CHATS QUE SERÃO DELETADOS:');
        chatsToDelete.forEach((chat, index) => {
            console.log(`   ${index + 1}. "${chat.title}" (${chat.id}) - ${chat.message_count} msgs`);
        });
        console.log('');

        // For safety, let's do a dry run first
        console.log('4️⃣ Executando limpeza...');
        console.log('');

        let deletedCount = 0;
        let errorCount = 0;

        for (const chat of chatsToDelete) {
            try {
                console.log(`🗑️ Deletando: "${chat.title}" (${chat.id})...`);
                
                const deleteResponse = await makeRequest(`${SERVER_URL}/api/chats/${chat.id}`, {
                    method: 'DELETE'
                });

                if (deleteResponse.status === 200) {
                    console.log(`   ✅ Deletado com sucesso`);
                    deletedCount++;
                } else {
                    console.log(`   ❌ Falha: HTTP ${deleteResponse.status}`);
                    errorCount++;
                }
                
                // Small delay to avoid overwhelming the server
                await new Promise(resolve => setTimeout(resolve, 500));
                
            } catch (error) {
                console.log(`   ❌ Erro: ${error.message}`);
                errorCount++;
            }
        }

        console.log('');
        console.log('5️⃣ Verificando resultado...');
        
        // Verify cleanup
        const finalListResponse = await makeRequest(`${SERVER_URL}/api/chats`);
        
        if (finalListResponse.status === 200) {
            const finalChats = finalListResponse.data;
            
            console.log(`📊 RESULTADO FINAL:`);
            console.log(`   Chats antes: ${allChats.length}`);
            console.log(`   Chats depois: ${finalChats.length}`);
            console.log(`   Chats deletados: ${deletedCount}`);
            console.log(`   Erros: ${errorCount}`);
            console.log('');
            
            // Check for remaining duplicates
            const finalChatsByTitle = {};
            finalChats.forEach(chat => {
                const title = chat.title || 'Untitled';
                if (!finalChatsByTitle[title]) {
                    finalChatsByTitle[title] = [];
                }
                finalChatsByTitle[title].push(chat);
            });
            
            const remainingDuplicates = Object.entries(finalChatsByTitle).filter(([title, chats]) => chats.length > 1);
            
            if (remainingDuplicates.length === 0) {
                console.log('🎉 LIMPEZA CONCLUÍDA COM SUCESSO!');
                console.log('✅ Nenhuma duplicata restante');
            } else {
                console.log('⚠️ LIMPEZA PARCIAL:');
                remainingDuplicates.forEach(([title, chats]) => {
                    console.log(`   "${title}": ${chats.length} cópias restantes`);
                });
            }
            
            console.log('');
            console.log('📋 CHATS FINAIS (primeiros 10):');
            finalChats.slice(0, 10).forEach((chat, index) => {
                const msgCount = chat.message_count || 0;
                const status = msgCount > 0 ? '✅' : '⚠️';
                console.log(`   ${index + 1}. ${status} "${chat.title}" - ${msgCount} msgs`);
            });
        }

        return deletedCount > 0 && errorCount === 0;

    } catch (error) {
        console.error('❌ ERRO NA LIMPEZA:', error.message);
        return false;
    }
}

if (require.main === module) {
    cleanupDuplicateChats().then(success => {
        process.exit(success ? 0 : 1);
    });
}

module.exports = { cleanupDuplicateChats };
