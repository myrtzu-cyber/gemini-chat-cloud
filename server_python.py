#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Mestre Gemini - Servidor Python Simples
Servidor HTTP básico em Python para servir a aplicação mobile
"""

import http.server
import socketserver
import socket
import webbrowser
import threading
import json
import os
import sqlite3
import uuid
import re
import sys
import ssl
from datetime import datetime
from pathlib import Path
from urllib.parse import urlparse, parse_qs

# Configurar encoding do console para UTF-8 no Windows
if sys.platform.startswith('win'):
    try:
        sys.stdout.reconfigure(encoding='utf-8')
        sys.stderr.reconfigure(encoding='utf-8')
    except:
        pass

# Inicializar banco de dados globalmente
def backup_database(db_path):
    """Cria um backup do arquivo de banco de dados."""
    backup_path = db_path.with_suffix('.db.bak')
    try:
        if db_path.exists():
            import shutil
            shutil.copy2(db_path, backup_path)
            print(f"Backup do banco de dados criado em: {backup_path}")
    except Exception as e:
        print(f"[ERRO] Falha ao criar backup do banco de dados: {e}")

def init_global_database():
    """Inicializar banco de dados SQLite compatível com desktop"""
    db_path = Path(__file__).parent / 'database' / 'chats.db'
    db_path.parent.mkdir(exist_ok=True)

    # Criar backup antes de qualquer operação
    backup_database(db_path)
    conn = sqlite3.connect(str(db_path))
    
    # Criar tabelas compatíveis com o desktop Node.js
    # Adicionar colunas de contexto se não existirem
    cursor = conn.cursor()
    context_columns = ['master_rules', 'character_sheet', 'local_history', 'current_plot', 'relations', 'aventura', 'lastCompressionTime']
    for column in context_columns:
        try:
            cursor.execute(f'ALTER TABLE chats ADD COLUMN {column} TEXT DEFAULT ""')
            print(f"Coluna '{column}' adicionada à tabela 'chats'.")
        except sqlite3.OperationalError as e:
            if 'duplicate column name' in str(e):
                pass
            else:
                raise e
    conn.commit()

    conn.execute('''
        CREATE TABLE IF NOT EXISTS chats (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            model TEXT NOT NULL DEFAULT 'gemini-2.5-pro',
            messages TEXT DEFAULT '[]',
            master_rules TEXT DEFAULT '',
            character_sheet TEXT DEFAULT '',
            local_history TEXT DEFAULT '',
            current_plot TEXT DEFAULT '',
            relations TEXT DEFAULT '',
            aventura TEXT DEFAULT '',
            lastCompressionTime TEXT DEFAULT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    conn.execute('''
        CREATE TABLE IF NOT EXISTS messages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            chat_id TEXT NOT NULL,
            role TEXT NOT NULL,
            content TEXT NOT NULL,
            message_type TEXT DEFAULT 'text',
            file_info TEXT,
            status TEXT DEFAULT 'sent',
            retry_count INTEGER DEFAULT 0,
            error_message TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (chat_id) REFERENCES chats (id) ON DELETE CASCADE
        )
    ''')

    # Migration: Add new columns to existing messages table if they don't exist
    try:
        conn.execute('ALTER TABLE messages ADD COLUMN status TEXT DEFAULT "sent"')
    except sqlite3.OperationalError as e:
        if 'duplicate column name' not in str(e):
            print(f"Error adding status column: {e}")

    try:
        conn.execute('ALTER TABLE messages ADD COLUMN retry_count INTEGER DEFAULT 0')
    except sqlite3.OperationalError as e:
        if 'duplicate column name' not in str(e):
            print(f"Error adding retry_count column: {e}")

    try:
        conn.execute('ALTER TABLE messages ADD COLUMN error_message TEXT')
    except sqlite3.OperationalError as e:
        if 'duplicate column name' not in str(e):
            print(f"Error adding error_message column: {e}")

    try:
        conn.execute('ALTER TABLE messages ADD COLUMN updated_at DATETIME DEFAULT CURRENT_TIMESTAMP')
    except sqlite3.OperationalError as e:
        if 'duplicate column name' not in str(e):
            print(f"Error adding updated_at column: {e}")
    
    conn.commit()
    conn.close()

def clean_unicode_for_console(text):
    """Remove caracteres Unicode problemáticos para logs do console Windows"""
    if isinstance(text, str):
        # Substituir emojis e caracteres especiais por representação segura
        text = re.sub(r'[\U0001F600-\U0001F64F]', '[EMOJI]', text)  # Emoticons
        text = re.sub(r'[\U0001F300-\U0001F5FF]', '[SYMBOL]', text)  # Symbols
        text = re.sub(r'[\U0001F680-\U0001F6FF]', '[TRANSPORT]', text)  # Transport
        text = re.sub(r'[\U0001F1E0-\U0001F1FF]', '[FLAG]', text)  # Flags
        text = re.sub(r'[\U00002600-\U000026FF]', '[MISC]', text)  # Miscellaneous
        text = re.sub(r'[\U00002700-\U000027BF]', '[DINGBAT]', text)  # Dingbats
    return text

class GeminiHTTPHandler(http.server.SimpleHTTPRequestHandler):
    """Handler customizado para servir a aplicação"""
    # Adicionar suporte para SVG
    if not hasattr(http.server.SimpleHTTPRequestHandler.extensions_map, '.svg'):
        http.server.SimpleHTTPRequestHandler.extensions_map['.svg'] = 'image/svg+xml'
    
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(Path(__file__).parent), **kwargs)
    
    def get_db_connection(self):
        """Get database connection"""
        # Usar o mesmo banco que o desktop Node.js
        db_path = os.path.join(os.path.dirname(__file__), 'database', 'chats.db')
        os.makedirs(os.path.dirname(db_path), exist_ok=True)
        conn = sqlite3.connect(db_path)
        conn.row_factory = sqlite3.Row
        return conn
    
    def end_headers(self):
        super().end_headers()
    
    
    def do_GET(self):
        """Handle GET requests"""
        if self.path == '/':
            self.path = '/index.html'
        elif self.path == '/mobile':
            self.path = '/mobile.html'
        elif self.path.startswith('/api/health'):
            self.send_health_check()
            return
        elif self.path == '/api/chats/last':
            self.handle_last_chat_get()
            return
        elif self.path.startswith('/api/chats/') and len(self.path.split('/')) == 4:
            self.handle_chat_get_by_id()
            return
        elif self.path.startswith('/api/chats'):
            self.handle_chats_get()
            return
        
        super().do_GET()
    
    def do_POST(self):
        """Handle POST requests"""
        if self.path == '/api/chats':
            self.handle_chats_post()
        elif self.path == '/save-context':
            self.handle_save_context()
        else:
            print(f"[ERROR] POST endpoint não encontrado: {self.path}")
            self.send_error(404, f'POST endpoint não encontrado: {self.path}')

    def do_PUT(self):
        """Handle PUT requests"""
        # Rota para renomear: /api/chats/{id}/rename
        rename_match = re.match(r'^/api/chats/([^/]+)/rename$', self.path)
        if rename_match:
            chat_id = rename_match.group(1)
            self.handle_chat_rename(chat_id)
            return

        # Rota para contexto: /api/chats/{id}/context
        if self.path.endswith('/context'):
            self.handle_context_update()
            return

        self.send_error(404, 'Endpoint não encontrado')

    def do_DELETE(self):
        """Handle DELETE requests"""
        path_parts = self.path.strip('/').split('/')
        # Rota para deletar mensagem: /api/chats/{chat_id}/messages/{message_id}
        if len(path_parts) == 5 and path_parts[0] == 'api' and path_parts[1] == 'chats' and path_parts[3] == 'messages':
            self.handle_message_delete()
        elif self.path.startswith('/api/chats/'):
            self.handle_chats_delete()
        else:
            self.send_error(404)
    
    def do_OPTIONS(self):
        """Handle OPTIONS requests for CORS preflight"""
        print(f"[CORS] OPTIONS request received for path: {self.path}")
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, Authorization')
        self.end_headers()
        print("[CORS] Preflight headers sent.")
    
    def send_health_check(self):
        """Send health check response"""
        self.send_response(200)
        self.send_header('Content-type', 'application/json')
        self.end_headers()
        response = json.dumps({"status": "ok", "server": "python"})
        self.wfile.write(response.encode())
    
    def handle_chats_get(self):
        """Handle GET /api/chats - compatível com desktop e mobile"""
        conn = None
        try:
            conn = self.get_db_connection()
            
            # Buscar todas as conversas e calcular a contagem de mensagens do JSON
            cursor = conn.execute('''
                SELECT id, title, created_at, updated_at, model, messages
                FROM chats
                ORDER BY updated_at DESC
            ''')
            
            chats = []
            for row in cursor.fetchall():
                messages_json = row['messages'] if row['messages'] else '[]'
                try:
                    messages = json.loads(messages_json)
                    message_count = len(messages)
                except json.JSONDecodeError:
                    messages = []
                    message_count = 0

                preview = self.generate_chat_preview(messages)
                
                chats.append({
                    'id': row['id'],
                    'title': row['title'] or 'Conversa sem título',
                    'created_at': row['created_at'],
                    'updated_at': row['updated_at'],
                    'model': row['model'] or 'gemini-pro',
                    'preview': preview,
                    'message_count': message_count
                })
            
            self.send_json_response(chats)
        except Exception as e:
            print(f"Erro ao buscar chats: {e}")
            import traceback
            traceback.print_exc()
            self.send_error(500)
        finally:
            if conn:
                conn.close()
    
    def handle_last_chat_get(self):
        """Handle GET /api/chats/last - Retorna o último chat"""
        conn = None
        try:
            conn = self.get_db_connection()
            cursor = conn.execute('''
                SELECT id, title, messages, model, created_at, updated_at
                FROM chats 
                ORDER BY updated_at DESC 
                LIMIT 1
            ''')
            chat_row = cursor.fetchone()

            if chat_row is None:
                self.send_response(404)
                self.send_header('Access-Control-Allow-Origin', '*')
                self.send_header('Content-type', 'application/json')
                self.end_headers()
                response = json.dumps({'error': 'Nenhum chat encontrado'})
                self.wfile.write(response.encode())
                return

            chat_data = {
                'id': chat_row['id'],
                'title': chat_row['title'],
                'model': chat_row['model'],
                'messages': json.loads(chat_row['messages'] or '[]'),
                'created_at': chat_row['created_at'],
                'updated_at': chat_row['updated_at']
            }
            self.send_json_response(chat_data)

        except Exception as e:
            print(f"Erro ao buscar último chat: {e}")
            self.send_response(500)
            self.send_header('Access-Control-Allow-Origin', '*')
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            response = json.dumps({'error': 'Erro interno do servidor'})
            self.wfile.write(response.encode())
        finally:
            if conn:
                conn.close()

    def handle_chat_get_by_id(self):
        """Handle GET /api/chats/{id}"""
        conn = None
        try:
            chat_id = self.path.split('/')[-1]
            conn = self.get_db_connection()
            c = conn.cursor()

            # Selecionar todos os campos, incluindo os de contexto
            c.execute('SELECT id, title, messages, model, master_rules, character_sheet, local_history, current_plot, relations, aventura, lastCompressionTime FROM chats WHERE id = ?', (chat_id,))
            chat_row = c.fetchone()

            if chat_row is None:
                self.send_error(404, 'Chat não encontrado')
                return

            # Montar a resposta
            chat_data = {
                'id': chat_row['id'],
                'title': chat_row['title'],
                'model': chat_row['model'],
                'messages': json.loads(chat_row['messages'] or '[]'),
                'master_rules': chat_row['master_rules'],
                'character_sheet': chat_row['character_sheet'],
                'local_history': chat_row['local_history'],
                'current_plot': chat_row['current_plot'],
                'relations': chat_row['relations'],
                'aventura': chat_row['aventura'],
                'lastCompressionTime': chat_row['lastCompressionTime']
            }
            self.send_json_response(chat_data)

        except Exception as e:
            print(f"Erro ao buscar chat por ID: {e}")
            self.send_error(500)
        finally:
            if conn:
                conn.close()


    def handle_context_update(self):
        """Handle PUT /api/chats/{id}/context"""
        conn = None
        try:
            chat_id = self.path.split('/')[-2]
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length)
            data = json.loads(post_data.decode('utf-8'))

            allowed_fields = ['master_rules', 'character_sheet', 'local_history', 'current_plot', 'relations', 'aventura', 'lastCompressionTime']
            
            # Filtrar apenas os campos permitidos
            context_fields = {key: data.get(key) for key in allowed_fields if key in data}

            if not context_fields:
                self.send_error(400, 'Nenhum campo de contexto válido fornecido.')
                return

            conn = self.get_db_connection()
            
            # Construir a query de update dinamicamente
            set_clause = ', '.join([f"{key} = ?" for key in context_fields.keys()])
            values = list(context_fields.values())
            values.append(chat_id)

            query = f"UPDATE chats SET {set_clause}, updated_at = datetime('now') WHERE id = ?"
            
            conn.execute(query, tuple(values))
            conn.commit()

            print(f"Contexto do chat {chat_id} atualizado.")
            self.send_json_response({'id': chat_id, 'status': 'context_updated'})

        except Exception as e:
            print(f"Erro ao atualizar contexto: {e}")
            import traceback
            traceback.print_exc()
            self.send_error(500)
        finally:
            if conn:
                conn.close()

    def handle_save_context(self):
        """Handle POST /save-context - Save individual context tab"""
        conn = None
        try:
            print(f"[DEBUG] Recebendo POST /save-context")
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length)
            data = json.loads(post_data.decode('utf-8'))

            print(f"[DEBUG] Dados recebidos: {list(data.keys())}")

            chat_id = data.get('chatId')
            if not chat_id:
                print(f"[ERROR] chatId não fornecido")
                self.send_error(400, 'chatId é obrigatório')
                return

            print(f"[DEBUG] Salvando contexto para chat: {chat_id}")

            # Identificar quais campos de contexto foram enviados (excluindo chatId)
            allowed_fields = ['master_rules', 'character_sheet', 'local_history', 'current_plot', 'relations', 'aventura']
            context_fields = {key: data.get(key) for key in allowed_fields if key in data and data.get(key) is not None}

            if not context_fields:
                print(f"[ERROR] Nenhum campo de contexto válido fornecido")
                self.send_error(400, 'Nenhum campo de contexto válido fornecido')
                return

            print(f"[DEBUG] Campos de contexto a atualizar: {list(context_fields.keys())}")

            conn = self.get_db_connection()

            # Construir a query de update dinamicamente
            set_clause = ', '.join([f"{key} = ?" for key in context_fields.keys()])
            values = list(context_fields.values())
            values.append(chat_id)

            query = f"UPDATE chats SET {set_clause}, updated_at = datetime('now') WHERE id = ?"
            print(f"[DEBUG] Executando query: {query}")
            print(f"[DEBUG] Valores: {[str(v)[:100] + '...' if len(str(v)) > 100 else str(v) for v in values[:-1]]} + ['{chat_id}']")

            cursor = conn.cursor()
            cursor.execute(query, values)

            if cursor.rowcount == 0:
                print(f"[ERROR] Chat {chat_id} não encontrado")
                self.send_error(404, f'Chat {chat_id} não encontrado')
                return

            conn.commit()
            print(f"[DEBUG] Contexto salvo com sucesso para chat {chat_id}")

            # Enviar resposta de sucesso
            self.send_json_response({
                'id': chat_id,
                'status': 'context_saved',
                'updated_fields': list(context_fields.keys())
            })

        except json.JSONDecodeError as e:
            print(f"[ERROR] JSON inválido: {e}")
            self.send_error(400, 'JSON inválido')
        except Exception as e:
            print(f"[ERROR] Erro ao salvar contexto: {e}")
            import traceback
            traceback.print_exc()
            self.send_error(500, 'Erro interno do servidor')
        finally:
            if conn:
                conn.close()

    def handle_chats_post(self):
        """Handle POST /api/chats"""
        conn = None
        try:
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length)
            data = json.loads(post_data.decode('utf-8'))

            chat_id = data.get('id', str(uuid.uuid4()))
            title = data.get('title', 'Nova Conversa')
            model = data.get('model', 'gemini-pro')
            incoming_messages = data.get('messages', [])

            conn = self.get_db_connection()
            cursor = conn.cursor()

            # Verificar se a conversa já existe
            cursor.execute('SELECT messages FROM chats WHERE id = ?', (chat_id,))
            row = cursor.fetchone()

            final_messages = []
            if row:
                # Conversa existente: mesclar mensagens
                existing_messages_json = row['messages']
                existing_messages = json.loads(existing_messages_json) if existing_messages_json else []
                
                # Criar um dicionário de mensagens existentes por ID para evitar duplicatas
                existing_ids = {msg['id'] for msg in existing_messages if 'id' in msg}
                
                final_messages = list(existing_messages)
                # Adicionar apenas novas mensagens
                for msg in incoming_messages:
                    if 'id' not in msg or msg['id'] not in existing_ids:
                        final_messages.append(msg)
                
                messages_json = json.dumps(final_messages, ensure_ascii=False)
                
                cursor.execute('''
                    UPDATE chats SET title = ?, model = ?, messages = ?, updated_at = datetime('now')
                    WHERE id = ?
                ''', (title, model, messages_json, chat_id))
                
                status = 'updated'
            else:
                # Nova conversa: inserir
                final_messages = incoming_messages
                messages_json = json.dumps(final_messages, ensure_ascii=False)
                cursor.execute('''
                    INSERT INTO chats (id, title, model, messages, created_at, updated_at)
                    VALUES (?, ?, ?, ?, datetime('now'), datetime('now'))
                ''', (chat_id, title, model, messages_json))
                status = 'created'

            conn.commit()

            # Log para o console
            num_incoming = len(incoming_messages)
            num_existing = len(existing_messages) if 'existing_messages' in locals() else 0
            num_final = len(final_messages)
            print(f"[SAVE] Chat '{title}' (ID: {chat_id[:8]}) {status}. Recebidas: {num_incoming}, Existentes: {num_existing}, Final: {num_final} msgs.")

            self.send_json_response({'id': chat_id, 'status': status})

        except json.JSONDecodeError:
            self.send_error(400, 'JSON inválido')
        except Exception as e:
            print(f"Erro ao salvar chat: {e}")
            import traceback
            traceback.print_exc()
            self.send_error(500)
        finally:
            if conn:
                conn.close()

    def handle_chat_rename(self, chat_id):
        """Handle PUT /api/chats/{id}/rename - Renomear conversa"""
        conn = None
        try:
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length)
            data = json.loads(post_data.decode('utf-8'))
            new_title = data.get('title')

            if not new_title:
                self.send_response(400)
                self.send_header('Access-Control-Allow-Origin', '*')
                self.send_header('Content-type', 'application/json')
                self.end_headers()
                response = json.dumps({'error': '"title" é obrigatório'})
                self.wfile.write(response.encode())
                return

            conn = self.get_db_connection()
            cursor = conn.execute('UPDATE chats SET title = ?, updated_at = datetime(\'now\') WHERE id = ?', (new_title, chat_id))
            conn.commit()

            if cursor.rowcount == 0:
                self.send_response(404)
                self.send_header('Access-Control-Allow-Origin', '*')
                self.send_header('Content-type', 'application/json')
                self.end_headers()
                response = json.dumps({'error': 'Chat não encontrado'})
                self.wfile.write(response.encode())
            else:
                print(f"Chat {chat_id} renomeado para: {new_title}")
                self.send_json_response({'id': chat_id, 'title': new_title, 'status': 'renamed'})

        except Exception as e:
            print(f"Erro ao renomear chat: {e}")
            self.send_response(500)
            self.send_header('Access-Control-Allow-Origin', '*')
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            response = json.dumps({'error': 'Erro interno do servidor'})
            self.wfile.write(response.encode())
        finally:
            if conn:
                conn.close()

    def handle_message_delete(self):
        """Handle DELETE /api/chats/{chat_id}/messages/{message_id}"""
        conn = None
        try:
            # Extrair chat_id e message_id da URL, ex: /api/chats/uuid-123/messages/uuid-456
            path_parts = self.path.strip('/').split('/')
            if len(path_parts) != 5 or path_parts[0] != 'api' or path_parts[1] != 'chats' or path_parts[3] != 'messages':
                self.send_error(400, 'URL mal formatada. Use /api/chats/{chat_id}/messages/{message_id}')
                return
            chat_id = path_parts[2]
            message_id = path_parts[4]

            if not message_id:
                self.send_error(400, '"message_id" é obrigatório na URL')
                return

            conn = self.get_db_connection()
            
            # 1. Buscar a conversa
            cursor = conn.execute('SELECT messages FROM chats WHERE id = ?', (chat_id,))
            row = cursor.fetchone()
            if not row:
                self.send_error(404, 'Chat não encontrado')
                return

            # 2. Carregar, filtrar mensagens e verificar se a mensagem existe
            messages = json.loads(row['messages'])
            message_to_delete = next((msg for msg in messages if msg.get('id') == message_id), None)

            if not message_to_delete:
                # Não enviar erro se a mensagem já foi deletada, apenas logar.
                print(f"Mensagem {message_id} não encontrada no chat {chat_id}, talvez já tenha sido deletada.")
                self.send_json_response({'id': message_id, 'status': 'not_found'})
                return

            # 3. Remover a mensagem
            messages_updated = [msg for msg in messages if msg.get('id') != message_id]
            messages_json = json.dumps(messages_updated, ensure_ascii=False)

            # 4. Atualizar o chat no banco
            conn.execute('UPDATE chats SET messages = ?, updated_at = datetime(\'now\') WHERE id = ?', (messages_json, chat_id))
            conn.commit()

            print(f"Mensagem {message_id} deletada do chat {chat_id}")
            self.send_json_response({'id': message_id, 'status': 'deleted'})

        except Exception as e:
            print(f"Erro ao deletar mensagem: {e}")
            self.send_error(500)
        finally:
            if conn:
                conn.close()

    def handle_chats_delete(self):
        """Handle DELETE /api/chats/{id}"""
        conn = None
        try:
            print(f"DELETE request path: {self.path}")
            chat_id = self.path.split('/')[-1]
            print(f"Tentando deletar chat ID: {chat_id}")
            
            # Adicionar headers CORS
            self.send_response(200)
            self.send_header('Access-Control-Allow-Origin', '*')
            self.send_header('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS')
            self.send_header('Access-Control-Allow-Headers', 'Content-Type')
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            
            conn = self.get_db_connection()
            
            # Verificar se a conversa existe
            cursor = conn.execute('SELECT id FROM chats WHERE id = ?', (chat_id,))
            existing_chat = cursor.fetchone()
            print(f"Chat encontrado: {existing_chat}")
            
            if not existing_chat:
                print(f"Chat {chat_id} não encontrado")
                response = {'error': 'Chat não encontrado', 'id': chat_id}
                self.wfile.write(json.dumps(response).encode())
                return
            
            # Deletar conversa
            cursor = conn.execute('DELETE FROM chats WHERE id = ?', (chat_id,))
            rows_affected = cursor.rowcount
            conn.commit()
            print(f"Linhas afetadas: {rows_affected}")
            
            response = {'id': chat_id, 'status': 'deleted', 'rows_affected': rows_affected}
            self.wfile.write(json.dumps(response).encode())
            print(f"Chat {chat_id} deletado com sucesso")
            
        except Exception as e:
            print(f"Erro ao deletar chat: {e}")
            import traceback
            traceback.print_exc()
            response = {'error': str(e)}
            self.wfile.write(json.dumps(response).encode())
        finally:
            if conn:
                conn.close()
    
    def generate_chat_preview(self, messages):
        """Gerar preview inteligente da conversa"""
        if not messages or len(messages) == 0:
            return "Conversa vazia"
        
        # Pegar primeira mensagem do usuário
        for msg in messages:
            if msg.get('sender') == 'user' and msg.get('content'):
                content = msg.get('content', '').strip()
                if content:
                    return content[:80] + ('...' if len(content) > 80 else '')
        
        # Se não encontrou mensagem do usuário, pegar qualquer mensagem
        for msg in messages:
            if msg.get('content'):
                content = msg.get('content', '').strip()
                if content:
                    return content[:80] + ('...' if len(content) > 80 else '')
        
        return "Conversa sem texto"

    def send_json_response(self, data):
        """Send JSON response with CORS headers"""
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, Authorization')
        self.send_header('Content-type', 'application/json')
        self.end_headers()
        self.wfile.write(json.dumps(data, ensure_ascii=False, default=str).encode('utf-8'))

def get_local_ip():
    """Obtém o IP local da máquina"""
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        local_ip = s.getsockname()[0]
        s.close()
        return local_ip
    except Exception:
        return "127.0.0.1"

def print_banner():
    """Exibir banner do servidor"""
    banner = """
