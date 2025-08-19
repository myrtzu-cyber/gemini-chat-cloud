import sqlite3
import json
import os
import re

def export_chat():
    """
    Connects to the SQLite database, lists chats, and exports a selected chat to a text file.
    """
    db_path = os.path.join(os.path.dirname(__file__), 'database', 'chats.db')

    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        print('Conectado ao banco de dados SQLite.')

        # List available chats, ordering by ID descending to get recent ones first
        cursor.execute('SELECT id, title FROM chats ORDER BY id DESC')
        chats = cursor.fetchall()

        if not chats:
            print('Nenhuma conversa encontrada.')
            return

        print('\n--- Conversas Disponíveis ---')
        for chat_id, title in chats:
            print(f'ID: {chat_id} - Título: {title}')
        print('---------------------------\n')

        # Prompt for chat ID
        try:
            selected_id = input('Digite o ID da conversa que deseja exportar: ')
        except KeyboardInterrupt:
            print("\nOperação cancelada pelo usuário.")
            return

        # Fetch the selected chat
        cursor.execute('SELECT messages, title FROM chats WHERE id = ?', (selected_id,))
        chat_data = cursor.fetchone()

        if not chat_data:
            print('ID da conversa não encontrado.')
            return

        messages_json, title = chat_data
        
        # Format the chat content
        try:
            messages = json.loads(messages_json)
            formatted_chat = ''
            for msg in messages:
                sender = 'EU' if msg.get('sender') == 'user' else 'Gemini'
                content = msg.get('content', '')
                formatted_chat += f'{sender}: {content}\n\n'

            # Sanitize title for a valid filename
            safe_title = re.sub(r'[\\/\\:*?"<>|]', '_', title)
            file_path = os.path.join(os.path.dirname(__file__), f'{safe_title}.txt')

            # Write to file
            with open(file_path, 'w', encoding='utf-8') as f:
                f.write(formatted_chat)
            
            print(f'\nConversa exportada com sucesso para: {file_path}')

        except json.JSONDecodeError:
            print('Erro: Formato de mensagens inválido no banco de dados.')
        except Exception as e:
            print(f'Ocorreu um erro ao processar a conversa: {e}')

    except sqlite3.Error as e:
        print(f'Erro no banco de dados: {e}')
    finally:
        if 'conn' in locals() and conn:
            conn.close()
        print('Script finalizado.')

if __name__ == '__main__':
    export_chat()
