#!/usr/bin/env python3
import json
import sys

def escape_sql_string(text):
    """Escapar aspas simples para SQL"""
    if text is None:
        return 'NULL'
    return "'" + str(text).replace("'", "''") + "'"

def generate_migration_sql():
    """Gerar SQL completo de migração"""
    
    # Ler dados do arquivo JSON
    try:
        with open('migration-export.json', 'r', encoding='utf-8') as f:
            data = json.load(f)
    except Exception as e:
        print(f"Erro ao ler arquivo: {e}")
        return
    
    # Início do SQL
    sql = """-- Migração completa para PostgreSQL Render
-- Database: gemini_chat
-- Data: 2025-08-21

-- Remover dados existentes (se necessário)
DELETE FROM messages WHERE chat_id = 'b9xzyx67w';
DELETE FROM chats WHERE id = 'b9xzyx67w';

-- Criar tabelas (caso não existam)
CREATE TABLE IF NOT EXISTS chats (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    model TEXT DEFAULT 'gemini-2.5-pro',
    messages JSONB DEFAULT '[]',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS messages (
    id SERIAL PRIMARY KEY,
    chat_id TEXT REFERENCES chats(id) ON DELETE CASCADE,
    role TEXT NOT NULL,
    content TEXT NOT NULL,
    message_type TEXT DEFAULT 'text',
    file_info JSONB,
    status TEXT DEFAULT 'sent',
    retry_count INTEGER DEFAULT 0,
    error_message TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

"""
    
    # Inserir chats
    sql += "-- Inserir chats\n"
    for chat in data.get('chats', []):
        sql += f"""INSERT INTO chats (id, title, model, messages, created_at, updated_at) 
VALUES (
    {escape_sql_string(chat.get('id'))},
    {escape_sql_string(chat.get('title', 'Conversa Sem Título'))},
    {escape_sql_string(chat.get('model', 'gemini-2.5-pro'))},
    '[]',
    {escape_sql_string(chat.get('created_at'))},
    {escape_sql_string(chat.get('updated_at'))}
) ON CONFLICT (id) DO UPDATE SET
    title = EXCLUDED.title,
    model = EXCLUDED.model,
    updated_at = EXCLUDED.updated_at;

"""
    
    # Inserir mensagens
    sql += "-- Inserir mensagens\n"
    messages = data.get('messages', [])
    print(f"Total de mensagens a migrar: {len(messages)}")
    
    if messages:
        sql += "INSERT INTO messages (chat_id, role, content, created_at) VALUES\n"
        
        message_values = []
        for msg in messages:
            # Converter 'sender' para 'role' (user/assistant -> user/model)
            role = msg.get('sender', 'user')
            if role == 'assistant':
                role = 'model'
            
            chat_id = escape_sql_string(msg.get('chat_id'))
            role_escaped = escape_sql_string(role)
            content_escaped = escape_sql_string(msg.get('content', ''))
            created_at = escape_sql_string(msg.get('created_at'))
            
            message_values.append(f"({chat_id}, {role_escaped}, {content_escaped}, {created_at})")
        
        sql += ",\n".join(message_values) + ";\n\n"
    
    # Verificações finais
    sql += """-- Verificar dados inseridos
SELECT 'CHATS INSERIDOS:' as info;
SELECT id, title, model, created_at FROM chats WHERE id = 'b9xzyx67w';

SELECT 'MENSAGENS INSERIDAS:' as info;
SELECT chat_id, role, LEFT(content, 50) as content_preview, created_at 
FROM messages 
WHERE chat_id = 'b9xzyx67w' 
ORDER BY created_at;

SELECT 'TOTAL DE MENSAGENS:' as info;
SELECT COUNT(*) as total_messages FROM messages WHERE chat_id = 'b9xzyx67w';
"""
    
    # Salvar SQL
    with open('complete-migration.sql', 'w', encoding='utf-8') as f:
        f.write(sql)
    
    print("✅ Arquivo complete-migration.sql gerado com sucesso!")
    print(f"📊 Dados processados:")
    print(f"   - Chats: {len(data.get('chats', []))}")
    print(f"   - Mensagens: {len(messages)}")

if __name__ == "__main__":
    generate_migration_sql()
