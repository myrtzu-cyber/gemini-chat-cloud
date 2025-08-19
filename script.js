/**
 * Mestre Gemini - Desktop Chat Script
 *
 * Responsável por toda a lógica do frontend para a versão desktop, incluindo:
 * - Comunicação com a API do Gemini e com o servidor backend local.
 * - Gerenciamento de múltiplas conversas (salvar, carregar, excluir).
 * - Renderização de mensagens, incluindo formatação Markdown.
 * - Lógica para exclusão de mensagens individuais com botão.
 * - Gerenciamento de anexos, configurações de API e modelo.
 * - Notificações e feedback para o usuário.
 */
class GeminiChat {
    constructor() {
        // --- State Properties ---
        this.apiKey = localStorage.getItem('gemini_api_key') || '';
        this.selectedModel = localStorage.getItem('gemini_selected_model') || 'gemini-1.5-pro-latest';
        this.conversationHistory = [];
        this.attachedFiles = [];
        this.currentChatId = null;
        this.currentChatTitle = 'Nova Conversa';
        
        // --- Timers & Config ---
        this.autoSaveEnabled = true;
        this.autoSaveDelay = 2500; // ms
        this.autoSaveTimer = null;

        // --- API Configuration ---
        this.apiBaseUrl = this.getApiBaseUrl();

        // --- Initialization ---
        this.initializeElements();
        this.injectCSS();
        this.bindEvents();
        this.updateUI();
        this.updateModelInfo();
        this.updateChatTitle();
        this.loadLatestChat();
    }

    // 1. INITIALIZATION & SETUP
    // =========================================================================

    /** Obter URL base da API usando config.js se disponível */
    getApiBaseUrl() {
        if (window.appConfig) {
            console.log('🔧 Desktop: Usando AppConfig para API base URL');
            return window.appConfig.apiBaseUrl;
        } else {
            console.log('⚠️ Desktop: AppConfig não encontrado, usando URL relativa');
            return window.location.origin; // Fallback para URL atual
        }
    }

    /** Mapeia os elementos do DOM para propriedades da classe. */
    initializeElements() {
        this.elements = {
            apiKeyInput: document.getElementById('apiKeyInput'),
            saveApiKeyBtn: document.getElementById('saveApiKey'),
            modelSelect: document.getElementById('modelSelect'),
            modelInfo: document.getElementById('modelInfo'),
            messageInput: document.getElementById('messageInput'),
            sendBtn: document.getElementById('sendMessage'),
            chatMessages: document.getElementById('chatMessages'),
            typingIndicator: document.getElementById('typingIndicator'),
            charCount: document.getElementById('charCount'),
            attachFileBtn: document.getElementById('attachFile'),
            fileInput: document.getElementById('fileInput'),
            fileUploadSection: document.getElementById('fileUploadSection'),
            filePreview: document.getElementById('filePreview'),
            removeFilesBtn: document.getElementById('removeFiles'),
            newChatBtn: document.getElementById('newChat'),
            saveChatBtn: document.getElementById('saveChat'),
            loadChatsBtn: document.getElementById('loadChats'),
            chatTitle: document.getElementById('chatTitle'),
            chatsModal: document.getElementById('chatsModal'),
            closeModalBtn: document.getElementById('closeModal'),
            chatsList: document.getElementById('chatsList'),
            compressHistoryBtn: document.getElementById('compressHistory'),
        };

        if (this.apiKey && this.elements.apiKeyInput) {
            this.elements.apiKeyInput.value = this.apiKey;
        }
        if (this.elements.modelSelect) {
            this.elements.modelSelect.value = this.selectedModel;
        }
    }

