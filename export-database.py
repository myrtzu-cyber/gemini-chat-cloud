#!/usr/bin/env python3
"""
Script para exportar dados do database local para JSON
Usado para migração para cloud deployment
"""

import sqlite3
import json
import os
from datetime import datetime

def export_sqlite_to_json():
    """Exporta dados do SQLite para JSON"""
    
    # Verificar se database existe
    db_path = 'database/chats.db'
    if not os.path.exists(db_path):
        print("❌ Database SQLite não encontrado em:", db_path)
        print("ℹ️  Criando export vazio...")
        return create_empty_export()
    
    try:
        # Conectar ao database
        conn = sqlite3.connect(db_path)
        conn.row_factory = sqlite3.Row  # Para acessar colunas por nome
        cursor = conn.cursor()
        
        # Exportar chats
        cursor.execute("SELECT * FROM chats ORDER BY created_at")
        chats = []
        for row in cursor.fetchall():
            chat = {
                'id': row['id'],
                'title': row['title'],
                'model': row['model'],
                'messages': json.loads(row['messages']) if row['messages'] else [],
                'created_at': row['created_at'],
                'updated_at': row['updated_at']
            }
            chats.append(chat)
        
        # Exportar mensagens (se tabela existir)
        messages = []
        try:
            cursor.execute("SELECT * FROM messages ORDER BY timestamp")
            for row in cursor.fetchall():
                message = {
                    'id': row['id'],
                    'chat_id': row['chat_id'],
                    'role': row['role'],
                    'content': row['content'],
                    'timestamp': row['timestamp']
                }
                messages.append(message)
        except sqlite3.OperationalError:
            print("ℹ️  Tabela messages não existe, usando apenas chats")
        
        conn.close()
        
        # Criar export
        export_data = {
            'export_info': {
                'timestamp': datetime.now().isoformat(),
                'source': 'sqlite',
                'database_path': db_path,
                'total_chats': len(chats),
                'total_messages': len(messages)
            },
            'chats': chats,
            'messages': messages
        }
        
        # Salvar JSON
        export_file = f'database_export_{datetime.now().strftime("%Y%m%d_%H%M%S")}.json'
        with open(export_file, 'w', encoding='utf-8') as f:
            json.dump(export_data, f, indent=2, ensure_ascii=False)
        
        print(f"✅ Export concluído: {export_file}")
        print(f"📊 Chats exportados: {len(chats)}")
        print(f"📊 Mensagens exportadas: {len(messages)}")
        
        return export_file
        
    except Exception as e:
        print(f"❌ Erro ao exportar database: {e}")
        return None

def create_empty_export():
    """Cria export vazio para inicialização"""
    export_data = {
        'export_info': {
            'timestamp': datetime.now().isoformat(),
            'source': 'empty',
            'database_path': 'none',
            'total_chats': 0,
            'total_messages': 0
        },
        'chats': [],
        'messages': []
    }
    
    export_file = f'database_export_empty_{datetime.now().strftime("%Y%m%d_%H%M%S")}.json'
    with open(export_file, 'w', encoding='utf-8') as f:
        json.dump(export_data, f, indent=2, ensure_ascii=False)
    
    print(f"✅ Export vazio criado: {export_file}")
    return export_file

def export_memory_to_json():
    """Simula export de dados em memória (para Node.js)"""
    print("ℹ️  Para exportar dados do Node.js minimal:")
    print("1. Acesse: http://localhost:3000/api/chats")
    print("2. Copie o JSON retornado")
    print("3. Salve em arquivo: chats_export.json")
    
    # Criar template
    template = {
        'export_info': {
            'timestamp': datetime.now().isoformat(),
            'source': 'nodejs_minimal',
            'database_path': 'memory',
            'total_chats': 0,
            'total_messages': 0,
            'note': 'Dados em memória - copie de /api/chats'
        },
        'chats': [],
        'messages': []
    }
    
    template_file = 'nodejs_export_template.json'
    with open(template_file, 'w', encoding='utf-8') as f:
        json.dump(template, f, indent=2, ensure_ascii=False)
    
    print(f"✅ Template criado: {template_file}")
    return template_file

if __name__ == "__main__":
    print("🗄️ Export de Database - Gemini Chat")
    print("=" * 40)
    
    # Verificar qual tipo de database existe
    if os.path.exists('database/chats.db'):
        print("📁 Database SQLite encontrado")
        export_sqlite_to_json()
    else:
        print("📁 Database SQLite não encontrado")
        print("ℹ️  Criando exports alternativos...")
        create_empty_export()
        export_memory_to_json()
    
    print("\n🎯 Próximos passos:")
    print("1. Use o arquivo JSON gerado para importar na cloud")
    print("2. Configure o database na plataforma cloud")
    print("3. Execute o script de import no servidor cloud")
