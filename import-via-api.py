#!/usr/bin/env python3
import json
import time
import urllib.request
import urllib.parse

def send_chat_data(app_url, chat_data):
    """Enviar dados do chat via API"""
    url = f"{app_url}/api/chats"
    
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

def send_message_batch(app_url, chat_id, messages_batch):
    """Enviar lote de mensagens via API"""
    for message in messages_batch:
        # Converter formato da mensagem
        msg_data = {
            "chatId": chat_id,
            "role": message.get('role', 'user'),
            "content": message.get('content', ''),
            "timestamp": message.get('created_at')
        }
        
        # Enviar mensagem individual
        url = f"{app_url}/api/chats/{chat_id}/messages"
        data = json.dumps(msg_data).encode('utf-8')
        
        req = urllib.request.Request(url, data=data)
        req.add_header('Content-Type', 'application/json')
        
        try:
            with urllib.request.urlopen(req) as response:
                result = json.loads(response.read().decode('utf-8'))
                print(f"✅ Mensagem enviada: {message.get('role')} - {message.get('content')[:30]}...")
        except Exception as e:
            print(f"❌ Erro ao enviar mensagem: {e}")
        
        # Pausa entre mensagens para não sobrecarregar
        time.sleep(0.1)

def main():
    app_url = "https://gemini-chat-cloud.onrender.com"
    
    print("🚀 IMPORTAÇÃO VIA API - MÉTODO CORPORATIVO")
    print("==========================================")
    print()
    
    # Ler dados
    try:
        with open('migration-export.json', 'r', encoding='utf-8') as f:
            data = json.load(f)
    except Exception as e:
        print(f"❌ Erro ao ler arquivo: {e}")
        return
    
    chats = data.get('chats', [])
    messages = data.get('messages', [])
    
    print(f"📊 Dados a importar:")
    print(f"   - Chats: {len(chats)}")
    print(f"   - Mensagens: {len(messages)}")
    print()
    
    # Importar chats
    for chat in chats:
        print(f"📝 Importando chat: {chat.get('title')}")
        
        # Preparar dados do chat (apenas estrutura, sem mensagens ainda)
        chat_data = {
            "id": chat.get('id'),
            "title": chat.get('title', 'Conversa Sem Título'),
            "model": chat.get('model', 'gemini-2.5-pro'),
            "messages": []  # Vazio inicialmente
        }
        
        success, result = send_chat_data(app_url, chat_data)
        
        if success:
            print(f"✅ Chat criado: {result}")
            
            # Agora enviar mensagens em lotes
            chat_messages = [msg for msg in messages if msg.get('chat_id') == chat.get('id')]
            
            if chat_messages:
                print(f"📨 Enviando {len(chat_messages)} mensagens...")
                
                # Converter sender para role
                for msg in chat_messages:
                    if msg.get('sender') == 'assistant':
                        msg['role'] = 'model'
                    else:
                        msg['role'] = 'user'
                
                # Enviar em lotes de 10 mensagens
                batch_size = 10
                for i in range(0, len(chat_messages), batch_size):
                    batch = chat_messages[i:i+batch_size]
                    print(f"  📦 Enviando lote {i//batch_size + 1}/{(len(chat_messages)-1)//batch_size + 1}")
                    send_message_batch(app_url, chat.get('id'), batch)
                    time.sleep(1)  # Pausa entre lotes
                
                print(f"✅ Todas as mensagens enviadas para chat {chat.get('id')}")
            else:
                print("ℹ️  Nenhuma mensagem encontrada para este chat")
                
        else:
            print(f"❌ Erro ao criar chat: {result}")
        
        print()
    
    print("🎉 IMPORTAÇÃO CONCLUÍDA!")
    print()
    print("🔍 Verificar em:")
    print(f"   - App: {app_url}")
    print(f"   - API: {app_url}/api/chats")

if __name__ == "__main__":
    main()