    /** Adiciona os listeners de eventos aos elementos da UI. */
    bindEvents() {
        const { elements } = this;
        if (elements.saveApiKeyBtn) elements.saveApiKeyBtn.addEventListener('click', () => this.saveApiKey());
        if (elements.modelSelect) elements.modelSelect.addEventListener('change', () => this.changeModel());
        if (elements.sendBtn) elements.sendBtn.addEventListener('click', () => this.sendMessage());
        if (elements.messageInput) {
            elements.messageInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    this.sendMessage();
                }
            });
            elements.messageInput.addEventListener('input', () => {
                this.updateCharCount();
                this.autoResize();
                this.scheduleAutoSave();
            });
        }
        if (elements.attachFileBtn) elements.attachFileBtn.addEventListener('click', () => elements.fileInput.click());
        if (elements.fileInput) elements.fileInput.addEventListener('change', (e) => this.handleFileSelection(e));
        if (elements.removeFilesBtn) elements.removeFilesBtn.addEventListener('click', () => this.removeAllFiles());
        if (elements.newChatBtn) elements.newChatBtn.addEventListener('click', () => this.startNewChat());
        if (elements.saveChatBtn) elements.saveChatBtn.addEventListener('click', () => this.saveCurrentChat());
        if (elements.loadChatsBtn) elements.loadChatsBtn.addEventListener('click', () => this.showChatsModal());
        if (elements.closeModalBtn) elements.closeModalBtn.addEventListener('click', () => this.hideChatsModal());
        if (elements.compressHistoryBtn) elements.compressHistoryBtn.addEventListener('click', () => this.compressAndClearHistory());
    }

    /** Injeta os estilos CSS necessários dinamicamente. */
    injectCSS() {
        const style = document.createElement('style');
        style.textContent = `
            .chat-message:hover .delete-message-btn { opacity: 1; }
            .delete-message-btn {
                position: absolute;
                top: 5px; right: 5px;
                background: #e74c3c; color: white;
                border: none; border-radius: 50%;
                width: 20px; height: 20px;
                font-size: 12px; line-height: 20px; text-align: center;
                cursor: pointer; opacity: 0;
                transition: opacity 0.2s ease, background-color 0.2s ease;
            }
            .delete-message-btn:hover { background-color: #c0392b; }
            .notification {
                position: fixed; top: 20px; right: 20px;
                padding: 15px 20px; border-radius: 10px; color: white;
                font-weight: 500; z-index: 1000; max-width: 300px;
                word-wrap: break-word; animation: slideInRight 0.3s ease;
            }
            .notification.success { background: #27ae60; }
            .notification.error { background: #e74c3c; }
            .notification.info { background: #3498db; }
            .auto-save-indicator {
                position: fixed; bottom: 20px; right: 20px;
                background: rgba(39, 174, 96, 0.8);
                color: white; padding: 5px 10px; border-radius: 5px;
                font-size: 12px; z-index: 1000;
                animation: fadeInOut 2.5s ease;
            }
            @keyframes slideInRight { from { transform: translateX(100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
            @keyframes fadeInOut { 0%, 100% { opacity: 0; } 20%, 80% { opacity: 1; } }
        `;
        document.head.appendChild(style);
    }

    // 2. CORE CHAT LOGIC
    // =========================================================================
    
    /** Envia a mensagem do usuário e processa a resposta. */
    async sendMessage() {
        const messageText = this.elements.messageInput.value.trim();
        if (!messageText && this.attachedFiles.length === 0) return;

        this.showTypingIndicator();
        const userMessageId = `msg_${Date.now()}`;
        
        // Adiciona a mensagem do usuário à UI e ao histórico
        this.addMessage(messageText, 'user', userMessageId);

        // Add formatting reinforcement to the message for API call
        const messageWithFormatting = this.addFormattingReinforcement(messageText);
        this.conversationHistory.push({ id: userMessageId, role: 'user', parts: [{ text: messageWithFormatting }] });
        
        this.elements.messageInput.value = '';
        this.updateCharCount();
        this.autoResize();

        try {
            const responseText = await this.callGeminiAPI();
            const assistantMessageId = `msg_${Date.now() + 1}`;
            
            // Adiciona a resposta do assistente à UI e ao histórico
            this.addMessage(responseText, 'assistant', assistantMessageId);
            this.conversationHistory.push({ id: assistantMessageId, role: 'assistant', parts: [{ text: responseText }] });

        } catch (error) {
            this.showNotification(`Erro: ${error.message}`, 'error');
            // Remove a mensagem do usuário se a API falhar
            this.conversationHistory.pop();
            document.getElementById(userMessageId)?.remove();
        } finally {
            this.hideTypingIndicator();
            this.scheduleAutoSave();
        }
    }

    /** Adiciona uma mensagem à interface do chat. */
    addMessage(text, sender, messageId) {
        const messageElement = document.createElement('div');
        messageElement.id = messageId;
        messageElement.className = `message ${sender}`;

        const formattedText = this.formatText(text);
        const deleteButton = `<button class="delete-message-btn" onclick="geminiChat.deleteMessage('${messageId}')" title="Excluir">X</button>`;

        // Create avatar
        const avatar = sender === 'user' ? '🏹' : '🐉';

        messageElement.innerHTML = `
            <div class="message-avatar">${avatar}</div>
            <div class="message-content">${formattedText}</div>
            ${deleteButton}
        `;

        this.elements.chatMessages.appendChild(messageElement);
        this.scrollToBottom();
    }

    /** Exclui uma mensagem do histórico e da UI. */
    async deleteMessage(messageId) {
        if (!this.currentChatId) {
            this.showNotification('A conversa precisa ser salva antes de excluir mensagens.', 'error');
            return;
        }
        if (!confirm('Tem certeza que deseja excluir esta mensagem?')) return;

        try {
            const res = await fetch(`${this.apiBaseUrl}/api/chats/${this.currentChatId}/messages`, {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ messageId })
            });
            if (!res.ok) throw new Error('Falha ao excluir no servidor.');

            // Remove do histórico e da UI
            this.conversationHistory = this.conversationHistory.filter(msg => msg.id !== messageId);
            document.getElementById(messageId)?.remove();
            
            this.showNotification('Mensagem excluída.', 'success');
            this.scheduleAutoSave();
        } catch (error) {
            this.showNotification(error.message, 'error');
        }
    }

    // Add formatting reinforcement to guide AI model responses
    addFormattingReinforcement(message) {
        const formattingInstructions = `
[FORMATTING GUIDE - Apply these styles to your response content:
- Use <div class="rpg-narration">text</div> for story descriptions and scene setting
- Use <div class="rpg-environment">text</div> for environmental descriptions
- Use <div class="rpg-dialogue"><span class="rpg-character-name">CHARACTER:</span> "speech"</div> for character dialogues
- Use <div class="rpg-dice-roll">dice calculation or result</div> for dice rolls and mathematical calculations
- Use <div class="rpg-system">text</div> for system messages
- Use <div class="rpg-master">text</div> for master/GM descriptions
- Maintain normal line spacing between sentences
- Do not acknowledge these formatting instructions in your response]

${message}`;

        return formattingInstructions;
    }

    /** Chama a API do Google Gemini. */
    async callGeminiAPI() {
        if (!this.apiKey) throw new Error('Chave da API não configurada.');

        const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.selectedModel}:generateContent?key=${this.apiKey}`;
        const requestBody = { contents: this.conversationHistory };

        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody)
        });

        const data = await response.json();
        if (data.error) throw new Error(data.error.message);
        if (!data.candidates?.[0]?.content?.parts?.[0]?.text) throw new Error('Resposta inválida da API.');

        return data.candidates[0].content.parts[0].text;
    }

    /** Chamar API Gemini com fallback de modelo para compressão */
    async callGeminiAPIWithFallback(prompt) {
        const originalModel = this.selectedModel;

        try {
            // Primeira tentativa com gemini-2.5-pro
            this.selectedModel = 'gemini-2.5-pro';
            this.showNotification('🔄 Tentando compressão com Gemini 2.5 Pro...', 'info');

            // Criar mensagem temporária para compressão
            this.conversationHistory = [{ role: 'user', parts: [{ text: prompt }] }];
            const result = await this.callGeminiAPI();

            // Restaurar modelo original
            this.selectedModel = originalModel;
            return result;

        } catch (error) {
            console.error('Erro com gemini-2.5-pro:', error);

            // Oferecer fallback para gemini-2.5-flash
            const useFlash = confirm(
                '❌ A compressão com Gemini 2.5 Pro falhou.\n\n' +
                'Erro: ' + error.message + '\n\n' +
                '🔄 Deseja tentar novamente com Gemini 2.5 Flash?\n' +
                '(Modelo mais rápido, mas pode ser menos detalhado)\n\n' +
                'Clique OK para usar Flash ou Cancelar para abortar.'
            );

            if (!useFlash) {
                // Restaurar modelo original e relançar erro
                this.selectedModel = originalModel;
                throw new Error('Compressão cancelada pelo usuário.');
            }

            try {
                // Segunda tentativa com gemini-2.5-flash
                this.selectedModel = 'gemini-2.5-flash';
                this.showNotification('🔄 Tentando compressão com Gemini 2.5 Flash...', 'info');

                // Criar mensagem temporária para compressão
                this.conversationHistory = [{ role: 'user', parts: [{ text: prompt }] }];
                const result = await this.callGeminiAPI();

                // Restaurar modelo original
                this.selectedModel = originalModel;
                this.showNotification('✅ Compressão concluída com Gemini 2.5 Flash!', 'success');
                return result;

            } catch (flashError) {
                console.error('Erro com gemini-2.5-flash:', flashError);

                // Restaurar modelo original
                this.selectedModel = originalModel;

                throw new Error(
                    'Falha na compressão com ambos os modelos.\n' +
                    'Gemini 2.5 Pro: ' + error.message + '\n' +
                    'Gemini 2.5 Flash: ' + flashError.message
                );
            }
        }
    }

    /** Comprimir histórico de conversas */
    async compressConversationHistory() {
        if (this.conversationHistory.length === 0) {
            this.showNotification('Não há histórico para comprimir.', 'warning');
            return null;
        }

        if (this.conversationHistory.length < 10) {
            this.showNotification('Histórico muito curto para compressão. Mínimo de 10 mensagens necessário.', 'warning');
            return null;
        }

        try {
            this.showNotification('🔄 Comprimindo histórico...', 'info');

            // Preparar mensagens para compressão (excluir as últimas 3 para manter contexto recente)
            const messagesToCompress = this.conversationHistory.slice(0, -3);
            const recentMessages = this.conversationHistory.slice(-3);

            // Construir prompt para compressão
            const conversationText = messagesToCompress.map(msg => {
                const role = msg.role === 'user' ? 'Jogador' : 'Mestre';
                const content = msg.parts[0]?.text || '';
                return `${role}: ${content}`;
            }).join('\n\n');

            const compressionPrompt = `Por favor, analise a seguinte conversa de RPG e crie um resumo conciso mas abrangente, preservando:

