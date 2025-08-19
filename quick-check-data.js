/**
 * Verificação rápida se dados estão no backend
 */

const https = require('https');
process.env["NODE_TLS_REJECT_UNAUTHORIZED"] = 0;

const httpsAgent = new https.Agent({
    rejectUnauthorized: false,
    secureProtocol: 'TLSv1_2_method'
});

const RENDER_URL = process.argv[2] || 'https://gemini-chat-cloud.onrender.com';

function makeRequest(url) {
    return new Promise((resolve) => {
        const urlObj = new URL(url);
        const options = {
            hostname: urlObj.hostname,
            port: 443,
            path: urlObj.pathname,
            method: 'GET',
            agent: httpsAgent,
            rejectUnauthorized: false
        };

        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    resolve({ success: true, data: JSON.parse(data) });
                } catch (error) {
                    resolve({ success: false, error: 'Invalid JSON' });
                }
            });
        });

        req.on('error', (error) => {
            resolve({ success: false, error: error.message });
        });

        req.end();
    });
}

async function quickCheck() {
    console.log('🔍 Verificação Rápida de Dados');
    console.log('==============================');
    console.log(`🌐 URL: ${RENDER_URL}`);
    console.log('');

    // Stats
    console.log('📊 Verificando Stats...');
    const stats = await makeRequest(`${RENDER_URL}/api/stats`);
    if (stats.success) {
        console.log(`✅ Total Chats: ${stats.data.total_chats}`);
        console.log(`✅ Total Mensagens: ${stats.data.total_messages}`);
        console.log(`✅ Server Type: ${stats.data.server_type}`);
    } else {
        console.log(`❌ Erro: ${stats.error}`);
        return;
    }

    // Chats
    console.log('\n📝 Verificando Lista de Chats...');
    const chats = await makeRequest(`${RENDER_URL}/api/chats`);
    if (chats.success) {
        console.log(`✅ Quantidade de chats: ${chats.data.length}`);
        
        if (chats.data.length > 0) {
            console.log('\n📋 Chats encontrados:');
            chats.data.forEach((chat, index) => {
                console.log(`${index + 1}. ${chat.title} (ID: ${chat.id})`);
                console.log(`   Mensagens: ${chat.messages ? chat.messages.length : 0}`);
                console.log(`   Criado: ${chat.created_at}`);
            });
            
            console.log('\n🎉 DADOS ESTÃO NO BACKEND!');
            console.log('💡 Se não aparecem no frontend:');
            console.log('1. Limpe cache do navegador (Ctrl+F5)');
            console.log('2. Verifique console do navegador (F12)');
            console.log('3. Teste em aba anônima');
        } else {
            console.log('❌ Nenhum chat encontrado!');
            console.log('💡 Execute novamente o import de dados');
        }
    } else {
        console.log(`❌ Erro: ${chats.error}`);
    }
}

quickCheck().catch(console.error);
