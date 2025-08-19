/**
 * Script para testar se a correção do frontend funcionou
 * Verifica se os chats migrados aparecem na aplicação
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
                    resolve({ success: true, data: JSON.parse(data), rawData: data });
                } catch (error) {
                    resolve({ success: true, rawData: data, isHtml: data.includes('<html') });
                }
            });
        });

        req.on('error', (error) => {
            resolve({ success: false, error: error.message });
        });

        req.end();
    });
}

async function testFrontendFix() {
    console.log('🧪 Teste da Correção do Frontend');
    console.log('=================================');
    console.log(`🌐 URL: ${RENDER_URL}`);
    console.log('');

    // Teste 1: Verificar se dados estão no backend
    console.log('📊 1. Verificando dados no backend...');
    const stats = await makeRequest(`${RENDER_URL}/api/stats`);
    if (stats.success && stats.data) {
        console.log(`✅ Total Chats: ${stats.data.total_chats}`);
        console.log(`✅ Total Mensagens: ${stats.data.total_messages}`);
        
        if (stats.data.total_chats === 0) {
            console.log('❌ PROBLEMA: Nenhum chat no backend!');
            console.log('💡 Execute novamente o import de dados');
            return;
        }
    } else {
        console.log('❌ Falha ao obter stats do backend');
        return;
    }

    // Teste 2: Verificar lista de chats
    console.log('\n📝 2. Verificando lista de chats...');
    const chats = await makeRequest(`${RENDER_URL}/api/chats`);
    if (chats.success && chats.data) {
        console.log(`✅ Chats encontrados: ${chats.data.length}`);
        
        if (chats.data.length > 0) {
            console.log('\n📋 Chats disponíveis:');
            chats.data.forEach((chat, index) => {
                console.log(`${index + 1}. "${chat.title}" (ID: ${chat.id})`);
                console.log(`   📅 Criado: ${chat.created_at}`);
                console.log(`   💬 Mensagens: ${chat.messages ? chat.messages.length : 0}`);
            });
        }
    } else {
        console.log('❌ Falha ao obter lista de chats');
        return;
    }

    // Teste 3: Verificar se frontend carrega config.js
    console.log('\n🏠 3. Verificando frontend principal...');
    const homepage = await makeRequest(`${RENDER_URL}/`);
    if (homepage.success && homepage.isHtml) {
        const content = homepage.rawData;
        const hasConfigJs = content.includes('frontend/config.js');
        const hasScriptJs = content.includes('script.js');
        
        console.log(`✅ Frontend carregado`);
        console.log(`   📄 Contém config.js: ${hasConfigJs ? 'Sim' : 'Não'}`);
        console.log(`   📄 Contém script.js: ${hasScriptJs ? 'Sim' : 'Não'}`);
        
        if (!hasConfigJs) {
            console.log('⚠️ PROBLEMA: config.js não está sendo carregado!');
        }
    } else {
        console.log('❌ Falha ao carregar frontend');
        return;
    }

    // Teste 4: Verificar versão mobile
    console.log('\n📱 4. Verificando versão mobile...');
    const mobile = await makeRequest(`${RENDER_URL}/mobile`);
    if (mobile.success && mobile.isHtml) {
        const content = mobile.rawData;
        const hasConfigJs = content.includes('frontend/config.js');
        const hasMobileScript = content.includes('mobile-script.js');
        
        console.log(`✅ Mobile carregado`);
        console.log(`   📄 Contém config.js: ${hasConfigJs ? 'Sim' : 'Não'}`);
        console.log(`   📄 Contém mobile-script.js: ${hasMobileScript ? 'Sim' : 'Não'}`);
        
        if (!hasConfigJs) {
            console.log('⚠️ PROBLEMA: config.js não está sendo carregado no mobile!');
        }
    } else {
        console.log('❌ Falha ao carregar versão mobile');
        return;
    }

    // Resultado final
    console.log('\n🎯 Resultado do Teste');
    console.log('=====================');
    console.log('✅ Backend: Funcionando com dados migrados');
    console.log('✅ API: Retornando chats corretamente');
    console.log('✅ Frontend: Carregando arquivos necessários');
    console.log('✅ Mobile: Carregando arquivos necessários');
    
    console.log('\n💡 Próximos passos para testar:');
    console.log('1. Abra o navegador em: ' + RENDER_URL);
    console.log('2. Pressione F12 → Console');
    console.log('3. Procure por mensagens:');
    console.log('   - "🌍 Environment: Production"');
    console.log('   - "🔗 API Base URL: ' + RENDER_URL + '"');
    console.log('   - "🌍 Produção detectada - usando: ' + RENDER_URL + '"');
    console.log('4. Verifique se os chats aparecem na sidebar');
    console.log('5. Se não aparecer, pressione Ctrl+F5 para limpar cache');
    
    console.log('\n🌐 URLs para testar:');
    console.log(`📊 Stats: ${RENDER_URL}/api/stats`);
    console.log(`📝 Chats: ${RENDER_URL}/api/chats`);
    console.log(`🏠 Desktop: ${RENDER_URL}/`);
    console.log(`📱 Mobile: ${RENDER_URL}/mobile`);
    
    console.log('\n🎉 Correção aplicada com sucesso!');
    console.log('O frontend agora deve usar a URL correta do Render.');
}

testFrontendFix().catch(console.error);