==============================================================
                    MESTRE GEMINI - MOBILE                 
                     Servidor Python Backend                 
==============================================================
"""
    print(banner)

def print_access_info(local_ip, port=8080):
    """Exibe as informações de acesso"""
    print("\n" + "="*60)
    print(" INFORMAÇÕES DE ACESSO")
    print("="*60)
    
    print(f"\nDESKTOP (Computador Local):")
    print(f"   http://localhost:{port}")
    print(f"   http://127.0.0.1:{port}")
    
    print(f"\nMOBILE (Celular na mesma rede Wi-Fi):")
    print(f"   Desktop: http://{local_ip}:{port}")
    print(f"   Mobile:  https://{local_ip}:{port}/mobile.html")
    
    print(f"\nINSTRUCOES PARA MOBILE:")
    print(f"   1. Conecte o celular na mesma rede Wi-Fi")
    print(f"   2. Abra o navegador no celular")
    print(f"   3. Digite: https://{local_ip}:{port}/mobile.html")
    print(f"   4. Configure sua chave da API Gemini")
    print(f"   5. Para instalar como app: Menu -> 'Adicionar a tela inicial'")
    
    print("\n" + "="*60)
    print(f"\nIMPORTANTE:")
    print(f"   • Mantenha este terminal aberto enquanto usar o app")
    print(f"   • PC e celular devem estar na mesma rede Wi-Fi")
    print(f"   • Backend completo ativo - conversas sao salvas")
    print(f"   • Banco de dados SQLite criado automaticamente")
    print("="*60)

def main():
    """Função principal"""
    print_banner()
    
    # Configurações
    PORT = 8080
    local_ip = get_local_ip()
    
    print(f"IP Local detectado: {local_ip}")
    print(f"Iniciando servidor Python na porta {PORT}...")
    print(f"Inicializando banco de dados SQLite...")
    
    # Inicializar banco de dados
    init_global_database()
    print(f"Banco de dados inicializado!")
    
    try:
        # Permitir a reutilização do endereço para evitar erro "Address already in use"
        socketserver.TCPServer.allow_reuse_address = True
        # Criar servidor
        httpd = socketserver.TCPServer(("", PORT), GeminiHTTPHandler)

        # Envolver o socket com SSL
        try:
            context = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
            context.load_cert_chain(certfile='cert.pem', keyfile='key.pem')
            httpd.socket = context.wrap_socket(httpd.socket, server_side=True)
            print("Servidor agora rodando em HTTPS!")
        except FileNotFoundError:
            print("\n[ERRO] Arquivos de certificado (key.pem, cert.pem) não encontrados.")
            print("Por favor, gere os arquivos usando o comando openssl e tente novamente.")
            return
        except ssl.SSLError as e:
            print(f"\n[ERRO SSL] {e}")
            print("Verifique se os arquivos de certificado são válidos.")
            return

        print(f"Servidor iniciado com sucesso!")
        print(f"Backend com suporte a conversas ativo!")

        # Exibir informações de acesso
        print_access_info(local_ip, PORT)

        print(f"\nServidor rodando... Pressione Ctrl+C para parar")

        # Manter servidor rodando
        httpd.serve_forever()
            
    except KeyboardInterrupt:
        print("\n\nParando servidor...")
        print("Servidor parado com sucesso!")
    except Exception as e:
        print(f"Erro ao iniciar servidor: {e}")
        input("Pressione Enter para sair...")

if __name__ == "__main__":
    main()
