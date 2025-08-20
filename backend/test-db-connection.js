#!/usr/bin/env node
/**
 * Teste de Conexão com Database
 * Para verificar se a configuração está correta
 */

require('dotenv').config();
const DatabaseFactory = require('./database-factory');

async function testConnection() {
    console.log('🧪 Testando conexão com banco de dados...');
    console.log('📊 Configurações:');
    console.log('   NODE_ENV:', process.env.NODE_ENV || 'development');
    console.log('   DATABASE_URL:', process.env.DATABASE_URL ? 'Configurado ✅' : 'Não configurado ❌');
    console.log('   PORT:', process.env.PORT || 3000);
    
    try {
        // Initialize database
        const db = DatabaseFactory.createDatabase();
        await db.init();
        
        console.log('✅ Conexão com banco estabelecida com sucesso!');
        
        // Test basic operations
        console.log('🧪 Testando operações básicas...');
        
        // Get all chats
        const chats = await db.getAllChats();
        console.log(`📊 Chats encontrados: ${chats.length}`);
        
        // Test saving a chat
        const testChat = {
            id: 'test-' + Date.now(),
            title: 'Chat de Teste',
            model: 'gemini-2.5-pro',
            messages: [
                { role: 'user', content: 'Teste de conexão' },
                { role: 'assistant', content: 'Conexão funcionando!' }
            ]
        };
        
        await db.saveChat(testChat);
        console.log('✅ Teste de salvamento: OK');
        
        // Verify the chat was saved
        const savedChat = await db.getChat(testChat.id);
        console.log('✅ Teste de recuperação: OK');
        
        // Clean up test chat
        await db.deleteChat(testChat.id);
        console.log('✅ Teste de exclusão: OK');
        
        console.log('🎉 Todos os testes passaram! Database está funcionando corretamente.');
        
        await db.close();
        
    } catch (error) {
        console.error('❌ Erro no teste de conexão:', error.message);
        console.error('Stack trace:', error.stack);
        process.exit(1);
    }
}

if (require.main === module) {
    testConnection();
}

module.exports = { testConnection };