1. Eventos importantes da história
2. Decisões significativas dos personagens
3. Informações de mundo relevantes
4. Estado atual dos personagens
5. Tramas e objetivos em andamento
6. Relacionamentos importantes
7. Itens, habilidades ou recursos obtidos
8. Evolução do personagem e mudanças psicológicas
9. Novos personagens encontrados
10. Desenvolvimentos de plot recentes

Mantenha o resumo em português e organize-o de forma clara e cronológica. Foque no que é essencial para continuar a aventura, incluindo detalhes sobre o desenvolvimento do personagem e relacionamentos.

CONVERSA A RESUMIR:
${conversationText}

RESUMO COMPRIMIDO:`;

            // Salvar histórico atual temporariamente
            const originalHistory = [...this.conversationHistory];

            // Chamar API para compressão com fallback de modelo
            const compressedSummary = await this.callGeminiAPIWithFallback(compressionPrompt);

            // Restaurar histórico original
            this.conversationHistory = originalHistory;

            // Criar objeto de histórico comprimido
            const compressedHistory = {
                originalMessageCount: messagesToCompress.length,
                compressedAt: new Date().toISOString(),
                summary: compressedSummary,
                recentMessages: recentMessages
            };

            this.showNotification('✅ Histórico comprimido com sucesso!', 'success');
            return compressedHistory;

        } catch (error) {
            console.error('Erro ao comprimir histórico:', error);
            this.showNotification('❌ Erro ao comprimir histórico: ' + error.message, 'error');
            return null;
        }
    }

    /** Limpar histórico original (manter apenas mensagens recentes) */
    clearOriginalHistory(compressedHistory) {
        if (!compressedHistory) return;

        // Manter apenas as mensagens recentes
        this.conversationHistory = compressedHistory.recentMessages || [];

        // Atualizar UI
        this.displayChatHistory();

        this.showNotification('🧹 Histórico original limpo. Mantidas apenas mensagens recentes.', 'success');
    }

    /** Função principal para comprimir e limpar histórico */
    async compressAndClearHistory() {
        if (!this.currentChatId) {
            this.showNotification('❌ Salve a conversa antes de comprimir o histórico.', 'error');
            return;
        }

        const confirmation = confirm(
            'Esta ação irá:\n\n' +
            '1. Comprimir o histórico da conversa em um resumo\n' +
            '2. Salvar o resumo como uma nota no chat\n' +
            '3. Limpar as mensagens antigas (manter apenas as 3 mais recentes)\n\n' +
            'Esta ação não pode ser desfeita. Continuar?'
        );

        if (!confirmation) return;

        try {
            // Comprimir histórico
            const compressedHistory = await this.compressConversationHistory();
            if (!compressedHistory) return;

            // Adicionar resumo como mensagem do sistema
            const summaryMessageId = `summary_${Date.now()}`;
            const summaryMessage = {
                id: summaryMessageId,
                role: 'assistant',
                parts: [{
                    text: `📋 **RESUMO DO HISTÓRICO COMPRIMIDO**\n\n` +
                          `*Comprimido em: ${new Date().toLocaleString('pt-BR')}*\n` +
                          `*Mensagens originais: ${compressedHistory.originalMessageCount}*\n\n` +
                          `${compressedHistory.summary}\n\n` +
                          `---\n*Este resumo substitui ${compressedHistory.originalMessageCount} mensagens anteriores.*`
                }]
            };

            // Adicionar resumo ao início das mensagens recentes
            this.conversationHistory = [summaryMessage, ...compressedHistory.recentMessages];

            // Atualizar UI
            this.displayChatHistory();

            // Salvar conversa atualizada
            await this.autoSaveCurrentChat();

            this.showNotification('🎉 Compressão concluída! O resumo foi adicionado ao chat.', 'success');

        } catch (error) {
            console.error('Erro no processo de compressão:', error);
            this.showNotification('❌ Erro durante a compressão: ' + error.message, 'error');
        }
    }

    // 3. CHAT MANAGEMENT (SAVE, LOAD, DELETE)
    // =========================================================================

    startNewChat() {
        if (this.conversationHistory.length > 0) this.autoSaveCurrentChat();
        this.conversationHistory = [];
        this.currentChatId = null;
        this.currentChatTitle = 'Nova Conversa';
        this.attachedFiles = [];
        this.clearChatMessages();
        this.updateChatTitle();
        this.updateFilePreview();
        this.showNotification('Nova conversa iniciada.', 'success');
    }

    async saveCurrentChat() {
        if (this.conversationHistory.length === 0) {
            this.showNotification('Não há nada para salvar.', 'info');
            return;
        }
        const chatTitle = prompt('Digite um título para a conversa:', this.currentChatTitle);
        if (chatTitle) {
            this.currentChatTitle = chatTitle;
            this.updateChatTitle();
            await this.autoSaveCurrentChat();
            this.showNotification('Conversa salva!', 'success');
        }
    }

    scheduleAutoSave() {
        if (!this.autoSaveEnabled || this.conversationHistory.length === 0) return;
        clearTimeout(this.autoSaveTimer);
        this.autoSaveTimer = setTimeout(() => this.autoSaveCurrentChat(), this.autoSaveDelay);
    }

    async autoSaveCurrentChat() {
        if (this.conversationHistory.length === 0) return;
        
        if (!this.currentChatId) {
            this.currentChatId = `chat_${Date.now()}`;
            if (this.currentChatTitle === 'Nova Conversa') {
                const firstText = this.conversationHistory[0]?.parts[0]?.text || 'Nova Conversa';
                this.currentChatTitle = firstText.substring(0, 40) + (firstText.length > 40 ? '...' : '');
                this.updateChatTitle();
            }
        }
        
        await this.saveChatToStorage();
        this.showAutoSaveIndicator();
    }

    async saveChatToStorage() {
        if (!this.currentChatId) return;
        const chatData = {
            id: this.currentChatId,
            title: this.currentChatTitle,
            model: this.selectedModel,
            history: this.conversationHistory,
            updatedAt: new Date().toISOString()
        };
        try {
            await fetch(`${this.apiBaseUrl}/api/chats`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(chatData)
            });
        } catch (error) {
            this.showNotification('Erro ao salvar conversa.', 'error');
        }
    }

    async loadLatestChat() {
        try {
            const response = await fetch(`${this.apiBaseUrl}/api/chats`);
            if (!response.ok) return;
            const chats = await response.json();
            if (chats.length > 0) {
                const latestChat = chats.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))[0];
                this.loadChat(latestChat.id);
            }
        } catch (error) { /* Silently fail */ }
    }

    async loadChat(chatId) {
        try {
            const response = await fetch(`${this.apiBaseUrl}/api/chats/${chatId}`);
            const chatData = await response.json();
            this.conversationHistory = chatData.history || [];
            this.currentChatId = chatData.id;
            this.currentChatTitle = chatData.title;
            this.selectedModel = chatData.model;
            if (this.elements.modelSelect) this.elements.modelSelect.value = this.selectedModel;
            
            this.updateModelInfo();
            this.updateChatTitle();
            this.displayChatHistory();
            this.hideChatsModal();
            this.showNotification(`Conversa "${chatData.title}" carregada.`, 'success');
        } catch (error) {
            this.showNotification('Falha ao carregar conversa.', 'error');
        }
    }

    async deleteChat(chatId) {
        if (!confirm('Tem certeza que deseja excluir esta conversa?')) return;
        try {
            await fetch(`${this.apiBaseUrl}/api/chats/${chatId}`, { method: 'DELETE' });
            if (this.currentChatId === chatId) this.startNewChat();
            this.loadChatsList(); // Refresh list in modal
            this.showNotification('Conversa excluída.', 'success');
        } catch (error) {
            this.showNotification('Falha ao excluir conversa.', 'error');
        }
    }

    // 4. UI & HELPERS
    // =========================================================================

    displayChatHistory() {
        this.clearChatMessages();
        this.conversationHistory.forEach(msg => {
            const text = msg.parts[0].text || '...';
            this.addMessage(text, msg.role, msg.id);
        });
    }

    async showChatsModal() {
        this.elements.chatsModal.style.display = 'flex';
        await this.loadChatsList();
    }

    hideChatsModal() {
        this.elements.chatsModal.style.display = 'none';
    }

    async loadChatsList() {
        try {
            const response = await fetch(`${this.apiBaseUrl}/api/chats`);
            const chats = await response.json();
            this.elements.chatsList.innerHTML = '';
            if (chats.length === 0) {
                this.elements.chatsList.innerHTML = '<p>Nenhuma conversa salva.</p>';
                return;
            }
            chats.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt)).forEach(chat => {
                const chatItem = document.createElement('div');
                chatItem.className = 'chat-item';
                let preview = chat.history[0]?.parts[0]?.text?.substring(0, 100) || '...';
                chatItem.innerHTML = `
                    <div class="chat-item-header">
                        <span class="chat-item-title">${chat.title}</span>
                        <span class="chat-item-date">${new Date(chat.updatedAt).toLocaleString()}</span>
                    </div>
                    <div class="chat-item-preview">${preview}</div>
                    <div class="chat-item-actions">
                        <button onclick="geminiChat.loadChat('${chat.id}')">Carregar</button>
                        <button onclick="geminiChat.deleteChat('${chat.id}')">Excluir</button>
                    </div>
                `;
                this.elements.chatsList.appendChild(chatItem);
            });
        } catch (error) {
            this.showNotification('Falha ao carregar lista de conversas.', 'error');
        }
    }

    saveApiKey() {
        const apiKey = this.elements.apiKeyInput.value.trim();
        if (!apiKey) {
            this.showNotification('Por favor, insira uma chave da API válida.', 'error');
            return;
        }
        this.apiKey = apiKey;
        localStorage.setItem('gemini_api_key', apiKey);
        this.showNotification('Chave da API salva com sucesso!', 'success');
        this.updateUI();
    }

    changeModel() {
        this.selectedModel = this.elements.modelSelect.value;
        localStorage.setItem('gemini_selected_model', this.selectedModel);
        this.updateModelInfo();
        this.showNotification(`Modelo alterado para: ${this.getModelDisplayName(this.selectedModel)}`, 'success');
        this.scheduleAutoSave();
    }

    updateUI() {
        const hasApiKey = !!this.apiKey;
        this.elements.messageInput.disabled = !hasApiKey;
        this.elements.sendBtn.disabled = !hasApiKey;
        this.elements.messageInput.placeholder = hasApiKey ? 'Digite sua mensagem aqui...' : 'Salve sua chave da API primeiro...';
        this.updateCharCount();
    }

    updateCharCount() {
        const count = this.elements.messageInput.value.length;
        this.elements.charCount.textContent = `${count}/10000`;
        this.elements.sendBtn.disabled = (count === 0 && this.attachedFiles.length === 0) || count > 10000 || !this.apiKey;
        this.elements.charCount.style.color = count > 10000 ? '#e74c3c' : (count > 8000 ? '#f39c12' : '#999');
    }

    autoResize() {
        const { messageInput } = this.elements;
        messageInput.style.height = 'auto';
        messageInput.style.height = `${Math.min(messageInput.scrollHeight, 150)}px`;
    }

    showNotification(message, type = 'info') {
        document.querySelector('.notification')?.remove();
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.textContent = message;
        document.body.appendChild(notification);
        setTimeout(() => notification.remove(), 5000);
    }
    
    showAutoSaveIndicator() {
        document.querySelector('.auto-save-indicator')?.remove();
        const indicator = document.createElement('div');
        indicator.className = 'auto-save-indicator';
        indicator.textContent = '💾 Salvo';
        document.body.appendChild(indicator);
        setTimeout(() => indicator.remove(), 2500);
    }

    clearChatMessages() { this.elements.chatMessages.innerHTML = ''; }
    scrollToBottom() { this.elements.chatMessages.scrollTop = this.elements.chatMessages.scrollHeight; }
    showTypingIndicator() { this.elements.typingIndicator.style.display = 'block'; this.scrollToBottom(); }
    hideTypingIndicator() { this.elements.typingIndicator.style.display = 'none'; }
    updateChatTitle() { if (this.elements.chatTitle) this.elements.chatTitle.querySelector('span').textContent = this.currentChatTitle; }
    handleFileSelection(e) { /* Lógica de arquivos omitida por simplicidade */ this.updateFilePreview(); }
    updateFilePreview() { /* Lógica de arquivos omitida */ }
    removeAllFiles() { this.attachedFiles = []; this.updateFilePreview(); }
    getModelDisplayName(model) { return { 'gemini-1.5-pro-latest': 'Gemini 1.5 Pro', 'gemini-1.5-flash-latest': 'Gemini 1.5 Flash' }[model] || model; }
    updateModelInfo() { /* Lógica de info omitida */ }
    formatText(text) {
        // Enhanced formatting that preserves RPG classes from AI responses
        if (text.includes('<div class="rpg-')) {
            // If the text already contains RPG formatting, preserve it
            return text.replace(/\n(?![^<]*>)/g, '<br>');
        }

        // Otherwise, apply basic HTML escaping and line breaks
        return text.replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\n/g, '<br>');
    }
}

// --- Global Initialization ---
let geminiChat;
document.addEventListener('DOMContentLoaded', () => {
    geminiChat = new GeminiChat();
    window.geminiChat = geminiChat; // Para debug via console
});