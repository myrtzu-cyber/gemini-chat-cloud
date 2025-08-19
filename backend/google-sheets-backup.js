const { google } = require('googleapis');
require('dotenv').config();

class GoogleSheetsBackup {
    constructor() {
        this.auth = null;
        this.sheets = null;
        this.initializeAuth();
    }

    initializeAuth() {
        try {
            // Option 1: Service Account (Recommended for production)
            if (process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL && process.env.GOOGLE_PRIVATE_KEY) {
                this.auth = new google.auth.GoogleAuth({
                    credentials: {
                        client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
                        private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
                    },
                    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
                });
            }
            // Option 2: OAuth2 (for user-based access)
            else if (process.env.GOOGLE_SHEETS_CLIENT_ID) {
                const oauth2Client = new google.auth.OAuth2(
                    process.env.GOOGLE_SHEETS_CLIENT_ID,
                    process.env.GOOGLE_SHEETS_CLIENT_SECRET,
                    process.env.GOOGLE_SHEETS_REDIRECT_URI
                );

                oauth2Client.setCredentials({
                    refresh_token: process.env.GOOGLE_SHEETS_REFRESH_TOKEN
                });

                this.auth = oauth2Client;
            }

            if (this.auth) {
                this.sheets = google.sheets({ version: 'v4', auth: this.auth });
                console.log('✅ Google Sheets API inicializada');
            } else {
                console.log('⚠️  Google Sheets API não configurada (variáveis de ambiente ausentes)');
            }
        } catch (error) {
            console.error('❌ Erro ao inicializar Google Sheets API:', error.message);
        }
    }

    async createBackupSpreadsheet(title = 'Gemini Chat Backup') {
        if (!this.sheets) {
            throw new Error('Google Sheets API não configurada');
        }

        try {
            const response = await this.sheets.spreadsheets.create({
                resource: {
                    properties: {
                        title: `${title} - ${new Date().toISOString().split('T')[0]}`
                    },
                    sheets: [
                        {
                            properties: {
                                title: 'Chats',
                                gridProperties: {
                                    rowCount: 1000,
                                    columnCount: 10
                                }
                            }
                        },
                        {
                            properties: {
                                title: 'Messages',
                                gridProperties: {
                                    rowCount: 5000,
                                    columnCount: 8
                                }
                            }
                        }
                    ]
                }
            });

            const spreadsheetId = response.data.spreadsheetId;
            console.log(`✅ Planilha criada: ${response.data.spreadsheetUrl}`);
            return spreadsheetId;
        } catch (error) {
            console.error('❌ Erro ao criar planilha:', error.message);
            throw error;
        }
    }

    async exportChatsToSheets(chats, spreadsheetId) {
        if (!this.sheets) {
            throw new Error('Google Sheets API não configurada');
        }

        try {
            // Prepare chat data
            const chatHeaders = ['ID', 'Title', 'Model', 'Created At', 'Updated At', 'Message Count'];
            const chatRows = chats.map(chat => [
                chat.id,
                chat.title,
                chat.model,
                chat.created_at,
                chat.updated_at,
                Array.isArray(chat.messages) ? chat.messages.length : 0
            ]);

            // Write to Chats sheet
            await this.sheets.spreadsheets.values.update({
                spreadsheetId,
                range: 'Chats!A1:F' + (chatRows.length + 1),
                valueInputOption: 'RAW',
                resource: {
                    values: [chatHeaders, ...chatRows]
                }
            });

            console.log(`✅ ${chats.length} conversas exportadas para Google Sheets`);
            return true;
        } catch (error) {
            console.error('❌ Erro ao exportar conversas:', error.message);
            throw error;
        }
    }

    async exportMessagesToSheets(messages, spreadsheetId) {
        if (!this.sheets) {
            throw new Error('Google Sheets API não configurada');
        }

        try {
            // Prepare message data
            const messageHeaders = ['ID', 'Chat ID', 'Role', 'Content Preview', 'Type', 'Status', 'Created At', 'Updated At'];
            const messageRows = messages.map(msg => [
                msg.id,
                msg.chat_id,
                msg.role,
                msg.content ? msg.content.substring(0, 100) + (msg.content.length > 100 ? '...' : '') : '',
                msg.message_type || 'text',
                msg.status || 'sent',
                msg.created_at,
                msg.updated_at
            ]);

            // Write to Messages sheet
            await this.sheets.spreadsheets.values.update({
                spreadsheetId,
                range: 'Messages!A1:H' + (messageRows.length + 1),
                valueInputOption: 'RAW',
                resource: {
                    values: [messageHeaders, ...messageRows]
                }
            });

            console.log(`✅ ${messages.length} mensagens exportadas para Google Sheets`);
            return true;
        } catch (error) {
            console.error('❌ Erro ao exportar mensagens:', error.message);
            throw error;
        }
    }

    async createFullBackup(database) {
        if (!this.sheets) {
            console.log('⚠️  Google Sheets backup pulado (API não configurada)');
            return null;
        }

        try {
            console.log('📊 Iniciando backup completo para Google Sheets...');

            // Get all data from database
            const chats = await database.getAllChats();
            const allMessages = [];

            // Collect all messages from all chats
            for (const chat of chats) {
                try {
                    const messages = await database.getChatMessages(chat.id);
                    allMessages.push(...messages);
                } catch (error) {
                    console.warn(`⚠️  Erro ao obter mensagens do chat ${chat.id}:`, error.message);
                }
            }

            // Create spreadsheet
            const spreadsheetId = await this.createBackupSpreadsheet();

            // Export data
            await this.exportChatsToSheets(chats, spreadsheetId);
            await this.exportMessagesToSheets(allMessages, spreadsheetId);

            const spreadsheetUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}`;
            console.log(`🎉 Backup completo criado: ${spreadsheetUrl}`);

            return {
                spreadsheetId,
                spreadsheetUrl,
                chatsCount: chats.length,
                messagesCount: allMessages.length
            };
        } catch (error) {
            console.error('❌ Erro ao criar backup completo:', error.message);
            throw error;
        }
    }

    async importFromSheets(spreadsheetId, database) {
        if (!this.sheets) {
            throw new Error('Google Sheets API não configurada');
        }

        try {
            console.log('📥 Importando dados do Google Sheets...');

            // Import chats
            const chatsResponse = await this.sheets.spreadsheets.values.get({
                spreadsheetId,
                range: 'Chats!A2:F1000' // Skip header row
            });

            const chatRows = chatsResponse.data.values || [];
            console.log(`📝 Importando ${chatRows.length} conversas...`);

            for (const row of chatRows) {
                if (row.length >= 3) { // At least ID, Title, Model
                    try {
                        await database.saveChat({
                            id: row[0],
                            title: row[1],
                            model: row[2],
                            messages: []
                        });
                    } catch (error) {
                        console.warn(`⚠️  Erro ao importar chat ${row[0]}:`, error.message);
                    }
                }
            }

            console.log('✅ Importação concluída');
            return { chatsImported: chatRows.length };
        } catch (error) {
            console.error('❌ Erro ao importar do Google Sheets:', error.message);
            throw error;
        }
    }
}

module.exports = GoogleSheetsBackup;
