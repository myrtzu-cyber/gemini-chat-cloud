#!/usr/bin/env python3
import json
import urllib.request
import urllib.parse

def send_complete_chat(app_url, chat_data):
    """Enviar chat completo com todas as mensagens"""
    url = f"{app_url}/api/chats"
    
    print(f"🚀 Enviando chat completo...")
    print(f"   ID: {chat_data.get('id')}")
    print(f"   Título: {chat_data.get('title')}")
    print(f"   Mensagens: {len(chat_data.get('messages', []))}")
    
    # Preparar dados
    data = json.dumps(chat_data).encode('utf-8')
    
    # Preparar request
    req = urllib.request.Request(url, data=data)
    req.add_header('Content-Type', 'application/json')
    
    try:
        with urllib.request.urlopen(req) as response:
            result = json.loads(response.read().decode('utf-8'))
            return True, result
    except Exception as e:
        return False, str(e)

def main():
    app_url = "https://gemini-chat-cloud.onrender.com"
    
    print("🔄 IMPORTAÇÃO CORRETA - CHAT COMPLETO COM MENSAGENS")
    print("==================================================")
    print()
    
    # Ler dados
    try:
        with open('migration-export.json', 'r', encoding='utf-8') as f:
            data = json.load(f)
    except Exception as e:
        print(f"❌ Erro ao ler arquivo: {e}")
        return
    
    chats = data.get('chats', [])
    all_messages = data.get('messages', [])
    
    print(f"📊 Dados encontrados:")
    print(f"   - Chats: {len(chats)}")
    print(f"   - Mensagens totais: {len(all_messages)}")
    print()
    
    # Processar cada chat
    for chat in chats:
        chat_id = chat.get('id')
        print(f"📝 Processando chat: {chat.get('title')} ({chat_id})")
        
        # Buscar mensagens deste chat
        chat_messages = [msg for msg in all_messages if msg.get('chat_id') == chat_id]
        print(f"   📨 Mensagens encontradas: {len(chat_messages)}")
        
        # Converter mensagens para o formato correto
        formatted_messages = []
        for msg in chat_messages:
            # Converter sender para role
            role = msg.get('sender', 'user')
            if role == 'assistant':
                role = 'model'
            
            formatted_msg = {
                "id": msg.get('id'),
                "sender": role,  # O backend espera 'sender', não 'role'
                "content": msg.get('content', ''),
                "files": [],
                "timestamp": msg.get('created_at'),
                "status": "sent"
            }
            formatted_messages.append(formatted_msg)
        
        # Criar dados completos do chat
        complete_chat_data = {
            "id": chat_id,
            "title": chat.get('title', 'Conversa Sem Título'),
            "model": chat.get('model', 'gemini-2.5-pro'),
            "messages": formatted_messages,  # Todas as mensagens aqui!
            "context": chat.get('context')
        }
        
        # Enviar chat completo
        success, result = send_complete_chat(app_url, complete_chat_data)
        
        if success:
            print(f"✅ Chat importado com sucesso!")
            print(f"   Resposta: {result}")
        else:
            print(f"❌ Erro ao importar chat: {result}")
        
        print()
    
    print("🎉 IMPORTAÇÃO CONCLUÍDA!")
    print()
    print("🔍 Verificar em:")
    print(f"   - App: {app_url}")
    print(f"   - API: {app_url}/api/chats")
    print()
    print("📋 Para verificar as mensagens importadas:")
    print(f"   - API Chat: {app_url}/api/chats/b9xzyx67w")

if __name__ == "__main__":
    main()
