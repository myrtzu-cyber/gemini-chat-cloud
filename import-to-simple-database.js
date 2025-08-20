#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

console.log('🔄 Importando dados para SimpleDatabase...');

// Carregar dados do export
const exportFile = './database_export_20250819_202738.json';
if (!fs.existsSync(exportFile)) {
    console.error('❌ Arquivo de export não encontrado:', exportFile);
    process.exit(1);
}

const exportData = JSON.parse(fs.readFileSync(exportFile, 'utf8'));
console.log(`📊 Dados carregados: ${exportData.chats.length} chats`);

// Converter dados para formato SimpleDatabase
const simpleDbData = {
    chats: [],
    messages: [],
    lastSaved: new Date().toISOString()
};

// Processar chats
for (const chat of exportData.chats) {
    console.log(`📝 Processando chat: "${chat.title}" (${chat.id})`);
    
    // Adicionar chat
    const chatData = {
        id: chat.id,
        title: chat.title,
        model: chat.model,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        context: null // Será preenchido quando necessário
    };
    simpleDbData.chats.push(chatData);
    
    // Adicionar mensagens
    for (const message of chat.messages) {
        const messageData = {
            id: message.id,
            chat_id: chat.id,
            sender: message.sender,
            content: message.content,
            files: JSON.stringify(message.files || []),
            created_at: new Date().toISOString()
        };
        simpleDbData.messages.push(messageData);
    }
    
    console.log(`✅ Chat "${chat.title}": ${chat.messages.length} mensagens processadas`);
}

// Salvar dados para SimpleDatabase
const outputFile = './backend/simple-db-data.json';
fs.writeFileSync(outputFile, JSON.stringify(simpleDbData, null, 2));

console.log(`💾 Dados salvos em: ${outputFile}`);
console.log(`📊 Total: ${simpleDbData.chats.length} chats, ${simpleDbData.messages.length} mensagens`);
console.log('✅ Importação concluída!');
