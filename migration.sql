-- Migração de dados para PostgreSQL

-- Criar tabelas
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

-- Inserir chats
INSERT INTO chats (id, title, model, messages) VALUES (
    'b9xzyx67w',
    'Mestre',
    'gemini-2.5-pro',
    '[]'
) ON CONFLICT (id) DO NOTHING;

-- Migração concluída
