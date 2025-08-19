import sqlite3
import json

def list_all_chats():
    db_path = 'database/chats.db'
    try:
        conn = sqlite3.connect(db_path)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()

        # Buscar todas as conversas, ordenadas pela mais recente
        cursor.execute('SELECT id, title, updated_at, messages FROM chats ORDER BY updated_at DESC')
        all_chats = cursor.fetchall()

        if all_chats:
            print(f"--- Encontradas {len(all_chats)} Conversas Salvas ---")
            for chat in all_chats:
                print("\n==================================================")
                print(f"Título: {chat['title']}")
                print(f"ID: {chat['id']}")
                print(f"Última Atualização: {chat['updated_at']}")
                
                messages = json.loads(chat['messages'])
                print(f"Total de Mensagens: {len(messages)}")

                if messages:
                    print("--- Última Mensagem ---")
                    last_message = messages[-1]
                    role = last_message.get('role', 'N/A').capitalize()
                    content_preview = last_message.get('content', 'Conteúdo vazio')[:150].replace('\n', ' ')
                    try:
                        print(f"- {role}: {content_preview}...")
                    except UnicodeEncodeError:
                        safe_preview = content_preview.encode('ascii', 'ignore').decode('ascii')
                        print(f"- {role}: {safe_preview}...")
                else:
                    print("A conversa não tem mensagens.")
            print("\n==================================================")

        else:
            print("Nenhuma conversa encontrada no banco de dados.")

    except sqlite3.Error as e:
        print(f"Erro ao acessar o banco de dados: {e}")
    except Exception as e:
        print(f"Ocorreu um erro inesperado: {e}")
    finally:
        if conn:
            conn.close()

if __name__ == '__main__':
    list_all_chats()
