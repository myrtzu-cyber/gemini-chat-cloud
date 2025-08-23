// Mobile Script para Mestre Gemini - Versão Mobile
class GeminiChatMobile {
    constructor() {
        // Sistema de múltiplas API Keys
        this.apiKeys = {
            key1: localStorage.getItem('gemini_api_key1') || '',
            key2: localStorage.getItem('gemini_api_key2') || '',
            key3: localStorage.getItem('gemini_api_key3') || '',
            key4: localStorage.getItem('gemini_api_key4') || ''
        };
        this.activeApiKey = localStorage.getItem('active_api_key') || 'key1';
        this.selectedModel = localStorage.getItem('selected_model') || 'gemini-2.5-pro';
        this.serverUrl = localStorage.getItem('server_url') || '';

        // Automatic key rotation settings
        this.autoKeyRotation = localStorage.getItem('auto_key_rotation') === 'true';
        this.keyRotationInProgress = false;
        
        // Sistema de estatísticas
        this.statistics = this.loadStatistics();
        
        this.currentChatId = null;
        this.messages = [];
        this.isTyping = false;
        this.attachedFiles = [];
        this.chats = []; // Armazenar a lista de conversas
        this.chatMessages = document.getElementById('mobileMessages');

        // Propriedades para o Modal de Contexto
        this.currentChatContext = {};
        this.activeContextTab = 'master_rules';
        
        // Sistema de Logs
        this.logs = [];
        this.maxLogs = 1000; // Máximo de logs armazenados
        this.logStats = {
            total: 0,
            error: 0,
            warning: 0,
            info: 0,
            debug: 0
        };
        this.currentLogFilter = 'all';
        
        this.init();
    }

    async init() {
        this.bindEvents();

        // Ocultar botões de exclusão ao clicar fora
        document.getElementById('mobileMessages').addEventListener('click', (e) => {
            if (!e.target.closest('.mobile-message-delete')) {
                document.querySelectorAll('.mobile-message.delete-visible').forEach(el => {
                    el.classList.remove('delete-visible');
                });
            }
        });

        // Usar config.js se disponível, senão usar auto-detecção
        if (window.appConfig) {
            console.log('🔧 Usando AppConfig para configuração de servidor');
            this.serverUrl = window.appConfig.apiBaseUrl;
            localStorage.setItem('server_url', this.serverUrl);
            console.log(`✅ Servidor configurado via AppConfig: ${this.serverUrl}`);
        } else {
            console.log('⚠️ AppConfig não encontrado, usando auto-detecção');
            await this.autoDetectServer();
        }

        this.loadSettings();
        this.registerServiceWorker();
        this.setupTextareaAutoResize();
        this.setupFullscreen();

        // Load pending messages from previous session
        this.restorePendingMessages();

        // Carregar última conversa automaticamente após inicialização
        await this.loadLastChat();
    }

    // Restore pending messages from localStorage on app start
    restorePendingMessages() {
        const pendingMessages = this.loadPendingMessages();
        if (pendingMessages.length > 0) {
            console.log(`[DEBUG] Restored ${pendingMessages.length} pending messages`);

            // Add pending messages to current messages if not already present
            pendingMessages.forEach(pendingMsg => {
                const existingIndex = this.messages.findIndex(msg => msg.id === pendingMsg.id);
                if (existingIndex === -1) {
                    this.messages.push(pendingMsg);
                }
            });

            this.showToast(`📝 ${pendingMessages.length} mensagem(ns) pendente(s) restaurada(s)`, 'info');
        }
    }

    // Configurar modo fullscreen
    setupFullscreen() {
        // Detectar quando o app é instalado como PWA
        window.addEventListener('beforeinstallprompt', (e) => {
            e.preventDefault();
            this.deferredPrompt = e;
        });

        // Ocultar barra de endereço no mobile
        window.addEventListener('load', () => {
            setTimeout(() => {
                window.scrollTo(0, 1);
            }, 100);
        });

        // Prevenir zoom no double tap
        let lastTouchEnd = 0;
        document.addEventListener('touchend', (event) => {
            const now = (new Date()).getTime();
            if (now - lastTouchEnd <= 300) {
                event.preventDefault();
            }
            lastTouchEnd = now;
        }, false);

        // Ajustar viewport para fullscreen
        this.adjustViewportForFullscreen();
        
        // Listener para mudanças de orientação
        window.addEventListener('orientationchange', () => {
            setTimeout(() => {
                this.adjustViewportForFullscreen();
            }, 500);
        });

        // Listener para resize
        window.addEventListener('resize', () => {
            this.adjustViewportForFullscreen();
        });
    }

    // Ajustar viewport para modo fullscreen
    adjustViewportForFullscreen() {
        // Forçar altura total da tela
        const vh = window.innerHeight * 0.01;
        document.documentElement.style.setProperty('--vh', `${vh}px`);
        
        // Ocultar barra de endereço se possível
        if (window.navigator.standalone || window.matchMedia('(display-mode: fullscreen)').matches) {
            document.body.style.paddingTop = '0px';
        }
        
        // Ajustar para notch/safe areas em dispositivos modernos
        if (CSS.supports('padding: env(safe-area-inset-top)')) {
            document.body.classList.add('has-safe-areas');
        }
    }

    // Registrar Service Worker para PWA
    registerServiceWorker() {
        if ('serviceWorker' in navigator && location.protocol === 'https:') {
            navigator.serviceWorker.register('/sw.js')
                .then(registration => {
                    console.log('SW registrado:', registration);
                })
                .catch(error => {
                    console.log('Erro no SW (ignorado em desenvolvimento):', error);
                });
        } else {
            console.log('Service Worker desabilitado (HTTP ou não suportado)');
        }
    }

    // Bind de eventos
    bindEvents() {
        // Configurações
        document.getElementById('settingsBtn').addEventListener('click', () => {
            this.showSettings();
        });

        document.getElementById('closeSettings').addEventListener('click', () => {
            this.hideSettings();
        });

        document.getElementById('saveMobileApiKey').addEventListener('click', async () => {
            await this.saveSettings();
        });

        document.getElementById('testConnection').addEventListener('click', async () => {
            await this.testServerConnection();
        });

        // Chat controls
        document.getElementById('mobileNewChat').addEventListener('click', async () => {
            await this.newChat();
        });

        document.getElementById('mobileLoadChats').addEventListener('click', () => {
            this.showChatsModal();
        });

        document.getElementById('closeMobileModal').addEventListener('click', () => {
            this.hideChatsModal();
        });

        // Input e envio
        const messageInput = document.getElementById('mobileMessageInput');
        const sendBtn = document.getElementById('mobileSendBtn');

        messageInput.addEventListener('input', () => {
            this.toggleSendButton();
        });

        // Removido o comportamento de envio com Enter
        // Agora Enter apenas quebra linha (comportamento padrão do textarea)

        sendBtn.addEventListener('click', () => {
            this.sendMessage();
        });

        // Anexos
        document.getElementById('mobileAttachBtn').addEventListener('click', () => {
            document.getElementById('mobileFileInput').click();
        });

        document.getElementById('mobileFileInput').addEventListener('change', (e) => {
            this.handleFileSelection(e);
        });

        document.getElementById('clearMobileFiles').addEventListener('click', () => {
            this.clearAttachedFiles();
        });

        // Model selection
        document.getElementById('mobileModelSelect').addEventListener('change', (e) => {
            this.selectedModel = e.target.value;
            localStorage.setItem('selected_model', this.selectedModel);
        });

        // API Delay selection
        document.getElementById('apiDelaySelect').addEventListener('change', () => {
            this.saveApiDelaySetting();
        });

        // Auto Key Rotation toggle
        document.getElementById('autoKeyRotationToggle').addEventListener('change', (e) => {
            this.autoKeyRotation = e.target.checked;
            localStorage.setItem('auto_key_rotation', this.autoKeyRotation.toString());
            console.log(`[Key Rotation] Auto rotation ${this.autoKeyRotation ? 'enabled' : 'disabled'}`);
            this.showToast(`🔄 Rotação automática ${this.autoKeyRotation ? 'ativada' : 'desativada'}`);
        });

        // Individual tab update button
        document.getElementById('updateCurrentTabBtn').addEventListener('click', () => {
            this.showIndividualTabUpdateConfirmation();
        });

        // Individual tab update confirmation
        document.getElementById('confirmIndividualUpdate').addEventListener('click', () => {
            this.confirmIndividualTabUpdate();
        });

        document.getElementById('cancelIndividualUpdate').addEventListener('click', () => {
            this.hideIndividualTabModal();
        });
        
        // Active API Key selection
        document.getElementById('activeApiKeySelect').addEventListener('change', (e) => {
            this.activeApiKey = e.target.value;
            localStorage.setItem('active_api_key', this.activeApiKey);
            this.updateApiKeyInput();
            this.updateStatisticsDisplay();
        });

        // Fechar modais ao clicar fora
        document.getElementById('settingsModal').addEventListener('click', (e) => {
            if (e.target.id === 'settingsModal') {
                this.hideSettings();
            }
        });

        document.getElementById('mobileChatsModal').addEventListener('click', (e) => {
            if (e.target.id === 'mobileChatsModal') {
                this.hideChatsModal();
            }
        });

        // --- Eventos do Modal de Contexto ---
        const contextModal = document.getElementById('contextModal');
        document.getElementById('openContextBtn').addEventListener('click', () => {
            this.showContextModal();
        });

        document.getElementById('closeContextModal').addEventListener('click', () => {
            contextModal.style.display = 'none';
        });

        document.querySelector('.context-tabs').addEventListener('click', (e) => {
            if (e.target.classList.contains('context-tab-btn')) {
                // Salva o texto atual no objeto de contexto antes de trocar
                this.currentChatContext[this.activeContextTab] = document.getElementById('contextTextArea').value;

                // Atualiza a aba ativa
                document.querySelector('.context-tab-btn.active').classList.remove('active');
                e.target.classList.add('active');
                this.activeContextTab = e.target.dataset.context;

                // Carrega o texto da nova aba
                const contextTextArea = document.getElementById('contextTextArea');
                contextTextArea.value = this.currentChatContext[this.activeContextTab] || '';
                contextTextArea.placeholder = `Adicione o contexto para ${e.target.textContent}...`;

                // Show/hide individual tab update controls
                this.updateIndividualTabControls();
            }
        });

        document.getElementById('saveContextBtn').addEventListener('click', () => {
            this.saveContext();
        });

        // Comprimir histórico
        document.getElementById('compressHistoryBtn').addEventListener('click', () => {
            this.compressHistory();
        });

        // Limpar mensagens antigas (novo botão)
        document.getElementById('clearOldMessages').addEventListener('click', () => {
            this.clearOldMessages();
        });

        // Debug aventura (botão de debug)
        document.getElementById('debugAventuraBtn').addEventListener('click', () => {
            this.debugAventura();
        });

        // Settings tabs
        document.querySelector('.settings-tabs').addEventListener('click', (e) => {
            if (e.target.classList.contains('settings-tab-btn')) {
                this.switchSettingsTab(e.target.dataset.tab);
            }
        });

        // Logs controls
        document.getElementById('logLevelFilter').addEventListener('change', (e) => {
            this.filterLogs(e.target.value);
        });

        document.getElementById('clearLogs').addEventListener('click', () => {
            this.clearLogs();
        });

        document.getElementById('exportLogs').addEventListener('click', () => {
            this.exportLogs();
        });
    }


    // --- Métodos do Modal de Contexto ---
    showContextModal() {
        if (!this.currentChatId) {
            this.showToast('Nenhuma conversa ativa. Crie uma nova conversa primeiro.');
            return;
        }
        this.loadContextIntoModal();
        document.getElementById('contextModal').style.display = 'flex';
    }

    loadContextIntoModal() {
        // Garante que a primeira aba esteja ativa
        this.activeContextTab = 'master_rules';
        document.querySelectorAll('.context-tab-btn').forEach(btn => btn.classList.remove('active'));
        const firstTab = document.querySelector('.context-tab-btn[data-context="master_rules"]');
        if (firstTab) firstTab.classList.add('active');

        const contextTextArea = document.getElementById('contextTextArea');
        contextTextArea.value = this.currentChatContext.master_rules || '';
        contextTextArea.placeholder = `Adicione o contexto para Regras do Mestre...`;

        // Update individual tab controls
        this.updateIndividualTabControls();
    }

    async saveContext() {
        if (!this.currentChatId) return;

        const contextTextArea = document.getElementById('contextTextArea');
        // Salva o texto da aba ativa no objeto de contexto
        this.currentChatContext[this.activeContextTab] = contextTextArea.value;

        try {
            // Ensure chat exists in database before saving context
            console.log(`[DEBUG] Ensuring chat ${this.currentChatId} exists before saving context`);
            const chatExists = await this.ensureChatExists();

            if (!chatExists) {
                throw new Error('Falha ao criar conversa no banco de dados.');
            }

            console.log(`[DEBUG] Saving context for chat ${this.currentChatId}:`, this.currentChatContext);

            const response = await fetch(`${this.serverUrl}/api/chats/${this.currentChatId}/context`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(this.currentChatContext)
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error(`[DEBUG] Context save failed: ${response.status} - ${errorText}`);
                throw new Error(`Falha ao salvar o contexto (${response.status}).`);
            }

            this.showToast('✅ Contexto salvo com sucesso!');
            document.getElementById('contextModal').style.display = 'none';
            console.log(`[DEBUG] Context saved successfully for chat ${this.currentChatId}`);
        } catch (error) {
            console.error('Erro ao salvar contexto:', error);
            this.showToast('❌ Erro ao salvar contexto: ' + error.message, 'error');
        }
    }

    // Salvar contextos atualizados no servidor após compressão
    async saveUpdatedContextToServer() {
        if (!this.currentChatId) return;

        try {
            // Ensure chat exists in database before saving context
            console.log(`[DEBUG] Ensuring chat ${this.currentChatId} exists before saving updated context`);
            const chatExists = await this.ensureChatExists();

            if (!chatExists) {
                throw new Error('Falha ao criar conversa no banco de dados.');
            }

            console.log('[DEBUG] Salvando contextos atualizados no servidor...');
            console.log('[DEBUG] Aventura content length:', this.currentChatContext.aventura?.length || 0);
            console.log('[DEBUG] Aventura content preview:', this.currentChatContext.aventura?.substring(0, 100) || '(empty)');
            console.log('[DEBUG] Full context object keys:', Object.keys(this.currentChatContext));

            const response = await fetch(`${this.serverUrl}/api/chats/${this.currentChatId}/context`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(this.currentChatContext)
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error('[DEBUG] Server response error:', response.status, errorText);
                throw new Error('Falha ao salvar contextos atualizados no servidor.');
            }

            const responseData = await response.json();
            console.log('[DEBUG] Server response:', responseData);
            console.log('[DEBUG] Contextos salvos no servidor com sucesso');
            return true;
        } catch (error) {
            console.error('Erro ao salvar contextos no servidor:', error);
            this.showToast('⚠️ Erro ao salvar contextos no servidor: ' + error.message, 'warning');
            return false;
        }
    }

    // Atualizar UI do contexto se o modal estiver aberto
    refreshContextModalIfOpen(skipSave = false) {
        const contextModal = document.getElementById('contextModal');
        if (contextModal && contextModal.style.display === 'flex') {
            console.log('[DEBUG] Atualizando UI do contexto após operação');

            const contextTextArea = document.getElementById('contextTextArea');

            // Only save current textarea content if not skipping save (to prevent overwriting new content)
            if (!skipSave && this.activeContextTab && contextTextArea) {
                console.log(`[DEBUG] Salvando conteúdo atual da aba ${this.activeContextTab} antes de atualizar`);
                this.currentChatContext[this.activeContextTab] = contextTextArea.value;
            } else if (skipSave) {
                console.log(`[DEBUG] Pulando salvamento para preservar conteúdo atualizado da aba ${this.activeContextTab}`);
            }

            // Atualizar o conteúdo da aba ativa
            if (contextTextArea && this.activeContextTab) {
                const newContent = this.currentChatContext[this.activeContextTab] || '';
                contextTextArea.value = newContent;
                console.log(`[DEBUG] Aba ${this.activeContextTab} atualizada com ${newContent.length} caracteres`);

                // Force textarea to refresh display and trigger any change events
                contextTextArea.dispatchEvent(new Event('input', { bubbles: true }));
                contextTextArea.dispatchEvent(new Event('change', { bubbles: true }));
            }

            this.showToast('📝 Contexto atualizado na interface!', 'info');
        }
    }

    getSystemInstruction() {
        const instructions = [];
        if (this.currentChatContext.master_rules) {
            instructions.push(`Regras do Mestre: ${this.currentChatContext.master_rules}`);
        }
        if (this.currentChatContext.character_sheet) {
            instructions.push(`Ficha de Personagem: ${this.currentChatContext.character_sheet}`);
        }
        if (this.currentChatContext.local_history) {
            instructions.push(`História Local: ${this.currentChatContext.local_history}`);
        }
        if (this.currentChatContext.aventura) {
            instructions.push(`A Aventura: ${this.currentChatContext.aventura}`);
        }
        if (this.currentChatContext.current_plot) {
            instructions.push(`Plot Atual: ${this.currentChatContext.current_plot}`);
        }
        if (this.currentChatContext.relations) {
            instructions.push(`Relações: ${this.currentChatContext.relations}`);
        }

        if (instructions.length > 0) {
            // Retorna apenas o texto para system_instruction da API Gemini
            return `[CONTEXTO DA AVENTURA]\n${instructions.join('\n\n')}`;
        }
        return null;
    }

    // Configurar auto-resize do textarea
    setupTextareaAutoResize() {
        const textarea = document.getElementById('mobileMessageInput');
        if (textarea) {
            textarea.addEventListener('input', () => {
                textarea.style.height = 'auto';
                textarea.style.height = Math.min(textarea.scrollHeight, 120) + 'px';
            });
        }
    }


    // Toggle botão de envio
    toggleSendButton() {
        const input = document.getElementById('mobileMessageInput');
        const sendBtn = document.getElementById('mobileSendBtn');
        
        if (!input || !sendBtn) {
            return;
        }
        
        const hasText = input.value.trim().length > 0;
        const hasFiles = this.attachedFiles.length > 0;
        
        sendBtn.disabled = !hasText && !hasFiles || this.isTyping;
    }

    // Carregar configurações
    loadSettings() {
        document.getElementById('activeApiKeySelect').value = this.activeApiKey;
        document.getElementById('mobileModelSelect').value = this.selectedModel;
        document.getElementById('serverUrlInput').value = this.serverUrl;

        // Load API delay setting
        this.loadApiDelaySetting();

        // Load auto key rotation setting
        this.loadAutoKeyRotationSetting();

        this.updateApiKeyInput();
        this.updateStatisticsDisplay();
        this.loadVersionInfo();

        // Mostrar status do servidor se já configurado
        if (this.serverUrl) {
            this.showToast(`🔗 Servidor: ${this.serverUrl}`);
        }
    }

    // Carregar informações da versão da aplicação
    loadVersionInfo() {
        console.log('[VERSION] Carregando informações da versão');
        
        // Informações básicas da aplicação
        const appName = "Mestre Gemini Mobile";
        const appVersion = "2.0.2";
        const buildDate = this.getBuildDate();

        console.log('[VERSION] Dados:', { appName, appVersion, buildDate });

        // Atualizar elementos na interface
        const appNameElement = document.getElementById('appName');
        const appVersionElement = document.getElementById('appVersion');
        const buildDateElement = document.getElementById('buildDate');

        if (appNameElement) {
            appNameElement.textContent = appName;
            console.log('[VERSION] Nome atualizado');
        }
        
        if (appVersionElement) {
            appVersionElement.textContent = appVersion;
            console.log('[VERSION] Versão atualizada');
        }
        
        if (buildDateElement) {
            buildDateElement.textContent = buildDate;
            console.log('[VERSION] Data de build atualizada');
        }

        // Inicializar sistema de logs
        this.initializeLoggingSystem();
    }

    // Obter data de build
    getBuildDate() {
        try {
            let buildDate = localStorage.getItem('app_build_date');
            
            if (!buildDate) {
                buildDate = new Date().toLocaleDateString('pt-BR', {
                    year: 'numeric',
                    month: '2-digit',
                    day: '2-digit'
                });
                localStorage.setItem('app_build_date', buildDate);
            }
            
            return buildDate;
        } catch (error) {
            console.log('Erro ao obter data de build:', error);
            return new Date().toLocaleDateString('pt-BR');
        }
    }

    // Mostrar configurações
    showSettings() {
        document.getElementById('settingsModal').style.display = 'flex';
        // Garantir que a aba geral esteja ativa por padrão
        this.switchSettingsTab('general');
    }

    // Esconder configurações
    hideSettings() {
        document.getElementById('settingsModal').style.display = 'none';
    }

    // Salvar configurações
    async saveSettings() {
        const apiKey = document.getElementById('mobileApiKeyInput').value.trim();
        const model = document.getElementById('mobileModelSelect').value;
        const serverUrl = document.getElementById('serverUrlInput').value.trim();
        
        if (apiKey) {
            this.apiKeys[this.activeApiKey] = apiKey;
            localStorage.setItem(`gemini_api_${this.activeApiKey}`, apiKey);
            console.log(`[API Key] Chave '${this.activeApiKey}' salva com o valor: ${apiKey.substring(0, 5)}...`);
        }
        
        if (serverUrl) {
            this.serverUrl = serverUrl;
            localStorage.setItem('server_url', serverUrl);
        }
        
        this.showToast('✅ Configurações salvas!');
        this.hideSettings();
        
        // Se mudou o servidor, testar automaticamente
        if (serverUrl && serverUrl !== this.serverUrl) {
            await this.testServerConnection();
        }
    }

    // Detecção automática do servidor
    async autoDetectServer() {
        // Verificar se está em produção (não localhost)
        const isProduction = window.location.hostname !== 'localhost' &&
                           window.location.hostname !== '127.0.0.1' &&
                           !window.location.hostname.includes('192.168.');

        // Em produção, usar a mesma URL da página atual
        if (isProduction) {
            this.serverUrl = window.location.origin;
            localStorage.setItem('server_url', this.serverUrl);
            console.log(`🌍 Produção detectada - usando: ${this.serverUrl}`);

            // Testar conexão com o servidor de produção
            try {
                const response = await fetch(`${this.serverUrl}/api/health`, {
                    method: 'GET',
                    headers: { 'Content-Type': 'application/json' },
                    signal: AbortSignal.timeout(5000)
                });

                if (response.ok) {
                    const data = await response.json();
                    console.log(`✅ Servidor de produção conectado: ${this.serverUrl}`, data);
                    this.showToast(`✅ Conectado ao servidor de produção`);
                    return true;
                } else {
                    console.error(`❌ Servidor de produção não responde: ${response.status}`);
                    this.showToast(`❌ Erro no servidor: ${response.status}`);
                    return false;
                }
            } catch (error) {
                console.error(`❌ Falha na conexão com servidor de produção:`, error);
                this.showToast(`❌ Falha na conexão: ${error.message}`);
                return false;
            }
        }

        // Desenvolvimento: usar lógica existente apenas se não há servidor configurado
        if (this.serverUrl) {
            console.log('Servidor já configurado:', this.serverUrl);
            return;
        }

        console.log('🔧 Modo desenvolvimento - detectando servidor local...');

        // Obter IP atual da página
        const currentHost = window.location.hostname;

        // Lista de IPs/hosts para testar (apenas em desenvolvimento)
        const hostsToTest = [
            currentHost, // IP atual da página
            'localhost',
            '127.0.0.1',
            '192.168.0.109', // IP detectado pelo servidor
            '192.168.1.1',
            '10.0.0.1'
        ];

        // Portas para testar (Python primeiro, depois Node.js)
        const portsToTest = [8000, 3000];

        for (const host of hostsToTest) {
            for (const port of portsToTest) {
                const protocol = window.location.protocol;
                const testUrl = `${protocol}//${host}:${port}`;
                console.log(`🔍 Testando: ${testUrl}`);

                try {
                    const response = await fetch(`${testUrl}/api/health`, {
                        method: 'GET',
                        headers: { 'Content-Type': 'application/json' },
                        signal: AbortSignal.timeout(3000) // 3 segundos timeout
                    });

                    if (response.ok) {
                        const data = await response.json();
                        this.serverUrl = testUrl;
                        localStorage.setItem('server_url', testUrl);
                        console.log(`✅ Servidor local detectado: ${testUrl}`, data);
                        this.showToast(`✅ Servidor detectado: ${host}:${port}`);
                        return true;
                    }
                } catch (e) {
                    // Continua testando próximo
                }
            }
        }

        console.log('❌ Nenhum servidor local detectado');
        this.showToast('⚠️ Configure o servidor manualmente');
        return false;
    }

    // Testar conexão com servidor
    async testServerConnection() {
        const serverUrl = document.getElementById('serverUrlInput').value.trim();
        if (!serverUrl) {
            this.showToast('⚠️ Por favor, insira o endereço do servidor.');
            return false;
        }

        console.log(`Testando conexão com: ${serverUrl}`);
        this.showToast(`Testando ${serverUrl}...`);

        try {
            const response = await fetch(`${serverUrl}/api/health`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json'
                },
                signal: AbortSignal.timeout(5000) // Timeout de 5 segundos
            });

            if (response.ok) {
                const data = await response.json();
                this.serverUrl = serverUrl;
                localStorage.setItem('server_url', serverUrl);
                this.showToast(`✅ Conectado ao servidor ${data.server}!`);
                console.log('Conexão bem-sucedida:', data);
                return true;
            } else {
                throw new Error(`Status: ${response.status}`);
            }
        } catch (error) {
            console.error('Erro ao testar conexão:', error.message);
            if (error.name === 'AbortError') {
                this.showToast('❌ Erro: A conexão demorou muito (timeout).');
            } else {
                this.showToast('❌ Falha na conexão. Verifique a URL e o firewall.');
            }
            return false;
        }
    }

    // Nova conversa
    async newChat() {
        this.currentChatId = this.generateChatId(); // Gera o ID imediatamente
        this.messages = [];
        this.clearMessages();
        this.currentChatTitle = 'Nova Conversa';
        document.getElementById('mobileChatTitle').textContent = this.currentChatTitle;

        // Limpar contexto ao criar nova conversa
        this.currentChatContext = {
            master_rules: '',
            character_sheet: '',
            local_history: '',
            current_plot: '',
            relations: '',
            aventura: '',
            lastCompressionTime: null
        };

        // Ensure the chat is immediately saved to database
        try {
            const chatCreated = await this.ensureChatExists();
            if (chatCreated) {
                this.showToast('✅ Nova conversa criada. O contexto já pode ser editado.');
                console.log(`[DEBUG] New chat ${this.currentChatId} created and saved to database`);
            } else {
                this.showToast('⚠️ Nova conversa criada localmente. Será salva ao enviar primeira mensagem.');
                console.log(`[DEBUG] New chat ${this.currentChatId} created locally only`);
            }
        } catch (error) {
            console.error('[DEBUG] Error creating new chat:', error);
            this.showToast('⚠️ Nova conversa criada localmente. Será salva ao enviar primeira mensagem.');
        }
    }

    // Limpar mensagens
    clearMessages() {
        const messagesContainer = document.getElementById('mobileMessages');
        messagesContainer.innerHTML = '';
    }

    // === SISTEMA DE LOGS ===
    
    // Inicializar sistema de logs
    initializeLoggingSystem() {
        this.log('info', 'Sistema de logs inicializado');
        
        // Interceptar console.log, console.error, console.warn
        this.interceptConsole();
        
        // Interceptar erros globais
        this.interceptGlobalErrors();
        
        // Carregar logs salvos
        this.loadSavedLogs();
        
        // Atualizar display inicial
        this.updateLogsDisplay();
        this.updateLogStats();
    }
    
    // Interceptar métodos do console
    interceptConsole() {
        const originalLog = console.log;
        const originalError = console.error;
        const originalWarn = console.warn;
        const originalInfo = console.info;
        
        console.log = (...args) => {
            originalLog.apply(console, args);
            this.log('debug', args.join(' '));
        };
        
        console.error = (...args) => {
            originalError.apply(console, args);
            this.log('error', args.join(' '));
        };
        
        console.warn = (...args) => {
            originalWarn.apply(console, args);
            this.log('warning', args.join(' '));
        };
        
        console.info = (...args) => {
            originalInfo.apply(console, args);
            this.log('info', args.join(' '));
        };
    }
    
    // Interceptar erros globais
    interceptGlobalErrors() {
        window.addEventListener('error', (event) => {
            this.log('error', `Erro JavaScript: ${event.message} em ${event.filename}:${event.lineno}`);
        });
        
        window.addEventListener('unhandledrejection', (event) => {
            this.log('error', `Promise rejeitada: ${event.reason}`);
        });
    }
    
    // Adicionar log
    log(level, message, data = null) {
        const timestamp = new Date();
        const logEntry = {
            id: Date.now() + Math.random(),
            timestamp: timestamp,
            level: level,
            message: message,
            data: data
        };
        
        // Adicionar ao array de logs
        this.logs.unshift(logEntry);
        
        // Limitar número de logs
        if (this.logs.length > this.maxLogs) {
            this.logs = this.logs.slice(0, this.maxLogs);
        }
        
        // Atualizar estatísticas
        this.logStats.total++;
        this.logStats[level]++;
        
        // Salvar logs
        this.saveLogs();
        
        // Atualizar display se a aba de logs estiver ativa
        if (document.getElementById('logsTab').classList.contains('active')) {
            this.updateLogsDisplay();
            this.updateLogStats();
        }
        
        // Log crítico - mostrar toast
        if (level === 'error') {
            this.showToast(`🚨 Erro: ${message.substring(0, 50)}...`, 'error');
        }
    }
    
    // Alternar entre abas de configurações
    switchSettingsTab(tabName) {
        // Remover classe active de todas as abas
        document.querySelectorAll('.settings-tab-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelectorAll('.settings-tab-content').forEach(content => {
            content.classList.remove('active');
        });
        
        // Ativar aba selecionada
        document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
        document.getElementById(`${tabName}Tab`).classList.add('active');
        
        // Se mudou para aba de logs, atualizar display
        if (tabName === 'logs') {
            this.updateLogsDisplay();
            this.updateLogStats();
        }
    }
    
    // Atualizar display de logs
    updateLogsDisplay() {
        const logsDisplay = document.getElementById('logsDisplay');
        if (!logsDisplay) return;
        
        // Filtrar logs baseado no filtro atual
        let filteredLogs = this.logs;
        if (this.currentLogFilter !== 'all') {
            filteredLogs = this.logs.filter(log => log.level === this.currentLogFilter);
        }
        
        // Limitar a 100 logs mais recentes para performance
        const displayLogs = filteredLogs.slice(0, 100);
        
        logsDisplay.innerHTML = displayLogs.map(log => {
            const timeStr = log.timestamp.toLocaleTimeString('pt-BR');
            return `
                <div class="log-entry ${log.level}">
                    <span class="log-timestamp">[${timeStr}]</span>
                    <span class="log-level ${log.level}">${log.level.toUpperCase()}</span>
                    <span class="log-message">${this.escapeHtml(log.message)}</span>
                </div>
            `;
        }).join('');
        
        // Auto-scroll para o topo (logs mais recentes)
        logsDisplay.scrollTop = 0;
    }
    
    // Atualizar estatísticas de logs
    updateLogStats() {
        document.getElementById('totalLogs').textContent = this.logStats.total;
        document.getElementById('errorLogs').textContent = this.logStats.error;
        document.getElementById('warningLogs').textContent = this.logStats.warning;
    }
    
    // Filtrar logs
    filterLogs(level) {
        this.currentLogFilter = level;
        this.updateLogsDisplay();
    }
    
    // Limpar logs
    clearLogs() {
        if (confirm('Tem certeza que deseja limpar todos os logs?')) {
            this.logs = [];
            this.logStats = {
                total: 0,
                error: 0,
                warning: 0,
                info: 0,
                debug: 0
            };
            
            localStorage.removeItem('gemini_mobile_logs');
            this.updateLogsDisplay();
            this.updateLogStats();
            
            this.log('info', 'Logs limpos pelo usuário');
            this.showToast('🗑️ Logs limpos com sucesso');
        }
    }
    
    // Exportar logs
    exportLogs() {
        try {
            const exportData = {
                timestamp: new Date().toISOString(),
                appVersion: '2.0.2',
                totalLogs: this.logs.length,
                logs: this.logs
            };
            
            const dataStr = JSON.stringify(exportData, null, 2);
            const dataBlob = new Blob([dataStr], { type: 'application/json' });
            
            const link = document.createElement('a');
            link.href = URL.createObjectURL(dataBlob);
            link.download = `gemini-mobile-logs-${new Date().toISOString().split('T')[0]}.json`;
            
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            
            this.log('info', `Logs exportados: ${this.logs.length} entradas`);
            this.showToast('📤 Logs exportados com sucesso');
        } catch (error) {
            this.log('error', `Erro ao exportar logs: ${error.message}`);
            this.showToast('❌ Erro ao exportar logs', 'error');
        }
    }
    
    // Salvar logs no localStorage
    saveLogs() {
        try {
            // Salvar apenas os últimos 500 logs para não sobrecarregar o localStorage
            const logsToSave = this.logs.slice(0, 500);
            localStorage.setItem('gemini_mobile_logs', JSON.stringify({
                logs: logsToSave,
                stats: this.logStats
            }));
        } catch (error) {
            console.error('Erro ao salvar logs:', error);
        }
    }
    
    // Carregar logs salvos
    loadSavedLogs() {
        try {
            const savedData = localStorage.getItem('gemini_mobile_logs');
            if (savedData) {
                const parsed = JSON.parse(savedData);
                this.logs = parsed.logs || [];
                this.logStats = parsed.stats || {
                    total: 0,
                    error: 0,
                    warning: 0,
                    info: 0,
                    debug: 0
                };
                
                // Converter timestamps de string para Date
                this.logs.forEach(log => {
                    if (typeof log.timestamp === 'string') {
                        log.timestamp = new Date(log.timestamp);
                    }
                });
            }
        } catch (error) {
            console.error('Erro ao carregar logs salvos:', error);
            this.logs = [];
        }
    }
    
    // Escapar HTML para segurança
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // Mostrar boas-vindas
    showWelcome() {
        const messagesContainer = document.getElementById('mobileMessages');
        messagesContainer.innerHTML = `
            <div class="mobile-welcome">
                <div class="welcome-icon">🐉</div>
                <h2>Bem-vindo!</h2>
                <p>Configure sua chave da API nas configurações e comece sua aventura!</p>
            </div>
        `;
    }

    // Atualizar título do chat
    updateChatTitle(title) {
        document.getElementById('mobileChatTitle').textContent = title;
    }

    // Enviar mensagem
    async sendMessage() {
        if (this.isTyping) return;

        const input = document.getElementById('mobileMessageInput');
        const message = input.value.trim();

        if (!message && this.attachedFiles.length === 0) return;

        const currentApiKey = this.apiKeys[this.activeApiKey];
        if (!currentApiKey) {
            this.showToast('❌ Configure sua chave da API primeiro');
            this.showSettings();
            return;
        }

        // Processar arquivos anexados para base64
        const processedFiles = [];
        if (this.attachedFiles.length > 0) {
            for (const file of this.attachedFiles) {
                try {
                    const base64Data = await this.fileToBase64(file.file);
                    processedFiles.push({
                        name: file.name,
                        type: file.type,
                        size: file.size,
                        base64Data: base64Data,
                        mimeType: file.type
                    });
                } catch (error) {
                    console.error('Erro ao processar arquivo:', file.name, error);
                    this.showToast(`❌ Erro ao processar ${file.name}`);
                }
            }
        }

        const userMessageId = this.generateMessageId();
        if (this.messages.length === 0) {
            this.clearMessages();
        }

        this.addMessageToUI('user', message, processedFiles, userMessageId, 'pending');

        input.value = '';
        if (input) {
            input.style.height = 'auto';
        }
        this.showTyping();

        try {
            // Mark user message as pending initially
            this.updateMessageStatus(userMessageId, 'pending');

            // Always use rotation-enabled API call for better error handling
            const response = await this.callGeminiAPIWithRotation(message, processedFiles);
            this.hideTyping();

            // Mark user message as sent and add to history
            this.updateMessageStatus(userMessageId, 'sent');
            this.messages.push({
                id: userMessageId,
                sender: 'user',
                content: message,
                files: processedFiles || [],
                status: 'sent',
                retryCount: 0,
                timestamp: Date.now()
            });

            const assistantMessageId = this.addMessageToHistory('assistant', response);
            this.addMessageToUI('assistant', response, [], assistantMessageId, 'sent');

            this.clearAttachedFiles();
            
            console.log('[CHAT-DEBUG] ========== ANTES autoSaveChat ==========');
            console.log('[CHAT-DEBUG] currentChatId antes do save:', this.currentChatId);
            
            await this.autoSaveChat();
            
            console.log('[CHAT-DEBUG] ========== DEPOIS autoSaveChat ==========');
            console.log('[CHAT-DEBUG] currentChatId depois do save:', this.currentChatId);

        } catch (error) {
            this.hideTyping();
            const errorInfo = this.categorizeError(error);

            // Mark user message as failed and store error
            this.updateMessageStatus(userMessageId, 'failed', errorInfo.message);
            this.messages.push({
                id: userMessageId,
                sender: 'user',
                content: message,
                files: processedFiles || [],
                status: 'failed',
                retryCount: 0,
                errorMessage: errorInfo.message,
                errorType: errorInfo.type,
                timestamp: Date.now()
            });

            this.showToast(`❌ ${errorInfo.userMessage}`, 'error');

            // Save the failed message to localStorage for persistence
            this.savePendingMessages();
        }
    }

    async autoSaveChat() {
        console.log('[CHAT-DEBUG] ========== INÍCIO autoSaveChat ==========');
        console.log('[CHAT-DEBUG] serverUrl:', this.serverUrl);
        console.log('[CHAT-DEBUG] currentChatId:', this.currentChatId);
        console.log('[CHAT-DEBUG] Tipo currentChatId:', typeof this.currentChatId);
        console.log('[CHAT-DEBUG] Número de mensagens:', this.messages.length);
        
        if (!this.serverUrl) {
            console.log('[CHAT-DEBUG] ❌ Saindo: sem serverUrl');
            return;
        }
        if (this.messages.length === 0) {
            console.log('[CHAT-DEBUG] ❌ Saindo: sem mensagens');
            return;
        }

        // Se não houver ID de chat, a conversa é nova. O salvamento inicial vai criar um.
        if (!this.currentChatId) {
            this.currentChatId = this.generateChatId();
        }

        // Only save messages that are not pending or failed
        const messagesToSave = this.messages.filter(msg =>
            msg.status !== 'pending' && msg.status !== 'failed'
        );

        const chatData = {
            id: this.currentChatId,
            title: this.currentChatTitle || 'Nova Conversa',
            model: this.selectedModel,
            messages: messagesToSave,
            context: this.currentChatContext
        };

        try {
            const response = await fetch(`${this.serverUrl}/api/chats`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(chatData)
            });

            if (response.ok) {
                const result = await response.json();
                console.log('[CHAT-DEBUG] ========== RESPOSTA DO SERVIDOR ==========');
                console.log('[CHAT-DEBUG] Resposta completa:', result);
                console.log('[CHAT-DEBUG] result.chatId:', result.chatId);
                console.log('[CHAT-DEBUG] Tipo de result.chatId:', typeof result.chatId);
                console.log('[CHAT-DEBUG] currentChatId ANTES:', this.currentChatId);
                
                // O servidor retorna 'chatId', não 'id'
                if (result.chatId) {
                    this.currentChatId = result.chatId; // Garante que temos o ID mais recente
                    console.log('[CHAT-DEBUG] ✅ Conversa salva com sucesso:', result.chatId);
                    console.log('[CHAT-DEBUG] currentChatId DEPOIS:', this.currentChatId);
                } else {
                    console.warn('[CHAT-DEBUG] ⚠️ Servidor não retornou chatId válido!');
                    console.warn('[CHAT-DEBUG] Mantendo currentChatId atual:', this.currentChatId);
                }

                // Atualiza todos os indicadores pendentes para 'salvo'
                const pendingElements = document.querySelectorAll('.mobile-message .message-status.pending');
                console.log(`[DEBUG] Encontrados ${pendingElements.length} elementos pendentes`);
                pendingElements.forEach(el => {
                    console.log(`[DEBUG] Atualizando status para 'salvo' do elemento:`, el);
                    el.classList.remove('pending');
                    el.classList.add('saved');
                    // Força uma atualização visual
                    el.style.display = 'none';
                    el.offsetHeight; // Trigger reflow
                    el.style.display = '';
                });

                // Update pending messages in localStorage
                this.savePendingMessages();
            } else {
                throw new Error(`Falha no servidor: ${response.statusText}`);
            }
        } catch (error) {
            console.error('Erro no salvamento automático:', error);
            this.showToast('❌ Falha ao salvar a conversa.', 'error');

            // Atualiza todos os indicadores pendentes para 'erro'
            document.querySelectorAll('.message-status.pending').forEach(el => {
                el.classList.remove('pending');
                el.classList.add('error');
                el.innerHTML = '<i class="fas fa-exclamation-triangle"></i>';
            });

            // Save pending messages even if server save fails
            this.savePendingMessages();
        }
    }

    // Gerar ID único para mensagens
    generateMessageId() {
        return 'msg_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    // Gerar ID único para conversa
    generateChatId() {
        return 'chat_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    // Ensure chat exists in database before operations
    async ensureChatExists() {
        if (!this.serverUrl) return false;
        if (!this.currentChatId) {
            this.currentChatId = this.generateChatId();
        }

        try {
            // Check if chat already exists
            const checkResponse = await fetch(`${this.serverUrl}/api/chats/${this.currentChatId}`);

            if (checkResponse.ok) {
                console.log(`[DEBUG] Chat ${this.currentChatId} already exists in database`);
                return true;
            }

            // Chat doesn't exist, create it
            console.log(`[DEBUG] Creating new chat ${this.currentChatId} in database`);

            const chatData = {
                id: this.currentChatId,
                title: this.currentChatTitle || 'Nova Conversa',
                model: this.selectedModel,
                messages: this.messages || [],
                context: this.currentChatContext || {}
            };

            const createResponse = await fetch(`${this.serverUrl}/api/chats`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(chatData)
            });

            if (createResponse.ok) {
                const result = await createResponse.json();
                console.log(`[DEBUG] Chat created successfully: ${result.id}`);
                return true;
            } else {
                console.error(`[DEBUG] Failed to create chat: ${createResponse.status}`);
                return false;
            }

        } catch (error) {
            console.error('[DEBUG] Error ensuring chat exists:', error);
            return false;
        }
    }

    // Chamar API Gemini com o modelo selecionado (sem fallback automático)
    async callGeminiAPIForCompression(message, files = []) {
        const model = this.selectedModel;
        console.log(`[DEBUG] callGeminiAPIForCompression iniciado - modelo selecionado: ${model}`);

        try {
            console.log(`[DEBUG] Tentando compressão com ${model}`);
            this.showToast(`🔄 Comprimindo com ${this.getModelDisplayName(model)}...`, 'info');

            const result = await this.callGeminiAPI(message, files);

            console.log(`[DEBUG] Sucesso com ${model}`);
            return result;

        } catch (error) {
            console.error(`[DEBUG] Erro com ${model}:`, error);

            // Detectar tipo de erro para melhor orientação
            const isQuotaError = error.message.includes('quota') || error.message.includes('429');
            const isLargePromptError = error.message.includes('processou a requisição mas não retornou conteúdo') ||
                                     error.message.includes('prompts muito longos');

            let errorType = 'ERRO TÉCNICO';
            if (isQuotaError) errorType = 'QUOTA EXCEDIDA';
            else if (isLargePromptError) errorType = 'PROMPT MUITO LONGO';

            let errorMessage = `❌ A compressão com ${this.getModelDisplayName(model)} falhou.\n\n`;
            errorMessage += `Tipo: ${errorType}\n`;
            errorMessage += `Erro: ${error.message}\n\n`;

            if (isQuotaError) {
                errorMessage += `💡 DICA: Você atingiu o limite de uso da API.\n`;
                errorMessage += `Aguarde alguns minutos ou use uma API key diferente.\n\n`;
            } else if (isLargePromptError) {
                errorMessage += `💡 DICA: O histórico da conversa é muito longo para este modelo.\n`;
                if (model.includes('2.5-pro')) {
                    errorMessage += `Tente usar o Gemini 2.5 Flash nas configurações.\n\n`;
                } else {
                    errorMessage += `Tente reduzir o número de mensagens ou usar um modelo diferente.\n\n`;
                }
            }

            errorMessage += `Para tentar novamente, altere o modelo nas configurações e tente novamente.`;

            // Mostrar erro sem fallback automático
            this.showToast(errorMessage, 'error');
            throw error;
        }
    }



    // Comprimir histórico de conversas
    async compressConversationHistory() {
        if (this.messages.length === 0) {
            this.showToast('Não há histórico para comprimir.', 'warning');
            return null;
        }

        if (this.messages.length < 15) {
            this.showToast('Histórico muito curto para compressão. Mínimo de 15 mensagens necessário (para manter 10 recentes).', 'warning');
            return null;
        }

        try {
            this.showToast('🔄 Comprimindo histórico...', 'info');

            // Preparar mensagens para compressão (excluir as últimas 10 para manter contexto recente)
            const messagesToCompress = this.messages.slice(0, -10);
            const recentMessages = this.messages.slice(-10);

            // Construir prompt para compressão com contexto adicional
            const conversationText = messagesToCompress.map(msg => {
                const role = msg.sender === 'user' ? 'Jogador' : 'Mestre';
                return `${role}: ${msg.content}`;
            }).join('\n\n');

            // Verificar tamanho do prompt para detectar possíveis problemas
            const estimatedTokens = this.estimateTokens(conversationText);
            console.log(`[DEBUG] Tamanho estimado do prompt: ${estimatedTokens} tokens`);
            console.log(`[DEBUG] Número de mensagens para comprimir: ${messagesToCompress.length}`);

            if (estimatedTokens > 90000) {
                console.warn(`[DEBUG] AVISO: Prompt muito longo (${estimatedTokens} tokens). Gemini 2.5 Pro pode falhar.`);
                this.showToast(`⚠️ Prompt muito longo (${estimatedTokens} tokens). Recomendado usar Gemini 2.5 Flash.`, 'warning');
            }

            // Incluir contexto relevante (excluindo master_rules e local_history)
            const contextInfo = [];
            if (this.currentChatContext.character_sheet && this.currentChatContext.character_sheet.trim()) {
                contextInfo.push(`FICHA DE PERSONAGEM ATUAL:\n${this.currentChatContext.character_sheet}`);
            }
            if (this.currentChatContext.relations && this.currentChatContext.relations.trim()) {
                contextInfo.push(`RELAÇÕES ATUAIS:\n${this.currentChatContext.relations}`);
            }
            if (this.currentChatContext.aventura && this.currentChatContext.aventura.trim()) {
                contextInfo.push(`AVENTURA COMPLETA:\n${this.currentChatContext.aventura}`);
            }
            if (this.currentChatContext.current_plot && this.currentChatContext.current_plot.trim()) {
                contextInfo.push(`PLOT ATUAL:\n${this.currentChatContext.current_plot}`);
            }

            const contextSection = contextInfo.length > 0 ?
                `\n\nCONTEXTO ADICIONAL:\n${contextInfo.join('\n\n')}\n\n` : '\n\n';

            const compressionPrompt = `Por favor, analise a seguinte conversa de RPG junto com o contexto adicional e crie um resumo conciso mas abrangente, preservando:

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

Mantenha o resumo em português e organize-o de forma clara e cronológica. Foque no que é essencial para continuar a aventura, integrando as informações do contexto com os eventos da conversa.

CONVERSA A RESUMIR:
${conversationText}${contextSection}RESUMO COMPRIMIDO:`;

            // Chamar API para compressão com o modelo selecionado
            const compressedSummary = await this.callGeminiAPIForCompression(compressionPrompt, []);

            // Criar objeto de histórico comprimido
            const compressedHistory = {
                originalMessageCount: messagesToCompress.length,
                compressedAt: new Date().toISOString(),
                summary: compressedSummary,
                recentMessages: recentMessages
            };

            this.showToast('✅ Histórico comprimido com sucesso!', 'success');
            return compressedHistory;

        } catch (error) {
            console.error('Erro ao comprimir histórico:', error);
            this.showToast('❌ Erro ao comprimir histórico: ' + error.message, 'error');
            return null;
        }
    }

    // Salvar histórico comprimido no contexto
    async saveCompressedHistoryToContext(compressedHistory) {
        if (!compressedHistory || !this.currentChatId) {
            return false;
        }

        try {
            // Adicionar ao contexto de história local
            const existingHistory = this.currentChatContext.local_history || '';
            const timestamp = new Date().toLocaleString('pt-BR');

            const newHistoryEntry = `\n\n=== HISTÓRICO COMPRIMIDO (${timestamp}) ===\n` +
                                  `Mensagens originais: ${compressedHistory.originalMessageCount}\n` +
                                  `${compressedHistory.summary}\n` +
                                  `=== FIM DO HISTÓRICO COMPRIMIDO ===`;

            this.currentChatContext.local_history = existingHistory + newHistoryEntry;

            // Salvar contexto atualizado
            const response = await fetch(`${this.serverUrl}/api/chats/${this.currentChatId}/context`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(this.currentChatContext)
            });

            if (!response.ok) {
                throw new Error('Falha ao salvar contexto comprimido.');
            }

            return true;
        } catch (error) {
            console.error('Erro ao salvar histórico comprimido:', error);
            this.showToast('❌ Erro ao salvar contexto: ' + error.message, 'error');
            return false;
        }
    }

    // Limpar histórico original (manter apenas mensagens recentes)
    clearOriginalHistory(compressedHistory) {
        if (!compressedHistory) return;

        // Manter apenas as mensagens recentes
        this.messages = compressedHistory.recentMessages || [];

        // Limpar UI
        this.clearMessages();

        // Recriar UI com mensagens recentes
        this.messages.forEach(msg => {
            this.addMessageToUI(msg.sender, msg.content, msg.files || [], msg.id, msg.status || 'sent');
        });

        this.showToast('🧹 Histórico original limpo. Mantidas apenas mensagens recentes.', 'success');
    }

    // Atualizar contextos com confirmação manual - VERSÃO MANUAL COM ISOLAMENTO
    async updateContextsAfterCompression(compressedSummary) {
        try {
            console.log('[DEBUG] Iniciando atualização manual de contextos com isolamento...');

            // STEP 1: Create automatic backup before any changes
            console.log('[DEBUG] Criando backup automático dos contextos...');
            const backupSuccess = await this.createContextBackup();
            if (!backupSuccess) {
                console.warn('[DEBUG] Backup falhou, mas continuando com a compressão...');
            }

            // STEP 2: Capture original context snapshot for isolation
            console.log('[DEBUG] Capturando snapshot do contexto original...');
            const originalContext = this.captureOriginalContext();
            console.log('[DEBUG] Contexto original capturado:', {
                character_sheet: originalContext.character_sheet.length + ' chars',
                relations: originalContext.relations.length + ' chars',
                current_plot: originalContext.current_plot.length + ' chars',
                aventura: originalContext.aventura.length + ' chars'
            });

            // STEP 3: Store context for manual processing
            this.manualProcessingData = {
                compressedSummary,
                originalContext,
                tabsToProcess: [
                    {
                        key: 'character_sheet',
                        name: 'Ficha de Personagem',
                        description: 'Atualizar ficha de personagem com base no resumo da aventura'
                    },
                    {
                        key: 'relations',
                        name: 'Relações',
                        description: 'Atualizar mapa de relações com personagens e facções'
                    },
                    {
                        key: 'current_plot',
                        name: 'Plot Atual',
                        description: 'Atualizar objetivos e tramas em andamento'
                    },
                    {
                        key: 'aventura',
                        name: 'A Aventura',
                        description: 'Atualizar narrativa histórica da aventura'
                    }
                ],
                currentTabIndex: 0,
                processedTabs: [],
                failedTabs: [],
                skippedTabs: []
            };

            // STEP 4: Show progress display and start manual confirmation flow
            this.showProgressDisplay();
            this.updateProgress(0, this.manualProcessingData.tabsToProcess.length, 'Aguardando confirmação do usuário...');

            // STEP 5: Start manual confirmation flow
            await this.startManualTabConfirmation();

            return true; // Manual process started successfully

        } catch (error) {
            console.error('Erro no início do processamento manual de contextos:', error);
            this.hideProgressDisplay();
            this.showToast('❌ Erro ao iniciar processamento manual: ' + error.message, 'error');
            return false;
        }
    }

    // === HELPER FUNCTIONS FOR SEQUENTIAL PROCESSING ===

    // Create automatic backup of all context tabs before compression
    async createContextBackup() {
        try {
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
            const chatId = this.currentChatId || 'unknown';
            const backupFilename = `context_backup_${chatId}_${timestamp}.txt`;

            // Create comprehensive backup content
            const backupContent = this.generateBackupContent(timestamp);

            // Create and download backup file
            const blob = new Blob([backupContent], { type: 'text/plain;charset=utf-8' });
            const url = URL.createObjectURL(blob);

            // Create temporary download link
            const downloadLink = document.createElement('a');
            downloadLink.href = url;
            downloadLink.download = backupFilename;
            downloadLink.style.display = 'none';

            // Trigger download
            document.body.appendChild(downloadLink);
            downloadLink.click();
            document.body.removeChild(downloadLink);

            // Clean up URL
            URL.revokeObjectURL(url);

            console.log(`[DEBUG] Backup criado: ${backupFilename}`);
            this.showToast(`💾 Backup criado: ${backupFilename}`, 'info');

            return true;
        } catch (error) {
            console.error('[DEBUG] Erro ao criar backup:', error);
            this.showToast('⚠️ Erro ao criar backup de contexto', 'warning');
            return false;
        }
    }

    // Generate backup file content
    generateBackupContent(timestamp) {
        const chatTitle = this.currentChatTitle || 'Conversa sem título';
        const chatId = this.currentChatId || 'unknown';

        return `BACKUP DE CONTEXTO - GEMINI MOBILE CHAT
========================================

Data/Hora: ${new Date().toLocaleString('pt-BR')}
Chat ID: ${chatId}
Título da Conversa: ${chatTitle}
Timestamp: ${timestamp}

========================================
REGRAS DO MESTRE
========================================
${this.currentChatContext.master_rules || '(Vazio)'}

========================================
FICHA DE PERSONAGEM
========================================
${this.currentChatContext.character_sheet || '(Vazio)'}

========================================
RELAÇÕES
========================================
${this.currentChatContext.relations || '(Vazio)'}

========================================
PLOT ATUAL
========================================
${this.currentChatContext.current_plot || '(Vazio)'}

========================================
A AVENTURA
========================================
${this.currentChatContext.aventura || '(Vazio)'}

========================================
HISTÓRIA LOCAL
========================================
${this.currentChatContext.local_history || '(Vazio)'}

========================================
INFORMAÇÕES TÉCNICAS
========================================
Total de mensagens: ${this.messages.length}
Última compressão: ${this.currentChatContext.lastCompressionTime || 'Nunca'}
Modelo selecionado: ${this.selectedModel}

========================================
FIM DO BACKUP
========================================`;
    }

    // Capture original context snapshot before processing
    captureOriginalContext() {
        return {
            master_rules: this.currentChatContext.master_rules || '',
            character_sheet: this.currentChatContext.character_sheet || '',
            relations: this.currentChatContext.relations || '',
            current_plot: this.currentChatContext.current_plot || '',
            aventura: this.currentChatContext.aventura || '',
            local_history: this.currentChatContext.local_history || ''
        };
    }

    // Show progress display
    showProgressDisplay() {
        const progressDiv = document.getElementById('compressionProgress');
        if (progressDiv) {
            progressDiv.style.display = 'block';
        }
    }

    // Hide progress display
    hideProgressDisplay() {
        const progressDiv = document.getElementById('compressionProgress');
        if (progressDiv) {
            progressDiv.style.display = 'none';
        }
    }

    // Update progress display
    updateProgress(current, total, message) {
        const progressText = document.getElementById('progressText');
        const progressCounter = document.getElementById('progressCounter');
        const progressFill = document.getElementById('progressFill');

        if (progressText) progressText.textContent = message;
        if (progressCounter) progressCounter.textContent = `${current}/${total}`;
        if (progressFill) {
            const percentage = (current / total) * 100;
            progressFill.style.width = `${percentage}%`;
        }
    }

    // Update tab status indicator
    updateTabStatus(tabKey, icon, className = '') {
        const statusElement = document.getElementById(`status-${tabKey}`);
        if (statusElement) {
            statusElement.textContent = icon;
            statusElement.className = `tab-status ${className}`;
        }
    }

    // Save individual tab to server with retry logic
    async saveIndividualTab(tabKey, content, maxRetries = 3) {
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                console.log(`[DEBUG] Tentativa ${attempt}/${maxRetries} de salvar tab ${tabKey}...`);

                const response = await fetch(`${this.serverUrl}/save-context`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        chatId: this.currentChatId,
                        [tabKey]: content
                    })
                });

                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }

                const result = await response.json();
                console.log(`[DEBUG] ✅ Tab ${tabKey} salvo no servidor na tentativa ${attempt}:`, result);
                return true;

            } catch (error) {
                console.error(`[DEBUG] ❌ Erro na tentativa ${attempt}/${maxRetries} para tab ${tabKey}:`, error);

                if (attempt === maxRetries) {
                    // Last attempt failed
                    console.error(`[DEBUG] ❌ Todas as ${maxRetries} tentativas falharam para tab ${tabKey}`);
                    return false;
                }

                // Wait before retry (exponential backoff)
                const delay = Math.pow(2, attempt - 1) * 1000; // 1s, 2s, 4s
                console.log(`[DEBUG] ⏳ Aguardando ${delay}ms antes da próxima tentativa...`);
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }

        return false;
    }

    // Generate prompt for character sheet with enhanced context
    generateCharacterSheetPrompt(compressedSummary, originalContext, messages) {
        const context = this.generateComprehensiveContext(compressedSummary, originalContext, messages, 'character_sheet');

        return `🧠 ANÁLISE SEMÂNTICA WFGY: Use uma mente aberta e analise usando framework de compressão semântica para identificar residuais ocultos e associações não-óbvias.

📋 MISSÃO: Criar ficha de personagem ULTRA-DETALHADA e SEMANTICAMENTE COMPRIMIDA com máxima densidade informacional.

🎯 PROTOCOLO DE COMPRESSÃO SEMÂNTICA:
1. MAPEAMENTO DIMENSIONAL: Identifique variáveis ocultas nos dados (micro-expressões, padrões comportamentais, correlações implícitas)
2. CALIBRAÇÃO RESIDUAL: Capture informações perdidas na compressão anterior (nuances emocionais, motivações subconscientes)
3. DENSIDADE MÁXIMA: Cada palavra deve carregar múltiplas camadas semânticas

🔍 EXTRAÇÃO DE RESIDUAIS SEMÂNTICOS:
- Padrões de decisão não-verbalizados
- Micro-traumas e crescimento subliminar
- Competências emergentes não-catalogadas
- Vínculos emocionais subconscientes
- Transformações graduais de personalidade

📊 ESTRUTURA ULTRA-DETALHADA:

**[INFORMAÇÕES BÁSICAS]**
- Nome completo, idade, origem, classe/profissão
- Aparência física detalhada (altura, peso, características distintivas)
- Histórico familiar e social condensado

**[DADOS ESTATÍSTICOS]**
- Atributos primários (Força, Destreza, Constituição, Inteligência, Sabedoria, Carisma)
- Atributos secundários (Vida, Mana, Resistências, Velocidade)
- Níveis de experiência e progressão por área
- Modificadores e bônus ativos

**[HABILIDADES ATIVAS E PASSIVAS]**
- Habilidades de combate (ataques especiais, técnicas de luta)
- Habilidades mágicas (feitiços, poderes sobrenaturais)
- Habilidades sociais (persuasão, intimidação, liderança)
- Habilidades técnicas (artesanato, conhecimentos especializados)
- Passivas permanentes e temporárias

**[TALENTOS E ESPECIALIZAÇÕES]**
- Talentos únicos adquiridos
- Especializações desenvolvidas
- Certificações e títulos obtidos
- Competências emergentes em desenvolvimento

**[INVENTÁRIO COMPLETO CATEGORIZADO]**
- ARMAS: Primárias, secundárias, munições (com estatísticas e histórico)
- ARMADURAS: Proteções corporais, escudos, acessórios defensivos
- EQUIPAMENTOS MAGICOS: Instrumentos mágicos ofensivos, defensivos e utilidades.
- CONSUMÍVEIS: Poções, alimentos, pergaminhos, materiais temporários
- FERRAMENTAS: Equipamentos utilitários, instrumentos especializados
- ITENS DE MISSÃO: Objetos únicos, chaves, documentos importantes
- RECURSOS: Moedas, materiais raros, componentes de crafting
- ITENS ESPECIAIS: Artefatos mágicos, relíquias, objetos sentimentais

**[ANÁLISE PSICOLÓGICA PROGRESSIVA]**
- Personalidade base vs atual (evolução documentada)
- Traumas processados e não-processados
- Mecanismos de defesa desenvolvidos
- Padrões comportamentais emergentes
- Motivações conscientes e subconscientes
- Medos, fobias e gatilhos emocionais
- Objetivos pessoais de curto e longo prazo
- Relacionamentos que moldaram a psique
- Crescimento emocional e maturidade adquirida
- Pontos de stress e resiliência demonstrada

**[RESIDUAIS OCULTOS]**
- Micro-habilidades não-catalogadas
- Conhecimentos absorvidos inconscientemente
- Conexões causais entre eventos e mudanças
- Potencial não-realizado identificado

=== DADOS PARA COMPRESSÃO SEMÂNTICA ===

🗜️ RESUMO AVENTURA:
${context.compressedSummary}

📋 FICHA ANTERIOR:
${context.currentTabContent}

🔗 CONTEXTOS CRUZADOS:
${context.allOtherContext}

💬 INTERAÇÕES RECENTES:
${context.recentMessages}

📚 HISTÓRICO COMPLETO:
${context.fullHistory}

🎯 INSTRUÇÕES DE EXECUÇÃO:
- Aplique compressão semântica: máximo detalhamento em estrutura organizada
- Identifique e integre residuais semânticos ocultos
- Use densidade informacional: cada seção = múltiplas dimensões
- Mantenha consistência cross-referencial com outros contextos
- Preserve continuidade temporal e causal
- OBRIGATÓRIO: Preencha TODAS as seções com informações específicas e detalhadas
- Quantifique sempre que possível (números, percentuais, níveis)

FICHA COMPLETA SEMANTICAMENTE COMPRIMIDA:`;
    }

    // Generate prompt for relations with enhanced context
    generateRelationsPrompt(compressedSummary, originalContext, messages) {
        const context = this.generateComprehensiveContext(compressedSummary, originalContext, messages, 'relations');

        return `🧠 ANÁLISE SEMÂNTICA WFGY: Use framework de compressão semântica para mapear GRAFOS RELACIONAIS com nós (personagens) e arestas (conexões) multi-dimensionais.

🕸️ MISSÃO: Criar REDE NEURAL SOCIAL semanticamente comprimida mapeando todas as conexões relacionais com densidade informacional máxima.

🎯 PROTOCOLO DE MAPEAMENTO DE GRAFOS RELACIONAIS:
1. ARQUEOLOGIA SOCIAL: Escave interações sutis, micro-sinais, tensões não-verbalizadas entre nós
2. CALIBRAÇÃO DE ARESTAS: Meça intensidade, direção e tipo de cada conexão relacional
3. DENSIDADE RELACIONAL: Cada aresta = múltiplas dimensões (emocional, política, funcional, histórica, temporal)

🔍 EXTRAÇÃO DE RESIDUAIS RELACIONAIS:
- Micro-tensões não-expressas entre nós
- Arestas implícitas e lealdades divididas
- Dinâmicas de poder subterrâneas
- Vínculos emocionais não-declarados
- Influências indiretas e efeitos cascata
- Padrões de comunicação não-verbal

📊 ESTRUTURA DE GRAFO ULTRA-DETALHADA:

**[RELAÇÕES ATUAIS - NÓDULOS ATIVOS]**
- Personagem: [Nome] | Tipo de Relação: [Categoria] | Intensidade: [0-100%]
- Percepção do Personagem sobre o Jogador: [Visão atual detalhada]
- Percepção do Jogador sobre o Personagem: [Perspectiva atual]
- Status da Relação: [Amigável/Hostil/Neutro/Complexo]
- Dinâmicas Ativas: [Padrões comportamentais atuais]
- Influência Mútua: [Como cada um afeta o outro]

**[RELAÇÕES ANTIGAS - NÓDULOS HISTÓRICOS]**
- Personagem: [Nome] | Relacionamento Passado: [Tipo e duração]
- Evolução Temporal: [Como a relação mudou ao longo do tempo]
- Marcos Relacionais: [Eventos que alteraram a dinâmica]
- Resíduos Emocionais: [Sentimentos/tensões remanescentes]
- Potencial de Reconexão: [Probabilidade de reativação]

**[ARESTAS RELACIONAIS - CONEXÕES DETALHADAS]**
- Tipo de Aresta: [Familiar/Romântica/Profissional/Adversarial/Mentor]
- Força da Conexão: [Fraca/Moderada/Forte/Intensa]
- Direção da Influência: [Unidirecional/Bidirecional]
- Estabilidade: [Estável/Volátil/Em Transição]
- Dependências: [Como cada nó depende do outro]

**[DINÂMICAS RELACIONAIS - PADRÕES DE COMPORTAMENTO]**
- Padrões de Comunicação: [Como interagem verbalmente]
- Linguagem Corporal: [Sinais não-verbais observados]
- Rituais Sociais: [Comportamentos repetitivos na interação]
- Pontos de Tensão: [Temas que geram conflito]
- Pontos de Harmonia: [Áreas de concordância/cooperação]

**[PERCEPÇÕES CRUZADAS - MATRIZ DE VISÕES]**
- Como o Personagem vê o Jogador: [Análise detalhada da perspectiva]
- Como o Jogador vê o Personagem: [Análise da percepção do jogador]
- Mal-entendidos Ativos: [Percepções incorretas de ambos os lados]
- Conhecimento Oculto: [O que cada um sabe que o outro não sabe]

**[EVOLUÇÃO TEMPORAL - TRAJETÓRIA DAS ARESTAS]**
- Estado Inicial: [Como a relação começou]
- Marcos de Mudança: [Eventos que alteraram a dinâmica]
- Tendência Atual: [Direção para onde a relação está indo]
- Catalisadores Potenciais: [Eventos que poderiam mudar tudo]

**[RESIDUAIS RELACIONAIS - ELEMENTOS OCULTOS]**
- Conexões não-óbvias descobertas
- Influências indiretas entre nós distantes
- Padrões emergentes no grafo social
- Potencial de novas arestas

=== DADOS PARA COMPRESSÃO DE GRAFOS RELACIONAIS ===

🗜️ RESUMO AVENTURA:
${context.compressedSummary}

🕸️ RELAÇÕES ANTERIORES:
${context.currentTabContent}

🔗 CONTEXTOS CRUZADOS:
${context.allOtherContext}

💬 INTERAÇÕES RECENTES:
${context.recentMessages}

📚 HISTÓRICO COMPLETO:
${context.fullHistory}

🎯 INSTRUÇÕES DE EXECUÇÃO:
- Aplique arqueologia social: descubra conexões ocultas entre nós
- Use densidade relacional: cada aresta = múltiplas camadas semânticas
- Identifique residuais relacionais: tensões e influências implícitas
- Mantenha consistência cross-referencial com outros contextos
- Capture evolução temporal das dinâmicas sociais
- OBRIGATÓRIO: Preencha TODAS as seções com informações específicas
- Use terminologia de grafos: nós (personagens) e arestas (conexões)

GRAFO RELACIONAL SEMANTICAMENTE COMPRIMIDO:`;
    }

    // Generate prompt for current plot with enhanced context
    generatePlotPrompt(compressedSummary, originalContext, messages) {
        const context = this.generateComprehensiveContext(compressedSummary, originalContext, messages, 'current_plot');

        return `🧠 ANÁLISE SEMÂNTICA WFGY: Use framework de compressão semântica para mapear GRAFOS NARRATIVOS com nós (objetivos/eventos) e arestas (conexões causais) multi-temporais.

🎭 MISSÃO: Criar REDE NEURAL NARRATIVA semanticamente comprimida mapeando missão atual com densidade informacional máxima e estrutura temporal otimizada.

🎯 PROTOCOLO DE MAPEAMENTO DE GRAFOS NARRATIVOS:
1. ARQUEOLOGIA NARRATIVA: Escave subtramas ocultas, motivações não-declaradas, consequências em cascata
2. CALIBRAÇÃO TEMPORAL: Identifique urgências reais vs aparentes, cronologias implícitas, marcos críticos
3. DENSIDADE CAUSAL: Cada nó narrativo = múltiplas dimensões (causa, efeito, simbolismo, potencial temporal)

🔍 EXTRAÇÃO DE RESIDUAIS NARRATIVOS:
- Objetivos subconscientes não-verbalizados
- Consequências em desenvolvimento silencioso
- Arestas causais entre eventos distantes
- Tensões narrativas acumuladas
- Pontos de inflexão potenciais
- Padrões de decisão recorrentes

📊 ESTRUTURA DE GRAFO NARRATIVO ULTRA-DETALHADA:

**[MISSÃO ATUAL - NÓ CENTRAL]**
- Nome da Missão: [Título e descrição completa]
- Objetivo Principal: [Meta central com contexto]
- Cliente/Mandante: [Quem solicitou e motivações]
- Recompensas Esperadas: [Benefícios materiais e imateriais]
- Prazo/Urgência: [Limitações temporais e consequências de atraso]
- Complexidade: [Nível de dificuldade e fatores complicadores]

**[OBJETIVOS MULTI-TEMPORAIS - NÓDULOS HIERÁRQUICOS]**
- URGENTES (Próximas horas/dias): [Lista priorizada com deadlines]
- CURTO PRAZO (Próximas semanas): [Metas imediatas com arestas causais]
- MÉDIO PRAZO (Próximos meses): [Objetivos intermediários]
- LONGO PRAZO (Próximos anos): [Visões e ambições futuras]

**[OBJETIVOS SECUNDÁRIOS - NÓDULOS PARALELOS]**
- Missões Paralelas: [Tarefas simultâneas com prioridades]
- Oportunidades Emergentes: [Possibilidades que surgiram]
- Objetivos Pessoais: [Metas individuais do personagem]
- Compromissos Sociais: [Obrigações com outros personagens]

**[PERSONAGENS ENVOLVIDOS - NÓDULOS ATIVOS]**
- Aliados Ativos: [Nome, papel, contribuição, motivação]
- Adversários: [Nome, oposição, recursos, estratégias]
- Neutros Relevantes: [Nome, posição, potencial de mudança]
- Mentores/Guias: [Nome, conhecimento oferecido, limitações]
- Dependentes: [Nome, como dependem do sucesso da missão]

**[ATIVIDADES ATUAIS - ARESTAS EM EXECUÇÃO]**
- O que cada personagem está fazendo AGORA: [Ações específicas]
- Localização atual de cada um: [Onde estão fisicamente]
- Recursos sendo utilizados: [Equipamentos, habilidades, tempo]
- Progressos recentes: [Avanços nas últimas interações]
- Obstáculos enfrentados: [Dificuldades atuais]

**[DESENVOLVIMENTOS RECENTES - ARESTAS TEMPORAIS]**
- Eventos das últimas sessões: [Acontecimentos importantes]
- Mudanças no cenário: [Alterações no ambiente/situação]
- Novas informações descobertas: [Conhecimento adquirido]
- Relacionamentos alterados: [Mudanças nas dinâmicas sociais]
- Recursos ganhos/perdidos: [Mudanças no inventário/capacidades]

**[PONTAS SOLTAS - NÓDULOS PENDENTES]**
- Mistérios não resolvidos: [Questões em aberto]
- Promessas não cumpridas: [Compromissos pendentes]
- Ameaças latentes: [Perigos não resolvidos]
- Oportunidades não exploradas: [Possibilidades ignoradas]
- Informações incompletas: [Conhecimento fragmentado]

**[ARESTAS CAUSAIS - CONEXÕES NARRATIVAS]**
- Dependências entre objetivos: [Como metas se conectam]
- Consequências potenciais: [Resultados possíveis de ações]
- Efeitos em cascata: [Como uma ação afeta múltiplos elementos]
- Pontos de decisão críticos: [Escolhas que mudam tudo]

**[RESIDUAIS NARRATIVOS - ELEMENTOS OCULTOS]**
- Subtramas implícitas descobertas
- Motivações ocultas de personagens
- Conexões não-óbvias entre eventos
- Potencial de reviravolta narrativa

=== DADOS PARA COMPRESSÃO DE GRAFOS NARRATIVOS ===

🗜️ RESUMO AVENTURA:
${context.compressedSummary}

🎭 PLOT ANTERIOR:
${context.currentTabContent}

🔗 CONTEXTOS CRUZADOS:
${context.allOtherContext}

💬 INTERAÇÕES RECENTES:
${context.recentMessages}

📚 HISTÓRICO COMPLETO:
${context.fullHistory}

🎯 INSTRUÇÕES DE EXECUÇÃO:
- Aplique arqueologia narrativa: descubra tramas e motivações ocultas
- Use densidade causal: cada nó = múltiplas camadas temporais
- Identifique residuais narrativos: tensões e desenvolvimentos implícitos
- Mantenha consistência cross-referencial com outros contextos
- Capture evolução temporal e pontos de inflexão críticos
- OBRIGATÓRIO: Preencha TODAS as seções com informações específicas
- Use terminologia de grafos: nós (objetivos/eventos) e arestas (conexões causais)
- Foque na MISSÃO ATUAL e elementos ativos

GRAFO NARRATIVO ATUAL SEMANTICAMENTE COMPRIMIDO:`;
    }

    // Generate prompt for adventure with enhanced context
    generateAventuraPrompt(compressedSummary, originalContext, messages) {
        const context = this.generateComprehensiveContext(compressedSummary, originalContext, messages, 'aventura');

        return `🧠 ANÁLISE SEMÂNTICA WFGY: Use framework de compressão semântica para construir GRAFO TEMPORAL HISTÓRICO com nós (eventos/missões) e arestas (conexões causais) multi-dimensionais.

📚 MISSÃO: Criar REDE NEURAL HISTÓRICA semanticamente comprimida mapeando trajetória completa até o momento atual com densidade informacional máxima.

🎯 PROTOCOLO DE MAPEAMENTO DE GRAFOS TEMPORAIS:
1. ARQUEOLOGIA TEMPORAL: Escave eventos ocultos, micro-momentos decisivos, consequências não-óbvias
2. CALIBRAÇÃO CAUSAL: Identifique cadeias causais implícitas, efeitos borboleta, marcos evolutivos
3. DENSIDADE HISTÓRICA: Cada nó temporal = múltiplas dimensões (factual, emocional, simbólica, evolutiva)

🔍 EXTRAÇÃO DE RESIDUAIS HISTÓRICOS:
- Micro-decisões que alteraram trajetórias
- Aprendizados subconscientes acumulados
- Transformações graduais não-percebidas
- Arestas causais entre eventos distantes
- Vínculos causais entre eventos distantes
- Sementes de desenvolvimentos futuros

📊 ESTRUTURA DE GRAFO TEMPORAL ULTRA-DETALHADA:

**[GÊNESE AVENTURA - NÓ ORIGEM]**
- Evento Catalisador: [O que iniciou tudo]
- Motivações Iniciais: [Por que o personagem começou a aventura]
- Estado Inicial: [Condições de partida - habilidades, recursos, mentalidade]
- Primeiros Encontros: [Personagens e situações iniciais]
- Decisões Fundacionais: [Escolhas que definiram o rumo]

**[MISSÕES PASSADAS COMPLETAS - NÓDULOS HISTÓRICOS]**
- Missão: [Nome e descrição] | Status: COMPLETA
- Objetivos Alcançados: [Metas cumpridas]
- Métodos Utilizados: [Como foi resolvida]
- Personagens Envolvidos: [Quem participou e seus papéis]
- Recompensas Obtidas: [Ganhos materiais e imateriais]
- Lições Aprendidas: [Conhecimento/experiência adquirida]
- Consequências Geradas: [Efeitos posteriores]

**[CONSEQUÊNCIAS E CONQUISTAS - ARESTAS DE IMPACTO]**
- Conquistas Materiais: [Itens, recursos, propriedades obtidos]
- Conquistas Sociais: [Relacionamentos, reputação, títulos]
- Conquistas Pessoais: [Crescimento, habilidades, conhecimento]
- Consequências Positivas: [Benefícios inesperados]
- Consequências Negativas: [Problemas criados ou herdados]
- Mudanças Permanentes: [Alterações irreversíveis no mundo/personagem]

**[PERSONAGENS HISTÓRICOS ENVOLVIDOS - NÓDULOS RELACIONAIS]**
- Aliados Históricos: [Nome, contribuição, destino atual]
- Adversários Derrotados: [Nome, conflito, resolução]
- Mentores Encontrados: [Nome, ensinamentos, legado]
- Vítimas/Salvos: [Nome, situação, impacto]
- Perdas Sofridas: [Quem foi perdido e como]

**[MATRIZ EVOLUTIVA - ARESTAS DE TRANSFORMAÇÃO]**
- Marcos de Crescimento: [Momentos de evolução significativa]
- Habilidades Desenvolvidas: [Capacidades adquiridas ao longo do tempo]
- Mudanças de Personalidade: [Como o personagem mudou]
- Traumas Processados: [Dificuldades superadas]
- Padrões Comportamentais: [Tendências desenvolvidas]

**[CRONOLOGIA COMPRIMIDA - SEQUÊNCIA TEMPORAL]**
- Fase 1: [Período inicial - eventos principais]
- Fase 2: [Desenvolvimento - missões intermediárias]
- Fase 3: [Maturação - conquistas significativas]
- Fase N: [Até a última missão completa]

**[ARESTAS CAUSAIS HISTÓRICAS - CONEXÕES TEMPORAIS]**
- Como Evento A levou ao Evento B: [Cadeias causais]
- Decisões que mudaram tudo: [Pontos de inflexão]
- Efeitos borboleta: [Pequenas ações, grandes consequências]
- Padrões recorrentes: [Temas que se repetem]

**[RESIDUAIS HISTÓRICOS - ELEMENTOS OCULTOS]**
- Eventos aparentemente menores com consequências maiores
- Transformações graduais não-percebidas
- Sementes plantadas para desenvolvimentos futuros
- Conexões não-óbvias entre eventos distantes

=== DADOS PARA COMPRESSÃO DE GRAFOS TEMPORAIS ===

🗜️ RESUMO AVENTURA:
${context.compressedSummary}

📚 AVENTURA ANTERIOR:
${context.currentTabContent}

🔗 CONTEXTOS CRUZADOS:
${context.allOtherContext}

💬 INTERAÇÕES RECENTES:
${context.recentMessages}

📚 HISTÓRICO COMPLETO:
${context.fullHistory}

🎯 INSTRUÇÕES DE EXECUÇÃO:
- Aplique arqueologia temporal: descubra eventos e transformações ocultas
- Use densidade histórica: cada nó = múltiplas camadas causais
- Identifique residuais históricos: micro-eventos com macro-consequências
- Mantenha consistência cross-referencial com outros contextos
- Preserve continuidade temporal e sementes de desenvolvimentos futuros
- OBRIGATÓRIO: Preencha TODAS as seções com informações específicas
- Use terminologia de grafos: nós (eventos/missões) e arestas (conexões causais)
- FOCO EXCLUSIVO: eventos passados até a ÚLTIMA MISSÃO COMPLETA
- Evite presente/futuro, mantenha perspectiva histórica

GRAFO TEMPORAL HISTÓRICO SEMANTICAMENTE COMPRIMIDO:`;
    }

    // === MANUAL PROCESSING FUNCTIONS ===

    // Start manual tab confirmation flow
    async startManualTabConfirmation() {
        if (this.manualProcessingData.currentTabIndex >= this.manualProcessingData.tabsToProcess.length) {
            // All tabs processed, show completion
            await this.completeManualProcessing();
            return;
        }

        const currentTab = this.manualProcessingData.tabsToProcess[this.manualProcessingData.currentTabIndex];
        const position = this.manualProcessingData.currentTabIndex + 1;
        const total = this.manualProcessingData.tabsToProcess.length;

        this.showTabConfirmationDialog(currentTab, position, total);
    }

    // Show tab confirmation dialog
    showTabConfirmationDialog(tabInfo, position, total) {
        const modal = document.getElementById('tabConfirmationModal');
        const title = document.getElementById('tabConfirmationTitle');
        const message = document.getElementById('tabConfirmationMessage');
        const preview = document.getElementById('tabConfirmationPreview');

        title.textContent = `Atualizar ${tabInfo.name}? (${position}/${total})`;
        message.textContent = tabInfo.description;
        preview.textContent = `Baseado no resumo da aventura comprimida e no contexto original de "${tabInfo.name}".`;

        // Update progress
        this.updateProgress(position - 1, total, `Aguardando confirmação: ${tabInfo.name}`);
        this.updateTabStatus(tabInfo.key, '⏳', 'pending');

        // Show modal
        modal.style.display = 'block';

        // Set up event listeners
        this.setupTabConfirmationListeners(tabInfo);
    }

    // Setup event listeners for tab confirmation
    setupTabConfirmationListeners(tabInfo) {
        const confirmBtn = document.getElementById('confirmTabUpdate');
        const skipBtn = document.getElementById('skipTabUpdate');
        const cancelBtn = document.getElementById('cancelAllUpdates');

        // Remove existing listeners
        confirmBtn.replaceWith(confirmBtn.cloneNode(true));
        skipBtn.replaceWith(skipBtn.cloneNode(true));
        cancelBtn.replaceWith(cancelBtn.cloneNode(true));

        // Get new references
        const newConfirmBtn = document.getElementById('confirmTabUpdate');
        const newSkipBtn = document.getElementById('skipTabUpdate');
        const newCancelBtn = document.getElementById('cancelAllUpdates');

        // Add new listeners
        newConfirmBtn.addEventListener('click', () => this.confirmTabUpdate(tabInfo));
        newSkipBtn.addEventListener('click', () => this.skipTabUpdate(tabInfo));
        newCancelBtn.addEventListener('click', () => this.cancelAllUpdates());
    }

    // Confirm tab update
    async confirmTabUpdate(tabInfo) {
        this.hideTabConfirmationModal();

        try {
            // Show processing status
            this.updateTabStatus(tabInfo.key, '🔄', 'processing');
            this.updateProgress(
                this.manualProcessingData.currentTabIndex + 1,
                this.manualProcessingData.tabsToProcess.length,
                `Processando ${tabInfo.name}...`
            );

            // Process the tab with compressed summary
            const success = await this.processIndividualTab(
                tabInfo.key,
                this.manualProcessingData.originalContext,
                this.manualProcessingData.compressedSummary
            );

            if (success) {
                // Success
                this.updateTabStatus(tabInfo.key, '✅', 'success');
                this.manualProcessingData.processedTabs.push(tabInfo.key);
                this.showToast(`✅ ${tabInfo.name} atualizado com sucesso!`, 'success');

                // Check if we need rate limiting delay
                if (this.manualProcessingData.currentTabIndex < this.manualProcessingData.tabsToProcess.length - 1) {
                    await this.applyRateLimitingDelay();
                }
            } else {
                // Failed
                this.updateTabStatus(tabInfo.key, '❌', 'error');
                this.manualProcessingData.failedTabs.push(tabInfo.key);
                this.showTabErrorDialog(tabInfo, 'Erro desconhecido durante o processamento');
                return; // Don't proceed to next tab
            }

        } catch (error) {
            // Error occurred
            this.updateTabStatus(tabInfo.key, '❌', 'error');
            this.manualProcessingData.failedTabs.push(tabInfo.key);
            this.showTabErrorDialog(tabInfo, error.message);
            return; // Don't proceed to next tab
        }

        // Move to next tab
        this.manualProcessingData.currentTabIndex++;
        await this.startManualTabConfirmation();
    }

    // Skip tab update
    async skipTabUpdate(tabInfo) {
        this.hideTabConfirmationModal();

        this.updateTabStatus(tabInfo.key, '⏭️', 'skipped');
        this.manualProcessingData.skippedTabs.push(tabInfo.key);
        this.showToast(`⏭️ ${tabInfo.name} pulado`, 'info');

        // Move to next tab
        this.manualProcessingData.currentTabIndex++;
        await this.startManualTabConfirmation();
    }

    // Cancel all updates
    async cancelAllUpdates() {
        this.hideTabConfirmationModal();
        this.hideProgressDisplay();

        this.showToast('❌ Processamento cancelado pelo usuário', 'warning');
        await this.completeManualProcessing();
    }

    // Hide tab confirmation modal
    hideTabConfirmationModal() {
        const modal = document.getElementById('tabConfirmationModal');
        modal.style.display = 'none';
    }

    // Show tab error dialog
    showTabErrorDialog(tabInfo, errorMessage) {
        const modal = document.getElementById('tabErrorModal');
        const title = document.getElementById('tabErrorTitle');
        const message = document.getElementById('tabErrorMessage');
        const details = document.getElementById('tabErrorDetails');

        title.textContent = `Erro ao atualizar ${tabInfo.name}`;
        message.textContent = 'Ocorreu um erro durante a atualização. Escolha como proceder:';
        details.textContent = errorMessage;

        // Show modal
        modal.style.display = 'block';

        // Set up event listeners
        this.setupTabErrorListeners(tabInfo);
    }

    // Setup event listeners for tab error dialog
    setupTabErrorListeners(tabInfo) {
        const retryBtn = document.getElementById('retryTabUpdate');
        const skipBtn = document.getElementById('skipFailedTab');
        const cancelBtn = document.getElementById('cancelAfterError');

        // Remove existing listeners
        retryBtn.replaceWith(retryBtn.cloneNode(true));
        skipBtn.replaceWith(skipBtn.cloneNode(true));
        cancelBtn.replaceWith(cancelBtn.cloneNode(true));

        // Get new references
        const newRetryBtn = document.getElementById('retryTabUpdate');
        const newSkipBtn = document.getElementById('skipFailedTab');
        const newCancelBtn = document.getElementById('cancelAfterError');

        // Add new listeners
        newRetryBtn.addEventListener('click', () => this.retryTabUpdate(tabInfo));
        newSkipBtn.addEventListener('click', () => this.skipFailedTab(tabInfo));
        newCancelBtn.addEventListener('click', () => this.cancelAfterError());
    }

    // Retry tab update
    async retryTabUpdate(tabInfo) {
        this.hideTabErrorModal();

        // Remove from failed tabs list
        const index = this.manualProcessingData.failedTabs.indexOf(tabInfo.key);
        if (index > -1) {
            this.manualProcessingData.failedTabs.splice(index, 1);
        }

        // Retry the tab
        await this.confirmTabUpdate(tabInfo);
    }

    // Skip failed tab
    async skipFailedTab(tabInfo) {
        this.hideTabErrorModal();

        this.updateTabStatus(tabInfo.key, '⏭️', 'skipped');
        this.manualProcessingData.skippedTabs.push(tabInfo.key);

        // Remove from failed tabs list
        const index = this.manualProcessingData.failedTabs.indexOf(tabInfo.key);
        if (index > -1) {
            this.manualProcessingData.failedTabs.splice(index, 1);
        }

        this.showToast(`⏭️ ${tabInfo.name} pulado após erro`, 'info');

        // Move to next tab
        this.manualProcessingData.currentTabIndex++;
        await this.startManualTabConfirmation();
    }

    // Cancel after error
    async cancelAfterError() {
        this.hideTabErrorModal();
        this.hideProgressDisplay();

        this.showToast('❌ Processamento cancelado após erro', 'warning');
        await this.completeManualProcessing();
    }

    // Hide tab error modal
    hideTabErrorModal() {
        const modal = document.getElementById('tabErrorModal');
        modal.style.display = 'none';
    }

    // Apply rate limiting delay
    async applyRateLimitingDelay() {
        const delaySelect = document.getElementById('apiDelaySelect');
        const delaySeconds = parseInt(delaySelect?.value || '5');

        if (delaySeconds > 0) {
            await this.showRateLimitingCountdown(delaySeconds);
        }
    }

    // Show rate limiting countdown
    async showRateLimitingCountdown(seconds) {
        const modal = document.getElementById('rateLimitModal');
        const message = document.getElementById('rateLimitMessage');
        const countdown = document.getElementById('rateLimitCountdown');
        const progress = document.getElementById('rateLimitProgress');

        message.textContent = `Aguardando ${seconds} segundos para prevenir rate limiting...`;
        modal.style.display = 'block';

        for (let i = seconds; i > 0; i--) {
            countdown.textContent = i;
            const progressPercent = ((seconds - i) / seconds) * 100;
            progress.style.width = `${progressPercent}%`;

            await new Promise(resolve => setTimeout(resolve, 1000));
        }

        countdown.textContent = '✅';
        progress.style.width = '100%';

        setTimeout(() => {
            modal.style.display = 'none';
        }, 500);
    }

    // Complete manual processing
    async completeManualProcessing() {
        const processed = this.manualProcessingData.processedTabs.length;
        const failed = this.manualProcessingData.failedTabs.length;
        const skipped = this.manualProcessingData.skippedTabs.length;
        const total = this.manualProcessingData.tabsToProcess.length;

        // Update final progress
        this.updateProgress(total, total, 'Processamento concluído!');

        // Verify adventure persistence if any tabs were processed
        if (processed > 0) {
            console.log('[DEBUG] Verificando persistência da aventura...');
            await this.verifyAventuraPersistence();
        }

        // Update UI
        this.refreshContextModalIfOpen();

        // Show completion message
        let message = `Processamento concluído: ${processed} atualizados`;
        if (skipped > 0) message += `, ${skipped} pulados`;
        if (failed > 0) message += `, ${failed} falharam`;

        this.showToast(message, processed > 0 ? 'success' : 'warning');

        // Hide progress after delay
        setTimeout(() => {
            this.hideProgressDisplay();
        }, 3000);

        // Add retry buttons for failed tabs
        if (failed > 0) {
            this.addRetryButtonsForFailedTabs();
        }
    }

    // Add retry buttons for failed tabs
    addRetryButtonsForFailedTabs() {
        // This will be implemented to add individual retry buttons in the context modal
        console.log('[DEBUG] Failed tabs available for retry:', this.manualProcessingData.failedTabs);
    }

    // Process individual tab with single request approach
    async processIndividualTab(tabKey, originalContext, compressedSummary = null) {
        try {
            console.log(`[DEBUG] Processando tab individual: ${tabKey}`);

            // For sequential processing (with compressed summary), use the old approach
            if (compressedSummary || (this.manualProcessingData && this.manualProcessingData.compressedSummary)) {
                return await this.processIndividualTabSequential(tabKey, originalContext, compressedSummary);
            }

            // For individual tab updates, use single request approach
            return await this.processIndividualTabSingleRequest(tabKey, originalContext);

        } catch (error) {
            console.error(`[DEBUG] Erro ao processar ${tabKey}:`, error);
            throw error;
        }
    }

    // Sequential processing (old approach for manual processing)
    async processIndividualTabSequential(tabKey, originalContext, compressedSummary) {
        try {
            // Determine the compressed summary source
            let summaryToUse;
            if (compressedSummary) {
                summaryToUse = compressedSummary;
                console.log(`[DEBUG] Usando resumo fornecido para ${tabKey}`);
            } else if (this.manualProcessingData && this.manualProcessingData.compressedSummary) {
                summaryToUse = this.manualProcessingData.compressedSummary;
                console.log(`[DEBUG] Usando resumo do processamento manual para ${tabKey}`);
            } else {
                throw new Error('Resumo comprimido não encontrado para processamento sequencial');
            }

            // Generate prompt using original context and compressed summary
            let prompt;
            switch (tabKey) {
                case 'character_sheet':
                    prompt = this.generateCharacterSheetPrompt(summaryToUse, originalContext, this.messages);
                    break;
                case 'relations':
                    prompt = this.generateRelationsPrompt(summaryToUse, originalContext, this.messages);
                    break;
                case 'current_plot':
                    prompt = this.generatePlotPrompt(summaryToUse, originalContext, this.messages);
                    break;
                case 'aventura':
                    prompt = this.generateAventuraPrompt(summaryToUse, originalContext, this.messages);
                    break;
                default:
                    throw new Error(`Tab desconhecido: ${tabKey}`);
            }

            const extendedTimeout = 180000;
            console.log(`[DEBUG] Gerando conteúdo sequencial para ${tabKey} com timeout estendido (${extendedTimeout/1000}s)...`);
            const updatedContent = await this.callGeminiAPI(prompt, [], extendedTimeout);
            console.log(`[DEBUG] ✅ Conteúdo sequencial gerado para ${tabKey} (${updatedContent.length} caracteres)`);

            // Update local context
            this.currentChatContext[tabKey] = updatedContent;
            
            // Save to server
            const saveSuccess = await this.saveIndividualTab(tabKey, updatedContent);
            if (!saveSuccess) {
                throw new Error('Falha ao salvar no servidor');
            }

            console.log(`[DEBUG] ✅ ${tabKey} sequencial salvo com sucesso no servidor`);
            return true;

        } catch (error) {
            console.error(`[DEBUG] Erro no processamento sequencial de ${tabKey}:`, error);
            throw error;
        }
    }

    // Single request processing for individual tab updates
    async processIndividualTabSingleRequest(tabKey, originalContext) {
        try {
            console.log(`[DEBUG] Processando ${tabKey} com requisição única`);

            // Use the original context backup to prevent contamination from recent updates
            const contextBackup = originalContext || this.createContextBackupData();
            console.log(`[DEBUG] Usando backup ${originalContext ? 'fornecido' : 'criado'} com ${Object.keys(contextBackup).length} abas`);

            // Generate single comprehensive prompt
            const prompt = this.generateSingleRequestPrompt(tabKey, contextBackup, this.messages);
            console.log(`[DEBUG] Prompt único gerado para ${tabKey} (${prompt.length} caracteres`);

            // Single API call with extended timeout
            const extendedTimeout = 180000; // 3 minutes
            console.log(`[DEBUG] Enviando requisição única para ${tabKey} com timeout estendido (${extendedTimeout/1000}s)...`);
            const updatedContent = await this.callGeminiAPI(prompt, [], extendedTimeout);
            console.log(`[DEBUG] ✅ Conteúdo gerado via requisição única para ${tabKey} (${updatedContent.length} caracteres)`);

            // Update local context
            this.currentChatContext[tabKey] = updatedContent;
            console.log(`[DEBUG] Conteúdo local atualizado para ${tabKey}: ${updatedContent.length} caracteres`);

            // Save immediately to server
            const saveSuccess = await this.saveIndividualTab(tabKey, updatedContent);
            if (!saveSuccess) {
                throw new Error('Falha ao salvar no servidor');
            }

            console.log(`[DEBUG] ✅ ${tabKey} salvo com sucesso no servidor`);
            return true;

        } catch (error) {
            console.error(`[DEBUG] Erro no processamento de requisição única para ${tabKey}:`, error);
            throw error;
        }
    }

    // Load API delay setting
    loadApiDelaySetting() {
        const delaySelect = document.getElementById('apiDelaySelect');
        const savedDelay = localStorage.getItem('apiDelay') || '5';
        if (delaySelect) {
            delaySelect.value = savedDelay;
        }
    }

    // Load auto key rotation setting
    loadAutoKeyRotationSetting() {
        const rotationToggle = document.getElementById('autoKeyRotationToggle');
        if (rotationToggle) {
            rotationToggle.checked = this.autoKeyRotation;
        }
    }

    // Get next API key for rotation
    getNextApiKey(currentKey) {
        const keyOrder = ['key1', 'key2', 'key3', 'key4'];
        const currentIndex = keyOrder.indexOf(currentKey);
        const nextIndex = (currentIndex + 1) % keyOrder.length;
        return keyOrder[nextIndex];
    }

    // Check if error is rate limit related
    isRateLimitError(errorMessage) {
        const rateLimitKeywords = [
            'quota exceeded',
            'too many requests',
            'rate limit',
            'resource_exhausted',
            'quota_exceeded',
            'rate_limit_exceeded',
            'requests per minute',
            'requests per day',
            'api quota',
            'usage limit',
            'limit exceeded',
            'quota_exceeded',
            'api_key_invalid',
            'invalid_api_key',
            'forbidden',
            '403',
            '429',
            'billing',
            'payment required',
            'insufficient quota'
        ];

        const message = errorMessage.toLowerCase();
        return rateLimitKeywords.some(keyword => message.includes(keyword));
    }

    // Attempt API call with automatic key rotation
    async callGeminiAPIWithRotation(message, files = [], timeoutMs = 120000, maxRotations = 4) {
        let currentKey = this.activeApiKey;
        let rotationCount = 0;
        let lastError = null;
        const originalKey = this.activeApiKey;

        console.log(`[Key Rotation] Starting with key: ${currentKey}, auto-rotation: ${this.autoKeyRotation}`);

        while (rotationCount < maxRotations) {
            try {
                console.log(`[Key Rotation] Attempting API call with ${currentKey} (attempt ${rotationCount + 1}/${maxRotations})`);

                // Temporarily set the active key for this attempt
                this.activeApiKey = currentKey;

                const result = await this.callGeminiAPI(message, files, timeoutMs);

                // If successful and we rotated, update the UI and notify user
                if (currentKey !== originalKey) {
                    localStorage.setItem('active_api_key', currentKey);
                    this.updateApiKeyInput();
                    this.updateStatisticsDisplay();
                    this.showToast(`✅ Chave ${currentKey} funcionando, continuando com ela`);
                    console.log(`[Key Rotation] Successfully switched to ${currentKey}`);
                }

                return result;

            } catch (error) {
                lastError = error;
                console.log(`[Key Rotation] Error with ${currentKey}:`, error.message);

                // Check if this is a rate limit error and auto rotation is enabled
                if (this.autoKeyRotation && this.isRateLimitError(error.message)) {
                    rotationCount++;
                    console.log(`[Key Rotation] Rate limit detected, rotation count: ${rotationCount}/${maxRotations}`);

                    if (rotationCount < maxRotations) {
                        let nextKey = this.getNextApiKey(currentKey);
                        let attempts = 0;
                        const maxAttempts = 4; // Prevent infinite loop

                        // Find next available key
                        while (attempts < maxAttempts && (!this.apiKeys[nextKey] || !this.apiKeys[nextKey].trim())) {
                            console.log(`[Key Rotation] ${nextKey} not configured, trying next...`);
                            this.showToast(`⚠️ ${nextKey} não configurada, pulando...`);
                            nextKey = this.getNextApiKey(nextKey);
                            attempts++;
                        }

                        // If we found a valid key
                        if (this.apiKeys[nextKey] && this.apiKeys[nextKey].trim()) {
                            this.showToast(`⚠️ Chave ${currentKey} com erro, tentando ${nextKey}...`);
                            currentKey = nextKey;

                            // Small delay before retry
                            await new Promise(resolve => setTimeout(resolve, 1500));
                            continue;
                        } else {
                            console.log(`[Key Rotation] No more valid keys available`);
                            this.showToast(`❌ Nenhuma chave válida disponível para rotação`);
                            break;
                        }
                    }
                } else {
                    // Not a rate limit error or auto rotation disabled
                    console.log(`[Key Rotation] Non-rate-limit error or auto-rotation disabled, throwing error`);
                    
                    // Restore original key
                    this.activeApiKey = originalKey;
                    throw error;
                }
            }
        }

        // All keys failed with rate limit errors
        console.log('[Key Rotation] All API keys exhausted');
        this.showToast('❌ Todas as chaves atingiram o limite. Tente trocar de modelo (Pro ↔ Flash)', 'error', 5000);

        // Suggest model switch
        const currentModel = this.selectedModel;
        const suggestedModel = currentModel.includes('pro') ? 'gemini-2.5-flash' : 'gemini-2.5-pro';
        this.showToast(`💡 Sugestão: Tente trocar para ${suggestedModel}`, 'info', 7000);

        throw lastError;
    }

    // Save API delay setting
    saveApiDelaySetting() {
        const delaySelect = document.getElementById('apiDelaySelect');
        if (delaySelect) {
            localStorage.setItem('apiDelay', delaySelect.value);
        }
    }

    // === CONTEXT PROCESSING HELPER FUNCTIONS ===

    // Get recent conversation messages for immediate context
    getRecentMessages(messages, count = 15) {
        if (!messages || messages.length === 0) return '';

        const recentMessages = messages.slice(-count);
        return recentMessages.map(msg => {
            const sender = msg.sender === 'user' ? 'Usuário' : 'Assistente';
            const content = msg.content.substring(0, 500); // Limit length
            return `${sender}: ${content}`;
        }).join('\n\n');
    }

    // Format full conversation history for reference
    formatFullConversationHistory(messages) {
        if (!messages || messages.length === 0) return 'Nenhuma conversa anterior.';

        const totalMessages = messages.length;
        const userMessages = messages.filter(msg => msg.sender === 'user').length;
        const assistantMessages = messages.filter(msg => msg.sender === 'assistant').length;

        return `Total de mensagens: ${totalMessages} (${userMessages} do usuário, ${assistantMessages} do assistente)

Primeiras mensagens da conversa:
${this.getRecentMessages(messages.slice(0, 5), 5)}

${totalMessages > 10 ? `
...

Mensagens mais recentes:
${this.getRecentMessages(messages, 10)}` : ''}`;
    }

    // Format all original context tabs for cross-reference
    formatAllOriginalContext(originalContext, excludeTab = null) {
        const contextSections = [];

        const tabNames = {
            master_rules: 'Regras do Mestre',
            character_sheet: 'Ficha de Personagem',
            relations: 'Relações',
            current_plot: 'Plot Atual',
            aventura: 'A Aventura',
            local_history: 'História Local'
        };

        for (const [key, content] of Object.entries(originalContext)) {
            if (key === excludeTab) continue; // Skip the tab being updated

            const tabName = tabNames[key] || key;
            const tabContent = content || '(Vazio)';

            contextSections.push(`=== ${tabName.toUpperCase()} ===
${tabContent.substring(0, 1000)}${tabContent.length > 1000 ? '...' : ''}`);
        }

        return contextSections.join('\n\n');
    }

    // Generate comprehensive context section for prompts
    generateComprehensiveContext(compressedSummary, originalContext, messages, currentTab) {
        const recentMessages = this.getRecentMessages(messages, 15);
        const fullHistory = this.formatFullConversationHistory(messages);
        const allOtherContext = this.formatAllOriginalContext(originalContext, currentTab);
        const currentTabContent = originalContext[currentTab] || '(Vazio)';

        return {
            compressedSummary,
            currentTabContent,
            allOtherContext,
            recentMessages,
            fullHistory
        };
    }

    // Create backup data of all context tabs
    createContextBackupData() {
        const backup = {};
        const tabKeys = ['master_rules', 'character_sheet', 'local_history', 'current_plot', 'relations', 'aventura'];
        
        tabKeys.forEach(key => {
            backup[key] = this.currentChatContext[key] || '';
        });
        
        console.log(`[DEBUG] Backup criado:`, {
            master_rules: backup.master_rules.length + ' chars',
            character_sheet: backup.character_sheet.length + ' chars', 
            local_history: backup.local_history.length + ' chars',
            current_plot: backup.current_plot.length + ' chars',
            relations: backup.relations.length + ' chars',
            aventura: backup.aventura.length + ' chars'
        });
        
        return backup;
    }

    // Generate single comprehensive prompt for individual tab update
    generateSingleRequestPrompt(tabKey, contextBackup, messages) {
        // Format conversation
        const conversationText = messages.map(msg => {
            const sender = msg.sender === 'user' ? 'Usuário' : 'Assistente';
            return `${sender}: ${msg.content}`;
        }).join('\n\n');

        // Format current context
        const contextText = Object.entries(contextBackup)
            .filter(([key, value]) => value && value.trim())
            .map(([key, value]) => {
                const tabNames = {
                    master_rules: 'REGRAS DO MESTRE',
                    character_sheet: 'FICHA DE PERSONAGEM', 
                    local_history: 'HISTÓRIA LOCAL',
                    current_plot: 'PLOT ATUAL',
                    relations: 'RELAÇÕES',
                    aventura: 'A AVENTURA'
                };
                return `=== ${tabNames[key] || key.toUpperCase()} ===\n${value}`;
            }).join('\n\n');

        // Get tab-specific instructions
        const tabInstructions = this.getTabSpecificInstructions(tabKey);
        const tabNames = {
            master_rules: 'Regras do Mestre',
            character_sheet: 'Ficha de Personagem', 
            local_history: 'História Local',
            current_plot: 'Plot Atual',
            relations: 'Relações',
            aventura: 'A Aventura'
        };
        const tabName = tabNames[tabKey] || tabKey;

        const prompt = `Você é um Mestre de RPG experiente. Sua tarefa é atualizar APENAS a seção "${tabName}" baseado na conversa e contexto fornecidos.

=== CONTEXTO ATUAL COMPLETO ===
${contextText}

=== CONVERSA COMPLETA ===
${conversationText}

=== INSTRUÇÕES ESPECÍFICAS ===
${tabInstructions}

=== IMPORTANTE ===
- Analise TODA a conversa e TODO o contexto fornecido
- Atualize APENAS a seção "${tabName}"
- Mantenha a consistência com as outras seções
- Use português brasileiro
- Seja detalhado e preciso
- Responda APENAS com o conteúdo atualizado da seção "${tabName}", sem explicações adicionais

CONTEÚDO ATUALIZADO DA SEÇÃO "${tabName}":`;

        return prompt;
    }

    // Get tab-specific instructions
    getTabSpecificInstructions(tabKey) {
        const instructions = {
            master_rules: `Atualize as regras específicas do mestre para esta campanha, incluindo:
- Regras customizadas ou modificadas
- Mecânicas especiais da campanha
- Diretrizes de interpretação
- Regras de casa estabelecidas`,
            
            character_sheet: `Atualize a ficha do personagem incluindo:
- Atributos e habilidades atuais
- Equipamentos e itens possuídos
- Status de saúde e condições
- Experiência e progressão
- Características pessoais relevantes`,
            
            local_history: `Atualize a história local incluindo:
- Eventos históricos relevantes da região
- Lendas e mitos locais
- Figuras históricas importantes
- Acontecimentos que afetam a área atual`,
            
            current_plot: `Atualize o plot atual incluindo:
- Objetivos principais em andamento
- Missões e tarefas ativas
- Conflitos e desafios atuais
- Próximos passos e desenvolvimentos esperados`,
            
            relations: `Atualize as relações incluindo:
- Relacionamentos com NPCs importantes
- Status com facções e organizações
- Alianças e inimizades
- Reputação em diferentes grupos`,
            
            aventura: `Atualize a narrativa da aventura incluindo:
- Cronologia dos eventos principais
- Marcos importantes da jornada
- Descobertas e revelações significativas
- Desenvolvimento da história principal`
        };
        
        return instructions[tabKey] || `Atualize o conteúdo da seção ${tabKey} baseado na conversa e contexto.`;
    }

    // Generate on-demand summary for sequential processing (legacy)
    async generateOnDemandSummary() {
        try {
            console.log('[DEBUG] Gerando resumo sob demanda para processamento sequencial...');

            // Check if we have enough messages to summarize
            if (!this.messages || this.messages.length < 5) {
                console.log('[DEBUG] Poucas mensagens para resumo, usando conversa direta');
                return this.formatRecentMessagesAsSummary();
            }

            // Create a prompt to summarize the conversation
            const conversationText = this.messages.map(msg => {
                const sender = msg.sender === 'user' ? 'Usuário' : 'Assistente';
                return `${sender}: ${msg.content}`;
            }).join('\n\n');

            const summaryPrompt = `Analise a conversa abaixo e crie um resumo DETALHADO e ABRANGENTE da aventura em português, incluindo:

1. EVENTOS PRINCIPAIS:
   - Ações importantes do personagem
   - Encontros e combates
   - Descobertas e revelações
   - Decisões significativas

2. DESENVOLVIMENTO DO PERSONAGEM:
   - Habilidades adquiridas ou melhoradas
   - Itens obtidos ou perdidos
   - Mudanças na personalidade
   - Experiências marcantes

3. RELACIONAMENTOS:
   - Novos personagens conhecidos
   - Mudanças em relacionamentos existentes
   - Alianças ou conflitos desenvolvidos

4. PROGRESSÃO DA HISTÓRIA:
   - Objetivos alcançados ou modificados
   - Novos desafios ou missões
   - Mudanças no ambiente ou situação

CONVERSA COMPLETA:
${conversationText}

IMPORTANTE: Crie um resumo detalhado que capture todos os aspectos importantes da aventura para permitir atualizações precisas dos contextos.

RESUMO DETALHADO DA AVENTURA:`;

            // Generate summary using Gemini API with extended timeout
            const summaryTimeout = 180000; // 3 minutes for summary generation
            console.log(`[DEBUG] Gerando resumo com timeout estendido (${summaryTimeout/1000}s)...`);
            const summary = await this.callGeminiAPI(summaryPrompt, [], summaryTimeout);
            console.log(`[DEBUG] ✅ Resumo sob demanda gerado (${summary.length} caracteres)`);

            return summary;

        } catch (error) {
            console.error('[DEBUG] Erro ao gerar resumo sob demanda:', error);
            // Fallback to recent messages format
            return this.formatRecentMessagesAsSummary();
        }
    }

    // Format recent messages as a summary fallback
    formatRecentMessagesAsSummary() {
        if (!this.messages || this.messages.length === 0) {
            return 'Nenhuma conversa disponível para resumo.';
        }

        const recentMessages = this.messages.slice(-10); // Last 10 messages
        const summary = recentMessages.map(msg => {
            const sender = msg.sender === 'user' ? 'Usuário' : 'Assistente';
            return `${sender}: ${msg.content.substring(0, 200)}${msg.content.length > 200 ? '...' : ''}`;
        }).join('\n\n');

        return `RESUMO BASEADO NAS MENSAGENS RECENTES:\n\n${summary}`;
    }

    // === END OF CONTEXT PROCESSING FUNCTIONS ===

    // === INDIVIDUAL TAB UPDATE FUNCTIONS ===

    // Show individual tab update confirmation
    showIndividualTabUpdateConfirmation() {
        const currentTab = this.getCurrentActiveTab();
        if (!currentTab) {
            this.showToast('❌ Nenhum tab selecionado', 'error');
            return;
        }

        // Check if we have messages to work with
        if (!this.messages || this.messages.length < 3) {
            this.showToast('❌ Conversa muito curta para atualização. Adicione mais mensagens.', 'warning');
            return;
        }

        const tabNames = {
            master_rules: 'Regras do Mestre',
            local_history: 'História Local',
            character_sheet: 'Ficha de Personagem',
            relations: 'Relações',
            aventura: 'A Aventura',
            current_plot: 'Plot Atual'
        };

        const tabName = tabNames[currentTab] || currentTab;
        const messageCount = this.messages.length;

        // Clear any existing backup to start fresh session
        this.individualUpdateBackup = null;
        console.log(`[DEBUG] Iniciando nova sessão de atualizações individuais`);

        // Show confirmation modal
        const modal = document.getElementById('individualTabModal');
        const title = document.getElementById('individualTabTitle');
        const message = document.getElementById('individualTabMessage');
        const preview = document.getElementById('individualTabPreview');

        title.textContent = `🔄 Atualizar ${tabName}?`;
        message.innerHTML = `
            <strong>Você está prestes a atualizar apenas o tab "${tabName}".</strong>
            <br><br>
            Esta operação irá:
            <ul style="margin: 10px 0 0 20px;">
                <li>Gerar novo conteúdo baseado na conversa atual (${messageCount} mensagens)</li>
                <li>Usar backup original de todos os tabs como referência</li>
                <li>Salvar automaticamente no servidor</li>
                <li>Não afetar outros tabs</li>
            </ul>
            <br>
            <em>💡 Dica: Atualizações subsequentes usarão o mesmo backup original para evitar contaminação.</em>
        `;

        preview.textContent = `Baseado em ${messageCount} mensagens da conversa e contexto original de todos os tabs.`;

        // Store current tab for processing
        this.individualUpdateData = {
            tabKey: currentTab,
            tabName: tabName
        };

        modal.style.display = 'block';
    }

    // Get currently active tab
    getCurrentActiveTab() {
        const activeTabBtn = document.querySelector('.context-tab-btn.active');
        return activeTabBtn ? activeTabBtn.dataset.context : null;
    }

    // Confirm individual tab update
    async confirmIndividualTabUpdate() {
        this.hideIndividualTabModal();

        if (!this.individualUpdateData) {
            this.showToast('❌ Dados de atualização não encontrados', 'error');
            return;
        }

        const { tabKey, tabName } = this.individualUpdateData;

        try {
            // Show processing status
            this.showToast(`🔄 Atualizando ${tabName}...`, 'info');
            this.updateTabStatus(tabKey, '🔄', 'processing');

            // Create or reuse context backup to prevent contamination
            if (!this.individualUpdateBackup) {
                this.individualUpdateBackup = this.createContextBackupData();
                console.log(`[DEBUG] Backup inicial criado para atualizações individuais`);
            } else {
                console.log(`[DEBUG] Reutilizando backup inicial para evitar contaminação`);
            }

            // Process the individual tab using the original backup
            const success = await this.processIndividualTab(tabKey, this.individualUpdateBackup);

            if (success) {
                // Success
                this.updateTabStatus(tabKey, '✅', 'success');
                this.showToast(`✅ ${tabName} atualizado com sucesso!`, 'success');

                // Refresh the context modal if open (skip saving to preserve new content)
                this.refreshContextModalIfOpen(true);

                // Force update the textarea with new content if it's the active tab
                const textarea = document.getElementById('contextTextArea');
                if (textarea && this.getCurrentActiveTab() === tabKey) {
                    const newContent = this.currentChatContext[tabKey] || '';
                    textarea.value = newContent;
                    console.log(`[DEBUG] Forçando atualização da textarea para ${tabKey} com ${newContent.length} caracteres`);

                    // Trigger events to ensure UI updates
                    textarea.dispatchEvent(new Event('input', { bubbles: true }));
                    textarea.dispatchEvent(new Event('change', { bubbles: true }));
                }

            } else {
                // Failed
                this.updateTabStatus(tabKey, '❌', 'error');
                this.showToast(`❌ Erro ao atualizar ${tabName}`, 'error');
            }

        } catch (error) {
            // Error occurred
            this.updateTabStatus(tabKey, '❌', 'error');
            this.showToast(`❌ Erro ao atualizar ${tabName}: ${error.message}`, 'error');
            console.error(`[DEBUG] Erro na atualização individual de ${tabKey}:`, error);
        }

        // Clear update data
        this.individualUpdateData = null;
    }

    // Hide individual tab modal
    hideIndividualTabModal() {
        const modal = document.getElementById('individualTabModal');
        modal.style.display = 'none';
    }

    // Update individual tab controls visibility and content
    updateIndividualTabControls() {
        const controls = document.querySelector('.individual-tab-controls');
        const updateBtn = document.getElementById('updateCurrentTabBtn');
        const currentTab = this.getCurrentActiveTab();

        if (!controls || !updateBtn) return;

        // Define which tabs can be individually updated
        const updatableTabs = ['character_sheet', 'relations', 'current_plot', 'aventura'];

        if (updatableTabs.includes(currentTab)) {
            // Show controls for updatable tabs
            controls.style.display = 'block';

            // Update button text based on current tab
            const tabNames = {
                character_sheet: 'Ficha de Personagem',
                relations: 'Relações',
                current_plot: 'Plot Atual',
                aventura: 'A Aventura'
            };

            const tabName = tabNames[currentTab] || currentTab;
            updateBtn.textContent = `🔄 Atualizar ${tabName}`;

        } else {
            // Hide controls for non-updatable tabs (master_rules, local_history)
            controls.style.display = 'none';
        }
    }

    // === END OF INDIVIDUAL TAB UPDATE FUNCTIONS ===

    // Função para comprimir histórico (sem limpeza automática)
    async compressHistory() {
        if (!this.currentChatId) {
            this.showToast('❌ Salve a conversa antes de comprimir o histórico.', 'error');
            return;
        }

        const confirmation = confirm(
            'Esta ação irá:\n\n' +
            '1. Comprimir o histórico da conversa em um resumo\n' +
            '2. Atualizar automaticamente os contextos da aventura\n' +
            '3. Salvar o resumo no contexto da aventura\n\n' +
            'As mensagens originais serão mantidas.\n' +
            'Esta ação não pode ser desfeita. Continuar?'
        );

        if (!confirmation) return;

        try {
            // Comprimir histórico
            const compressedHistory = await this.compressConversationHistory();
            if (!compressedHistory) return;

            // Atualizar contextos automaticamente
            const contextsUpdated = await this.updateContextsAfterCompression(compressedHistory.summary);
            if (!contextsUpdated) {
                this.showToast('⚠️ Compressão realizada, mas houve problemas ao atualizar contextos.', 'warning');
            }

            // Salvar no contexto
            const saved = await this.saveCompressedHistoryToContext(compressedHistory);
            if (!saved) return;

            // Registrar timestamp da compressão
            this.currentChatContext.lastCompressionTime = Date.now();
            console.log('[DEBUG] Timestamp de compressão registrado:', new Date(this.currentChatContext.lastCompressionTime).toLocaleString('pt-BR'));

            // Salvar conversa atualizada
            await this.autoSaveChat();

            this.showToast('✅ Compressão concluída! Contextos atualizados automaticamente.', 'success');

        } catch (error) {
            console.error('Erro no processo de compressão:', error);
            this.showToast('❌ Erro durante a compressão: ' + error.message, 'error');
        }
    }

    // Verificar se a aventura foi realmente salva no servidor
    async verifyAventuraPersistence() {
        if (!this.currentChatId) return;

        try {
            console.log('[DEBUG] Verificando persistência da aventura...');
            const response = await fetch(`${this.serverUrl}/api/chats/${this.currentChatId}`);

            if (response.ok) {
                const chat = await response.json();
                // FIXED: Extract aventura from nested context object
                const serverAventura = chat.context?.aventura || chat.aventura || '';
                const localAventura = this.currentChatContext.aventura || '';

                console.log(`[DEBUG] Aventura local: ${localAventura.length} caracteres`);
                console.log(`[DEBUG] Aventura servidor (nested): ${chat.context?.aventura?.length || 0} caracteres`);
                console.log(`[DEBUG] Aventura servidor (direct): ${chat.aventura?.length || 0} caracteres`);
                console.log(`[DEBUG] Aventura servidor (final): ${serverAventura.length} caracteres`);

                if (serverAventura.length > 0 && serverAventura === localAventura) {
                    console.log('[DEBUG] ✅ Aventura verificada: dados persistidos corretamente');
                    this.showToast('✅ Aventura salva e verificada com sucesso!', 'success');
                } else if (serverAventura.length === 0) {
                    console.error('[DEBUG] ❌ ERRO: Aventura não foi salva no servidor!');
                    this.showToast('❌ ERRO CRÍTICO: Aventura não foi salva no servidor!', 'error');
                } else {
                    console.warn('[DEBUG] ⚠️ Aventura salva mas com diferenças');
                    this.showToast('⚠️ Aventura salva com possíveis diferenças', 'warning');
                }
            } else {
                console.error('[DEBUG] Erro ao verificar aventura:', response.status);
            }
        } catch (error) {
            console.error('[DEBUG] Erro na verificação da aventura:', error);
        }
    }

    // Função manual para forçar salvamento da aventura (para debugging)
    async forceSaveAventura() {
        if (!this.currentChatId) {
            this.showToast('❌ Nenhuma conversa ativa', 'error');
            return;
        }

        try {
            console.log('[DEBUG] Forçando salvamento da aventura...');
            console.log('[DEBUG] Conteúdo atual da aventura:', this.currentChatContext.aventura?.length || 0, 'caracteres');

            const success = await this.saveUpdatedContextToServer();
            if (success) {
                await this.verifyAventuraPersistence();
                this.showToast('✅ Aventura salva manualmente!', 'success');
            } else {
                this.showToast('❌ Erro ao salvar aventura', 'error');
            }
        } catch (error) {
            console.error('[DEBUG] Erro no salvamento manual:', error);
            this.showToast('❌ Erro no salvamento manual: ' + error.message, 'error');
        }
    }

    // Função de debug para aventura
    async debugAventura() {
        console.log('[DEBUG] === AVENTURA DEBUG REPORT ===');
        console.log('[DEBUG] Chat ID:', this.currentChatId);
        console.log('[DEBUG] Aventura local length:', this.currentChatContext.aventura?.length || 0);
        console.log('[DEBUG] Aventura local preview:', this.currentChatContext.aventura?.substring(0, 100) || '(empty)');

        // Debug compression time
        const compressionCheck = this.checkRecentCompression();
        console.log('[DEBUG] Compression check:', compressionCheck);

        if (!this.currentChatId) {
            this.showToast('❌ Nenhuma conversa ativa para debug', 'error');
            return;
        }

        const options = [
            'Verificar Persistência',
            'Forçar Salvamento',
            'Recarregar do Servidor',
            'Adicionar Conteúdo de Teste',
            'Cancelar'
        ];

        const choice = prompt(
            '🔍 DEBUG AVENTURA\n\n' +
            'Escolha uma opção:\n' +
            '1 - Verificar Persistência\n' +
            '2 - Forçar Salvamento\n' +
            '3 - Recarregar do Servidor\n' +
            '4 - Adicionar Conteúdo de Teste\n' +
            '5 - Cancelar\n\n' +
            'Digite o número da opção:'
        );

        switch (choice) {
            case '1':
                await this.verifyAventuraPersistence();
                break;
            case '2':
                await this.forceSaveAventura();
                break;
            case '3':
                await this.reloadChatFromServer();
                break;
            case '4':
                await this.addTestAventuraContent();
                break;
            default:
                this.showToast('Debug cancelado', 'info');
        }
    }

    async reloadChatFromServer() {
        if (!this.currentChatId) return;

        try {
            console.log('[DEBUG] Recarregando chat do servidor...');
            await this.loadChat(this.currentChatId);
            this.showToast('✅ Chat recarregado do servidor', 'success');
        } catch (error) {
            console.error('[DEBUG] Erro ao recarregar:', error);
            this.showToast('❌ Erro ao recarregar: ' + error.message, 'error');
        }
    }

    async addTestAventuraContent() {
        const testContent = `=== AVENTURA DE TESTE ===
Gerado em: ${new Date().toLocaleString('pt-BR')}

Esta é uma aventura de teste para verificar a persistência do campo aventura.

HISTÓRICO DA AVENTURA:
O herói começou sua jornada na taverna do Javali Dourado, onde conheceu um mago misterioso que lhe ofereceu uma missão perigosa mas lucrativa. Após aceitar, partiu em direção à Floresta Sombria.

Na floresta, enfrentou um grupo de goblins que guardavam um baú com moedas de ouro. Após derrotá-los, descobriu um mapa que levava à cidade de Pedravale.

EVENTOS RECENTES:
Chegou à cidade de Pedravale ao entardecer. Conheceu a guarda da cidade e descobriu pistas sobre um tesouro perdido nas montanhas próximas. Agora planeja sua próxima aventura.

=== FIM DO TESTE ===`;

        this.currentChatContext.aventura = testContent;
        console.log('[DEBUG] Conteúdo de teste adicionado:', testContent.length, 'caracteres');

        await this.forceSaveAventura();
        this.refreshContextModalIfOpen();
    }

    // Verificar se compressão foi realizada recentemente (LEGACY - apenas compressão sequencial)
    checkRecentCompression() {
        const lastCompressionTime = this.currentChatContext.lastCompressionTime;
        const now = Date.now();
        const tenMinutesInMs = 10 * 60 * 1000; // 10 minutos em milissegundos

        if (!lastCompressionTime) {
            console.log('[DEBUG] Nenhuma compressão sequencial registrada');
            return {
                isRecent: false,
                timeSinceCompression: null,
                message: 'Nenhuma compressão sequencial foi realizada nesta conversa'
            };
        }

        const timeSinceCompression = now - lastCompressionTime;
        const minutesSinceCompression = Math.floor(timeSinceCompression / (60 * 1000));
        const isRecent = timeSinceCompression <= tenMinutesInMs;

        console.log(`[DEBUG] Última compressão sequencial: ${new Date(lastCompressionTime).toLocaleString('pt-BR')}`);
        console.log(`[DEBUG] Tempo desde compressão sequencial: ${minutesSinceCompression} minutos`);
        console.log(`[DEBUG] Compressão sequencial recente (≤10min): ${isRecent}`);

        return {
            isRecent,
            timeSinceCompression,
            minutesSinceCompression,
            lastCompressionDate: new Date(lastCompressionTime).toLocaleString('pt-BR'),
            message: isRecent
                ? `Compressão sequencial realizada há ${minutesSinceCompression} minutos`
                : `Última compressão sequencial há ${minutesSinceCompression} minutos (mais de 10 minutos)`
        };
    }

    // Verificar se QUALQUER tipo de compressão foi realizada (sequencial OU individual)
    checkAnyCompressionActivity() {
        const now = Date.now();
        const tenMinutesInMs = 10 * 60 * 1000; // 10 minutos em milissegundos

        // Check sequential compression
        const sequentialCompression = this.checkRecentCompression();

        // Check individual tab updates (look for recent content in context tabs)
        const contextTabs = ['character_sheet', 'relations', 'current_plot', 'aventura'];
        let hasRecentIndividualUpdates = false;
        let individualUpdateInfo = [];

        contextTabs.forEach(tabKey => {
            const content = this.currentChatContext[tabKey];
            if (content && content.length > 100) { // Substantial content indicates processing
                // Check if content looks like it was recently generated (contains recent patterns)
                const hasRecentPatterns = content.includes('Com base em') ||
                                        content.includes('Baseado na conversa') ||
                                        content.includes('Analisando') ||
                                        content.length > 1000; // Substantial content suggests recent generation

                if (hasRecentPatterns) {
                    hasRecentIndividualUpdates = true;
                    individualUpdateInfo.push({
                        tab: tabKey,
                        contentLength: content.length,
                        tabName: this.getTabDisplayName(tabKey)
                    });
                }
            }
        });

        console.log('[DEBUG] Verificação de compressão abrangente:');
        console.log('[DEBUG] - Compressão sequencial:', sequentialCompression.isRecent ? 'SIM' : 'NÃO');
        console.log('[DEBUG] - Atualizações individuais detectadas:', hasRecentIndividualUpdates ? 'SIM' : 'NÃO');
        console.log('[DEBUG] - Tabs com conteúdo substancial:', individualUpdateInfo.map(info => info.tabName).join(', '));

        // Determine overall compression status
        const hasAnyCompression = sequentialCompression.isRecent || hasRecentIndividualUpdates;

        // Generate comprehensive message
        let compressionMessage = '';
        let compressionType = '';

        if (sequentialCompression.isRecent && hasRecentIndividualUpdates) {
            compressionType = 'COMPRESSÃO COMPLETA';
            compressionMessage = `Compressão sequencial (${sequentialCompression.minutesSinceCompression} min atrás) + Atualizações individuais detectadas em: ${individualUpdateInfo.map(info => info.tabName).join(', ')}`;
        } else if (sequentialCompression.isRecent) {
            compressionType = 'COMPRESSÃO SEQUENCIAL';
            compressionMessage = `Compressão sequencial realizada há ${sequentialCompression.minutesSinceCompression} minutos`;
        } else if (hasRecentIndividualUpdates) {
            compressionType = 'ATUALIZAÇÕES INDIVIDUAIS';
            compressionMessage = `Atualizações individuais detectadas em: ${individualUpdateInfo.map(info => `${info.tabName} (${info.contentLength} chars)`).join(', ')}`;
        } else {
            compressionType = 'NENHUMA COMPRESSÃO';
            compressionMessage = 'Nenhuma atividade de compressão detectada (nem sequencial nem individual)';
        }

        return {
            hasAnyCompression,
            compressionType,
            compressionMessage,
            sequentialCompression,
            individualUpdates: {
                detected: hasRecentIndividualUpdates,
                tabs: individualUpdateInfo
            }
        };
    }

    // Helper function to get display names for tabs
    getTabDisplayName(tabKey) {
        const tabNames = {
            character_sheet: 'Ficha de Personagem',
            relations: 'Relações',
            current_plot: 'Plot Atual',
            aventura: 'A Aventura',
            master_rules: 'Regras do Mestre',
            local_history: 'História Local'
        };
        return tabNames[tabKey] || tabKey;
    }

    // Função separada para limpar mensagens antigas com proteções avançadas baseadas em tempo
    async clearOldMessages() {
        if (!this.currentChatId) {
            this.showToast('❌ Salve a conversa antes de limpar mensagens.', 'error');
            return;
        }

        if (this.messages.length < 15) {
            this.showToast('❌ Histórico muito curto para limpeza. Mínimo de 15 mensagens necessário.', 'warning');
            return;
        }

        // Verificar se QUALQUER tipo de compressão foi realizada (sequencial OU individual)
        const compressionCheck = this.checkAnyCompressionActivity();
        console.log('[DEBUG] Resultado da verificação abrangente de compressão:', compressionCheck);

        // Mostrar aviso informativo sobre status de compressão (NÃO BLOQUEAR)
        let compressionWarning = '';

        if (compressionCheck.hasAnyCompression) {
            // Algum tipo de compressão foi detectado
            compressionWarning = `✅ ${compressionCheck.compressionType} DETECTADA\n\n` +
                               `${compressionCheck.compressionMessage}\n\n` +
                               `Seu histórico tem alguma proteção através da compressão detectada.`;
        } else {
            // Nenhuma compressão detectada
            compressionWarning = `⚠️ NENHUMA COMPRESSÃO DETECTADA\n\n` +
                               `Não foi detectada compressão sequencial nem atualizações individuais de contexto.\n\n` +
                               `RECOMENDAÇÃO: Considere fazer uma compressão ou atualizar alguns contextos antes da limpeza para preservar informações importantes.`;
        }

        // Mostrar aviso informativo (permite prosseguir independentemente)
        const proceedWithCleanup = confirm(
            compressionWarning + '\n\n' +
            '🗑️ DESEJA PROSSEGUIR COM A LIMPEZA?\n\n' +
            '✅ Clique OK para continuar com a limpeza das mensagens\n' +
            '❌ Clique Cancelar para voltar e fazer compressão primeiro\n\n' +
            '(Você pode prosseguir independentemente do status de compressão)'
        );

        if (!proceedWithCleanup) {
            // Usuário escolheu não prosseguir
            this.showToast('🔄 Limpeza cancelada. Considere fazer compressão primeiro.', 'info');
            return;
        }

        // Prosseguir com confirmações (independentemente do status de compressão)
        console.log('[DEBUG] ✅ Usuário optou por prosseguir com limpeza, status de compressão:', compressionCheck.compressionType);

        // Calculate message statistics
        const totalMessages = this.messages.length;
        const messagesToKeep = 10;
        const messagesToDelete = totalMessages - messagesToKeep;

        // Get date range of messages to be deleted
        const oldestMessage = this.messages[0];
        const newestToDelete = this.messages[messagesToDelete - 1];
        const oldestDate = new Date(oldestMessage.timestamp || Date.now()).toLocaleDateString('pt-BR');
        const newestDeleteDate = new Date(newestToDelete.timestamp || Date.now()).toLocaleDateString('pt-BR');

        // First confirmation with detailed information including comprehensive compression status
        let compressionStatusText = '';
        if (compressionCheck.hasAnyCompression) {
            compressionStatusText = `✅ ${compressionCheck.compressionType}\n${compressionCheck.compressionMessage}`;

            // Add sequential compression date if available
            if (compressionCheck.sequentialCompression.isRecent) {
                compressionStatusText += `\n📅 Compressão sequencial: ${compressionCheck.sequentialCompression.lastCompressionDate}`;
            }

            // Add individual updates info if available
            if (compressionCheck.individualUpdates.detected) {
                compressionStatusText += `\n📝 Atualizações individuais: ${compressionCheck.individualUpdates.tabs.length} tabs atualizados`;
            }
        } else {
            compressionStatusText = `⚠️ ${compressionCheck.compressionType}\n${compressionCheck.compressionMessage}`;
        }

        const firstConfirmation = confirm(
            `🗑️ CONFIRMAÇÃO DE LIMPEZA\n\n` +
            `${compressionStatusText}\n\n` +
            `📊 ESTATÍSTICAS:\n` +
            `• Total de mensagens: ${totalMessages}\n` +
            `• Mensagens a serem removidas: ${messagesToDelete}\n` +
            `• Mensagens que serão mantidas: ${messagesToKeep}\n\n` +
            `📅 PERÍODO A SER REMOVIDO:\n` +
            `• De: ${oldestDate}\n` +
            `• Até: ${newestDeleteDate}\n\n` +
            `⚠️ Esta ação não pode ser desfeita!\n\n` +
            `Continuar para confirmação final?`
        );

        if (!firstConfirmation) return;

        // Second confirmation requiring typed confirmation
        const confirmationText = prompt(
            `🔒 CONFIRMAÇÃO FINAL\n\n` +
            `Para confirmar a remoção de ${messagesToDelete} mensagens,\n` +
            `digite exatamente: CONFIRMAR\n\n` +
            `(Digite CONFIRMAR em maiúsculas ou deixe vazio para cancelar)`
        );

        if (confirmationText !== 'CONFIRMAR') {
            if (confirmationText !== null) {
                this.showToast('❌ Confirmação incorreta. Limpeza cancelada.', 'warning');
            }
            return;
        }

        try {
            console.log(`[DEBUG] Iniciando limpeza de ${messagesToDelete} mensagens do banco PostgreSQL...`);
            
            // Identificar mensagens a serem removidas (todas exceto as últimas 10)
            const messagesToRemove = this.messages.slice(0, messagesToDelete);
            const messagesToKeepLocal = this.messages.slice(-messagesToKeep);
            
            console.log(`[DEBUG] Mensagens a remover do banco:`, messagesToRemove.map(m => m.id));
            console.log(`[DEBUG] Mensagens a manter:`, messagesToKeepLocal.map(m => m.id));

            // Remover mensagens do banco PostgreSQL via API
            let deletedCount = 0;
            let failedCount = 0;
            
            this.showToast('🔄 Removendo mensagens do banco de dados...', 'info');
            
            for (const message of messagesToRemove) {
                try {
                    console.log(`[DEBUG] Removendo mensagem ${message.id} do banco...`);
                    
                    const response = await fetch(`${this.serverUrl}/api/messages/${message.id}`, {
                        method: 'DELETE',
                        headers: {
                            'Content-Type': 'application/json'
                        }
                    });

                    if (response.ok) {
                        deletedCount++;
                        console.log(`[DEBUG] ✅ Mensagem ${message.id} removida do banco com sucesso`);
                    } else {
                        failedCount++;
                        const errorText = await response.text();
                        console.error(`[DEBUG] ❌ Falha ao remover mensagem ${message.id}: ${response.status} - ${errorText}`);
                    }
                } catch (error) {
                    failedCount++;
                    console.error(`[DEBUG] ❌ Erro ao remover mensagem ${message.id}:`, error);
                }
            }

            console.log(`[DEBUG] Remoção do banco concluída: ${deletedCount} removidas, ${failedCount} falharam`);

            // Atualizar mensagens localmente (manter apenas as recentes)
            this.messages = messagesToKeepLocal;

            // Limpar e recriar UI
            this.clearMessages();
            this.messages.forEach(msg => {
                this.addMessageToUI(msg.sender, msg.content, msg.files || [], msg.id, msg.status || 'sent');
            });

            // Salvar conversa atualizada no banco
            await this.autoSaveChat();

            // Enhanced success feedback
            let successMessage = `✅ Limpeza concluída!\n🗑️ ${deletedCount} mensagens removidas do banco\n📝 ${messagesToKeep} mensagens mantidas`;
            
            if (failedCount > 0) {
                successMessage += `\n⚠️ ${failedCount} mensagens falharam na remoção`;
            }
            
            this.showToast(successMessage, deletedCount > 0 ? 'success' : 'warning');

            console.log(`[DEBUG] Limpeza concluída: ${deletedCount} removidas do banco, ${failedCount} falharam, ${messagesToKeep} mantidas localmente`);

        } catch (error) {
            console.error('Erro ao limpar mensagens:', error);
            this.showToast('❌ Erro ao limpar mensagens: ' + error.message, 'error');
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

    // Processar resposta com streaming SSE da API Gemini - Versão Robusta
    async processStreamingResponse(response, model) {
        console.log(`[STREAMING] Processando resposta streaming SSE para modelo ${model}`);
        
        if (!response.body) {
            console.log('[STREAMING] Fallback para response.json() - sem streaming disponível');
            return await response.json();
        }

        try {
            const reader = response.body.getReader();
            const decoder = new TextDecoder('utf-8', { fatal: false });
            let buffer = '';
            let completeText = '';
            let totalBytesReceived = 0;
            let totalChunksReceived = 0;
            let candidates = [];
            let lastValidCandidate = null;
            let connectionStable = true;
            
            console.log('[STREAMING] Iniciando leitura streaming SSE robusta...');
            
            // Timeout mais generoso para chunks grandes
            const chunkTimeout = 45000; // 45 segundos por chunk
            const maxRetries = 3;
            let consecutiveErrors = 0;
            
            while (true) {
                let chunkResult = null;
                let retryCount = 0;
                
                // Sistema de retry para chunks individuais
                while (retryCount <= maxRetries) {
                    try {
                        const chunkPromise = reader.read();
                        const timeoutPromise = new Promise((_, reject) => 
                            setTimeout(() => reject(new Error(`Timeout no chunk após ${chunkTimeout}ms`)), chunkTimeout)
                        );
                        
                        chunkResult = await Promise.race([chunkPromise, timeoutPromise]);
                        consecutiveErrors = 0; // Reset contador de erros
                        break;
                        
                    } catch (chunkError) {
                        retryCount++;
                        consecutiveErrors++;
                        console.warn(`[STREAMING] Erro no chunk (tentativa ${retryCount}/${maxRetries + 1}):`, chunkError.message);
                        
                        if (retryCount <= maxRetries) {
                            // Delay progressivo entre retries
                            const delay = Math.min(1000 * retryCount, 5000);
                            console.log(`[STREAMING] Aguardando ${delay}ms antes de retry...`);
                            await new Promise(resolve => setTimeout(resolve, delay));
                            connectionStable = false;
                        } else {
                            throw chunkError;
                        }
                    }
                }
                
                const { done, value } = chunkResult;
                
                if (done) {
                    console.log(`[STREAMING] Streaming concluído - Total: ${totalBytesReceived} bytes em ${totalChunksReceived} chunks`);
                    break;
                }
                
                totalBytesReceived += value.length;
                totalChunksReceived++;
                
                // Decodificar chunk com tratamento de erro
                let chunk;
                try {
                    chunk = decoder.decode(value, { stream: true });
                } catch (decodeError) {
                    console.warn('[STREAMING] Erro na decodificação, tentando recuperar:', decodeError);
                    // Tentar decodificação alternativa
                    chunk = new TextDecoder('utf-8', { fatal: false }).decode(value);
                }
                
                buffer += chunk;
                
                console.log(`[STREAMING] Chunk ${totalChunksReceived} recebido: ${chunk.length} chars (Total: ${totalBytesReceived} bytes)`);
                
                // Debug: mostrar conteúdo do chunk para diagnóstico
                if (totalChunksReceived <= 3) {
                    console.log(`[STREAMING] DEBUG Chunk ${totalChunksReceived} content (primeiros 500 chars):`, chunk.substring(0, 500));
                }
                
                // A API Gemini retorna JSON array contínuo, não SSE padrão
                // Processar como array JSON separado por vírgulas
                
                // Debug: mostrar estrutura do buffer para os primeiros chunks
                if (totalChunksReceived <= 3) {
                    console.log(`[STREAMING] DEBUG Buffer structure: "${buffer.substring(0, 300)}..."`);
                }
                
                // Tentar processar o buffer como array JSON
                let jsonObjects = [];
                
                // Primeiro, tentar extrair objetos JSON completos do buffer
                try {
                    // Adicionar colchetes se necessário para formar array válido
                    let jsonArrayString = buffer.trim();
                    
                    // Se não começa com [, adicionar
                    if (!jsonArrayString.startsWith('[')) {
                        jsonArrayString = '[' + jsonArrayString;
                    }
                    
                    // Se não termina com ], adicionar (pode estar incompleto)
                    if (!jsonArrayString.endsWith(']')) {
                        // Tentar encontrar o último objeto completo
                        const lastBraceIndex = jsonArrayString.lastIndexOf('}');
                        if (lastBraceIndex !== -1) {
                            const completeJson = jsonArrayString.substring(0, lastBraceIndex + 1) + ']';
                            const remainingJson = jsonArrayString.substring(lastBraceIndex + 1);
                            
                            try {
                                jsonObjects = JSON.parse(completeJson);
                                buffer = remainingJson; // Manter parte incompleta
                                console.log(`[STREAMING] Parsed ${jsonObjects.length} JSON objects from buffer`);
                            } catch (parseError) {
                                console.log(`[STREAMING] JSON array parse failed, trying individual objects`);
                            }
                        }
                    } else {
                        // Buffer completo, tentar parse direto
                        jsonObjects = JSON.parse(jsonArrayString);
                        buffer = ''; // Limpar buffer
                        console.log(`[STREAMING] Parsed complete JSON array with ${jsonObjects.length} objects`);
                    }
                } catch (arrayParseError) {
                    // Se falhar como array, tentar extrair objetos individuais
                    console.log(`[STREAMING] Array parse failed, extracting individual JSON objects`);
                    
                    const jsonStrings = buffer.split(/(?<=})\s*,\s*(?={)/);
                    for (let i = 0; i < jsonStrings.length - 1; i++) {
                        const jsonStr = jsonStrings[i].replace(/^,\s*/, '').trim();
                        if (jsonStr) {
                            try {
                                const jsonObj = JSON.parse(jsonStr);
                                jsonObjects.push(jsonObj);
                            } catch (objParseError) {
                                console.warn(`[STREAMING] Failed to parse individual JSON: ${jsonStr.substring(0, 100)}`);
                            }
                        }
                    }
                    // Manter último fragmento no buffer (pode estar incompleto)
                    buffer = jsonStrings[jsonStrings.length - 1] || '';
                }
                
                // Processar objetos JSON extraídos
                for (const eventData of jsonObjects) {
                    if (totalChunksReceived <= 3) {
                        console.log(`[STREAMING] DEBUG eventData keys:`, Object.keys(eventData));
                        console.log(`[STREAMING] DEBUG eventData full:`, JSON.stringify(eventData, null, 2));
                    }
                    
                    // Extrair texto do evento
                    if (eventData.candidates && Array.isArray(eventData.candidates) && eventData.candidates.length > 0) {
                        const candidate = eventData.candidates[0];
                        
                        if (candidate && candidate.content && candidate.content.parts && Array.isArray(candidate.content.parts)) {
                            for (const part of candidate.content.parts) {
                                if (part && typeof part.text === 'string' && part.text.length > 0) {
                                    completeText += part.text;
                                    console.log(`[STREAMING] Texto adicionado: ${part.text.length} chars (Total: ${completeText.length})`);
                                }
                            }
                        }
                        
                        // Manter referência do último candidato válido
                        lastValidCandidate = candidate;
                        candidates = eventData.candidates;
                    }
                    
                    // Fallback: tentar extrair texto de outras estruturas possíveis
                    else if (eventData.text && typeof eventData.text === 'string') {
                        completeText += eventData.text;
                        console.log(`[STREAMING] Texto direto adicionado: ${eventData.text.length} chars`);
                    }
                    else if (eventData.content && typeof eventData.content === 'string') {
                        completeText += eventData.content;
                        console.log(`[STREAMING] Conteúdo direto adicionado: ${eventData.content.length} chars`);
                    }
                    else if (eventData.delta && eventData.delta.text) {
                        completeText += eventData.delta.text;
                        console.log(`[STREAMING] Delta text adicionado: ${eventData.delta.text.length} chars`);
                    }
                }
                
                // Código antigo SSE (manter como fallback)
                const lines = buffer.split('\n');
                const sseBuffer = lines.pop() || '';
                
                for (const line of lines) {
                    const trimmedLine = line.trim();
                    
                    // Processar linha de dados SSE (fallback)
                    if (trimmedLine.startsWith('data: ')) {
                        const jsonData = trimmedLine.substring(6); // Remove "data: "
                        
                        // SSE fallback - não deve ser necessário com novo parser
                        console.log('[STREAMING] SSE fallback - processando linha SSE tradicional');
                        
                        if (jsonData === '[DONE]') {
                            console.log('[STREAMING] Recebido sinal de fim do streaming');
                            continue;
                        }
                        
                        if (!jsonData || jsonData.length < 2) {
                            continue;
                        }
                        
                        try {
                            const eventData = JSON.parse(jsonData);
                            
                            if (eventData.candidates && Array.isArray(eventData.candidates) && eventData.candidates.length > 0) {
                                const candidate = eventData.candidates[0];
                                
                                if (candidate && candidate.content && candidate.content.parts && Array.isArray(candidate.content.parts)) {
                                    for (const part of candidate.content.parts) {
                                        if (part && typeof part.text === 'string' && part.text.length > 0) {
                                            completeText += part.text;
                                            console.log(`[STREAMING] SSE Fallback - Texto adicionado: ${part.text.length} chars`);
                                        }
                                    }
                                }
                                
                                lastValidCandidate = candidate;
                                candidates = eventData.candidates;
                            }
                            
                        } catch (parseError) {
                            console.warn('[STREAMING] SSE fallback parse error:', parseError.message);
                        }
                    }
                }
                
                // Atualizar buffer com dados SSE restantes
                buffer = sseBuffer;
                
                // Verificar se a conexão está estável
                if (!connectionStable && consecutiveErrors === 0) {
                    connectionStable = true;
                    console.log('[STREAMING] Conexão estabilizada');
                }
            }
            
            // Processar qualquer dado restante no buffer com validação
            if (buffer.trim()) {
                console.log('[STREAMING] Processando dados restantes no buffer...');
                const remainingLines = buffer.trim().split('\n');
                
                for (const remainingLine of remainingLines) {
                    if (remainingLine.startsWith('data: ')) {
                        const jsonData = remainingLine.substring(6);
                        if (jsonData && jsonData !== '[DONE]') {
                            try {
                                const eventData = JSON.parse(jsonData);
                                if (eventData.candidates && eventData.candidates.length > 0) {
                                    const candidate = eventData.candidates[0];
                                    if (candidate.content && candidate.content.parts) {
                                        for (const part of candidate.content.parts) {
                                            if (part.text) {
                                                completeText += part.text;
                                                console.log('[STREAMING] Texto do buffer adicionado:', part.text.length);
                                            }
                                        }
                                    }
                                    candidates = eventData.candidates;
                                }
                            } catch (parseError) {
                                console.warn('[STREAMING] Erro no buffer restante:', parseError.message);
                            }
                        }
                    }
                }
            }
            
            // Validação final do texto recebido
            if (!completeText || completeText.length === 0) {
                console.warn('[STREAMING] AVISO: Nenhum texto foi recebido via streaming');
                
                // Tentar extrair de candidatos se disponível
                if (lastValidCandidate && lastValidCandidate.content && lastValidCandidate.content.parts) {
                    for (const part of lastValidCandidate.content.parts) {
                        if (part.text) {
                            completeText += part.text;
                        }
                    }
                }
            }
            
            console.log(`[STREAMING] ✅ Texto completo recebido: ${completeText.length} caracteres em ${totalChunksReceived} chunks`);
            console.log(`[STREAMING] Preview (primeiros 200 chars): ${completeText.substring(0, 200)}...`);
            console.log(`[STREAMING] Conexão ${connectionStable ? 'estável' : 'instável'} durante o processo`);
            
            // Validação crítica antes de construir resposta
            if (!completeText || completeText.length === 0) {
                console.error('[STREAMING] ❌ ERRO CRÍTICO: Texto vazio após processamento completo');
                console.error('[STREAMING] Debug - candidates:', candidates);
                console.error('[STREAMING] Debug - lastValidCandidate:', lastValidCandidate);
                console.error('[STREAMING] Debug - totalBytes:', totalBytesReceived);
                console.error('[STREAMING] Debug - chunks:', totalChunksReceived);
                
                // Retornar resposta vazia estruturada para permitir fallback
                return {
                    candidates: [],
                    streamingStats: {
                        totalBytes: totalBytesReceived,
                        totalChunks: totalChunksReceived,
                        textLength: 0,
                        connectionStable: connectionStable,
                        emptyResponse: true
                    }
                };
            }
            
            console.log('[STREAMING] 🔧 Construindo resposta estruturada...');
            
            // Construir resposta no formato esperado com validação
            const responseData = {
                candidates: candidates.length > 0 ? candidates.map(candidate => ({
                    ...candidate,
                    content: {
                        parts: [{ text: completeText }],
                        role: 'model'
                    }
                })) : [{
                    content: {
                        parts: [{ text: completeText }],
                        role: 'model'
                    },
                    finishReason: 'STOP'
                }],
                streamingStats: {
                    totalBytes: totalBytesReceived,
                    totalChunks: totalChunksReceived,
                    textLength: completeText.length,
                    connectionStable: connectionStable
                }
            };
            
            console.log('[STREAMING] 🔍 Validando estrutura da resposta...');
            console.log(`[STREAMING] Candidates count: ${responseData.candidates.length}`);
            console.log(`[STREAMING] First candidate text length: ${responseData.candidates[0]?.content?.parts?.[0]?.text?.length || 0}`);
            
            console.log('[STREAMING] ✅ Resposta streaming processada com sucesso');
            return responseData;
            
        } catch (streamError) {
            console.error('[STREAMING] ❌ Erro crítico no streaming:', streamError.message);
            console.error('[STREAMING] Stack trace:', streamError.stack);
            
            // Fallback robusto para método tradicional
            try {
                console.log('[STREAMING] 🔄 Tentando fallback para response.json()...');
                const fallbackData = await response.json();
                console.log('[STREAMING] ✅ Fallback bem-sucedido');
                return fallbackData;
            } catch (fallbackError) {
                console.error('[STREAMING] ❌ Fallback também falhou:', fallbackError.message);
                throw new Error(`Falha na recepção da resposta: Streaming (${streamError.message}) e Fallback (${fallbackError.message})`);
            }
        }
    }

    // Função auxiliar para tentar reparar JSON malformado
    attemptJsonRepair(jsonString) {
        try {
            // Remover caracteres de controle e espaços extras
            let cleaned = jsonString.replace(/[\x00-\x1F\x7F-\x9F]/g, '').trim();
            
            // Tentar fechar chaves/colchetes não fechados
            const openBraces = (cleaned.match(/\{/g) || []).length;
            const closeBraces = (cleaned.match(/\}/g) || []).length;
            const openBrackets = (cleaned.match(/\[/g) || []).length;
            const closeBrackets = (cleaned.match(/\]/g) || []).length;
            
            // Adicionar chaves fechadas se necessário
            for (let i = 0; i < openBraces - closeBraces; i++) {
                cleaned += '}';
            }
            
            // Adicionar colchetes fechados se necessário
            for (let i = 0; i < openBrackets - closeBrackets; i++) {
                cleaned += ']';
            }
            
            // Testar se o JSON reparado é válido
            JSON.parse(cleaned);
            return cleaned;
            
        } catch (error) {
            return null;
        }
    }

    // Validar integridade da resposta streaming
    validateStreamingResponse(responseData, model) {
        console.log('[STREAMING] Validando integridade da resposta...');
        
        if (!responseData) {
            console.warn('[STREAMING] ⚠️ Resposta vazia recebida');
            return false;
        }

        if (!responseData.candidates || !Array.isArray(responseData.candidates) || responseData.candidates.length === 0) {
            console.warn('[STREAMING] ⚠️ Nenhum candidato encontrado na resposta');
            return false;
        }

        const candidate = responseData.candidates[0];
        if (!candidate.content || !candidate.content.parts || !Array.isArray(candidate.content.parts)) {
            console.warn('[STREAMING] ⚠️ Estrutura de conteúdo inválida');
            return false;
        }

        const textParts = candidate.content.parts.filter(part => part.text && part.text.length > 0);
        if (textParts.length === 0) {
            console.warn('[STREAMING] ⚠️ Nenhum texto encontrado na resposta');
            return false;
        }

        const totalTextLength = textParts.reduce((sum, part) => sum + part.text.length, 0);
        console.log(`[STREAMING] ✅ Validação bem-sucedida: ${totalTextLength} caracteres em ${textParts.length} partes`);

        // Log estatísticas se disponíveis
        if (responseData.streamingStats) {
            const stats = responseData.streamingStats;
            console.log(`[STREAMING] 📊 Estatísticas: ${stats.totalBytes} bytes, ${stats.totalChunks} chunks, conexão ${stats.connectionStable ? 'estável' : 'instável'}`);
            
            // Alertar sobre possíveis problemas
            if (!stats.connectionStable) {
                console.warn('[STREAMING] ⚠️ Conexão instável detectada durante o streaming');
            }
            
            if (stats.totalChunks > 100) {
                console.log(`[STREAMING] 📈 Resposta longa: ${stats.totalChunks} chunks processados`);
            }
        }

        return true;
    }

    // Sistema de recuperação para mensagens incompletas
    async attemptMessageRecovery(originalResponse, model, retryCount = 0) {
        const maxRetries = 2;
        
        if (retryCount >= maxRetries) {
            console.error('[STREAMING] ❌ Máximo de tentativas de recuperação atingido');
            return null;
        }

        console.log(`[STREAMING] 🔄 Tentativa de recuperação ${retryCount + 1}/${maxRetries}`);
        
        try {
            // Aguardar um pouco antes de tentar novamente
            await new Promise(resolve => setTimeout(resolve, 2000 * (retryCount + 1)));
            
            // Tentar reprocessar a resposta original
            if (originalResponse && originalResponse.body) {
                console.log('[STREAMING] Tentando reprocessar resposta original...');
                const recoveredData = await this.processStreamingResponse(originalResponse, model);
                
                if (this.validateStreamingResponse(recoveredData, model)) {
                    console.log('[STREAMING] ✅ Recuperação bem-sucedida');
                    return recoveredData;
                }
            }
            
            return null;
            
        } catch (recoveryError) {
            console.error(`[STREAMING] Erro na recuperação (tentativa ${retryCount + 1}):`, recoveryError.message);
            return await this.attemptMessageRecovery(originalResponse, model, retryCount + 1);
        }
    }

    // Chamar API Gemini com streaming para recepção completa
    async callGeminiAPI(message, files = [], timeoutMs = 120000) {
        console.log('[DEBUG] Iniciando chamada da API Gemini com streaming...');
        const apiKey = this.apiKeys[this.activeApiKey];
        const model = this.selectedModel;

        console.log(`[DEBUG] API Key: ${apiKey ? apiKey.substring(0, 10) + '...' : 'NÃO CONFIGURADA'}`);
        console.log(`[DEBUG] Modelo: ${model}`);
        console.log(`[DEBUG] Timeout configurado: ${timeoutMs}ms (${timeoutMs/1000}s)`);
        console.log(`[DEBUG] this.selectedModel no início da chamada: ${this.selectedModel}`);
        console.log('[DEBUG] Streaming habilitado para recepção completa');

        if (!apiKey) {
            throw new Error('Chave da API não configurada');
        }

        // Construir histórico de mensagens
        const history = [];
        
        // Adicionar mensagens do histórico
        this.messages.forEach(msg => {
            const parts = [];
            
            // Adicionar texto da mensagem se existir
            if (msg.content && msg.content.trim() !== '') {
                parts.push({ text: String(msg.content) });
            }
            
            // Adicionar arquivos anexos se existirem
            if (msg.files && msg.files.length > 0) {
                msg.files.forEach(file => {
                    if (file.base64Data) {
                        const base64Data = file.base64Data.includes(',') ? 
                            file.base64Data.split(',')[1] : 
                            file.base64Data;
                            
                        parts.push({
                            inline_data: {
                                mime_type: file.mimeType || 'application/octet-stream',
                                data: base64Data
                            }
                        });
                    }
                });
            }
            
            // Só adiciona ao histórico se houver conteúdo
            if (parts.length > 0) {
                history.push({
                    role: msg.sender === 'user' ? 'user' : 'model',
                    parts: parts
                });
            }
        });

        const systemInstruction = this.getSystemInstruction();
        console.log(`[DEBUG] System instruction: ${systemInstruction ? 'PRESENTE' : 'AUSENTE'}`);

        // Construir mensagem atual
        const currentUserMessageParts = [];

        // Adicionar texto da mensagem atual se existir
        if (message && message.trim() !== '') {
            // Add formatting reinforcement to the message
            const messageWithFormatting = this.addFormattingReinforcement(message);
            
            // Adicionar instrução de narração automaticamente ao final da mensagem - WFGY Optimized
            const narrativeInstruction = `

🎯 **[COMANDO EXECUTIVO - DENSIDADE NARRATIVA MÁXIMA]**

**[NÚCLEO ATIVO]** - Processe a AÇÃO MAIS RECENTE DO JOGADOR como nó central de impacto

**[MATRIZ CAUSAL]** - Gere cascata de consequências:
• Resultados imediatos da ação (físicos/mecânicos)
• Reações dos NPCs presentes (emocionais/comportamentais)
• Mudanças ambientais (atmosféricas/contextuais)
• Reverberações sociais (reputação/relacionamentos)

**[CATALISADORES NARRATIVOS]** - Injete elementos de progressão:
• Revelação de informação nova
• Surgimento de oportunidade/ameaça
• Evolução de conflito existente
• Abertura de caminho narrativo

**[RESIDUAIS EMERGENTES]** - Capture elementos ocultos:
• Detalhes sensoriais únicos
• Micro-expressões de NPCs
• Pistas ambientais sutis
• Potencial de reviravolta

**[ARESTAS TEMPORAIS]** - Conecte passado→presente→futuro:
• Ecos de eventos anteriores
• Implicações para objetivos atuais
• Sementes para desenvolvimentos futuros

⚡ **IMPERATIVO**: Termine com gancho narrativo que demande resposta/decisão do jogador. NUNCA conclua sem avanço tangível da trama.`;
            const messageWithNarrative = messageWithFormatting + narrativeInstruction;
            
            currentUserMessageParts.push({ text: String(messageWithNarrative) });
        }
        
        // Adicionar arquivos anexos da mensagem atual
        if (files && files.length > 0) {
            files.forEach(file => {
                if (file.base64Data) {
                    const base64Data = file.base64Data.includes(',') ? 
                        file.base64Data.split(',')[1] : 
                        file.base64Data;
                        
                    currentUserMessageParts.push({
                        inline_data: {
                            mime_type: file.mimeType || 'application/octet-stream',
                            data: base64Data
                        }
                    });
                }
            });
        }

        // Garantir que sempre há pelo menos uma parte na mensagem
        if (currentUserMessageParts.length === 0) {
            currentUserMessageParts.push({ text: " " });
        }

        // Filtrar histórico para remover mensagens com partes vazias
        let validHistory = history.filter(msg => 
            msg.parts && msg.parts.length > 0 && 
            msg.parts.some(part => (part.text && part.text.trim()) || part.inline_data)
        );

        // Histórico completo disponível - sem limitação artificial

        // Inserir system_instruction como parte do histórico (one-shot prompt)
        if (systemInstruction) {
            const systemPrompt = [
                { role: 'user', parts: [{ text: systemInstruction }] },
                { role: 'model', parts: [{ text: "Ok, entendi. Cumprirei rigorosamente minhas instruções e responderei à próxima mensagem do usuário." }] }
            ];
            validHistory = [...systemPrompt, ...validHistory];
        }

        // Criar corpo da requisição compatível com gemini-2.5-pro
        const requestBody = {
            contents: [
                ...validHistory,
                { role: 'user', parts: currentUserMessageParts }
            ],
            generationConfig: {
                temperature: 0.7,
                maxOutputTokens: 8192, // Restaurar limite original
            },
        };

        // O system_instruction foi movido para o histórico de mensagens.

        console.log('[DEBUG] Request body contents length:', requestBody.contents.length);
        console.log('[DEBUG] Request body:', JSON.stringify(requestBody, null, 2));
        
        // Calcular estimativa de tokens do prompt
        const promptText = JSON.stringify(requestBody.contents);
        const estimatedTokens = Math.ceil(promptText.length / 4); // Estimativa aproximada
        console.log(`[DEBUG] Estimativa de tokens do prompt: ${estimatedTokens} (limite: 1.048.576)`);
        
        // Log de tokens para monitoramento (sem limitação)
        if (estimatedTokens > 500000) {
            console.warn(`[DEBUG] INFO: Prompt longo (${estimatedTokens} tokens estimados)`);
        }
        
        // Verificar se há problemas na estrutura da requisição
        console.log('[DEBUG] Validando estrutura da requisição...');
        requestBody.contents.forEach((content, index) => {
            console.log(`[DEBUG] Content ${index}:`, {
                role: content.role,
                partsCount: content.parts?.length,
                hasText: content.parts?.some(p => p.text),
                hasInlineData: content.parts?.some(p => p.inline_data)
            });
        });

        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?key=${apiKey}`;
        const controller = new AbortController();
        const timeoutId = setTimeout(() => {
            console.log(`[DEBUG] Timeout de ${timeoutMs}ms atingido, abortando requisição...`);
            controller.abort();
        }, timeoutMs);

        try {
            console.log('[DEBUG] Fazendo requisição streaming para:', url.replace(apiKey, 'API_KEY_HIDDEN'));
            console.log(`[DEBUG] Modelo sendo usado na URL: ${model}`);
            
            // Usar streaming real da API Gemini
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'text/event-stream'
                },
                body: JSON.stringify(requestBody),
                signal: controller.signal
            });
            
            clearTimeout(timeoutId);

            console.log(`[DEBUG] Status da resposta: ${response.status}`);
            
            // Processar resposta com streaming para garantir recepção completa
            console.log('[DEBUG] 🔄 Iniciando processamento streaming...');
            const responseData = await this.processStreamingResponse(response, model);
            console.log('[DEBUG] ✅ Streaming processado, validando dados...');
            
            // Verificar se retornou array vazio e fazer fallback para não-streaming
            if (responseData.streamingStats && responseData.streamingStats.textLength === 0 && responseData.streamingStats.totalBytes <= 10) {
                console.log(`[DEBUG] ${model} retornou array vazio (${responseData.streamingStats.totalBytes} bytes), tentando fallback não-streaming`);
                
                // Fazer nova requisição sem streaming
                const nonStreamingUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
                
                try {
                    const fallbackResponse = await fetch(nonStreamingUrl, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify(requestBody)
                    });
                    
                    if (fallbackResponse.ok) {
                        const fallbackData = await fallbackResponse.json();
                        console.log(`[DEBUG] Fallback não-streaming bem-sucedido para ${model}`);
                        console.log('[DEBUG] Resposta fallback:', JSON.stringify(fallbackData, null, 2));
                        
                        // Usar dados do fallback
                        const processedData = {
                            ...fallbackData,
                            streamingStats: {
                                totalBytes: JSON.stringify(fallbackData).length,
                                totalChunks: 1,
                                textLength: fallbackData.candidates?.[0]?.content?.parts?.[0]?.text?.length || 0,
                                connectionStable: true,
                                fallbackUsed: true
                            }
                        };
                        
                        this.validateStreamingResponse(processedData, model);
                        
                        // Extrair texto da resposta fallback
                        const candidate = processedData.candidates?.[0];
                        const text = candidate?.content?.parts?.[0]?.text || '';
                        
                        if (!text) {
                            console.error('[DEBUG] Fallback retornou resposta sem texto válido');
                            console.error('[DEBUG] Candidate content:', JSON.stringify(candidate?.content, null, 2));
                            console.error('[DEBUG] Safety ratings:', JSON.stringify(candidate?.safetyRatings, null, 2));
                            console.error('[DEBUG] Finish reason:', candidate?.finishReason);
                            
                            // Verificar se foi bloqueado por segurança
                            const isBlocked = candidate?.finishReason === 'SAFETY' || 
                                            candidate?.safetyRatings?.some(rating => 
                                                rating.probability === 'HIGH' || rating.probability === 'MEDIUM'
                                            );
                            
                            if (isBlocked) {
                                return 'Desculpe, não posso responder a essa mensagem devido às configurações de segurança. Tente reformular sua pergunta de forma diferente.';
                            } else {
                                // Tentar com configurações de segurança mais permissivas
                                console.log('[DEBUG] Tentando novamente com configurações de segurança mais permissivas...');
                                throw new Error('Response blocked - will retry with different safety settings');
                            }
                        }
                        
                        console.log(`[DEBUG] Texto extraído do fallback: ${text.length} caracteres`);
                        return text;
                    } else {
                        const errorText = await fallbackResponse.text();
                        console.error(`[DEBUG] Fallback não-streaming falhou para ${model}: ${fallbackResponse.status} - ${errorText}`);
                        throw new Error(`Fallback request failed: ${fallbackResponse.status} ${fallbackResponse.statusText}`);
                    }
                } catch (fallbackError) {
                    console.error(`[DEBUG] Erro no fallback não-streaming para ${model}:`, fallbackError);
                    throw new Error(`Streaming retornou array vazio e fallback falhou: ${fallbackError.message}`);
                }
            }
            
            // Verificar integridade da resposta recebida
            console.log('[DEBUG] 🔍 Validando integridade da resposta...');
            this.validateStreamingResponse(responseData, model);
            console.log('[DEBUG] ✅ Resposta validada com sucesso');
            
            if (!response.ok) {
                console.error('[DEBUG] Erro da API Gemini:', responseData);
                throw new Error(`API Error: ${response.status} ${response.statusText}`);
                const isCapacityError = response.status === 500 ||
                                      errorMessage.includes('resource_exhausted') ||
                                      errorMessage.includes('capacity');

                // Fornecer mensagens de erro mais específicas sem retry automático
                if (isRateLimitError) {
                    console.error(`[DEBUG] Rate limit detectado - HTTP ${response.status}`);
                    throw new Error(`Rate limit atingido. Aguarde alguns segundos antes de tentar novamente. (HTTP ${response.status})`);
                } else if (isCapacityError) {
                    console.error(`[DEBUG] Erro de capacidade detectado - HTTP ${response.status}`);
                    throw new Error(`Servidor temporariamente sobrecarregado. Tente novamente em alguns segundos. (HTTP ${response.status})`);
                }

                throw new Error(responseData.error?.message ||
                              `HTTP error! status: ${response.status}`);
            }

            console.log('[DEBUG] Resposta da API recebida com sucesso');
            console.log(`[DEBUG] Modelo usado na resposta: ${model}`);
            console.log('[DEBUG] Resposta completa da API:', JSON.stringify(responseData, null, 2));

            // Logging adicional para investigar resposta vazia
            console.log('[DEBUG] responseData.candidates existe?', !!responseData.candidates);
            console.log('[DEBUG] responseData.candidates.length:', responseData.candidates ? responseData.candidates.length : 'N/A');
            if (responseData.candidates && responseData.candidates[0]) {
                const firstCandidate = responseData.candidates[0];
                console.log('[DEBUG] Primeiro candidate keys:', Object.keys(firstCandidate));
                console.log('[DEBUG] candidate.content keys:', firstCandidate.content ? Object.keys(firstCandidate.content) : 'content não existe');
            }

            // Verificar estrutura da resposta com tratamento mais robusto
            if (!responseData.candidates || responseData.candidates.length === 0) {
                console.error(`[DEBUG] ERRO: Nenhum candidato na resposta do modelo ${model}:`, responseData);
                throw new Error(`API ${model} não retornou candidatos de resposta`);
            }

            const candidate = responseData.candidates[0];
            
            // Atualizar estatísticas se disponível
            if (responseData.usageMetadata) {
                const totalTokens = responseData.usageMetadata.totalTokenCount || 0;
                const promptTokens = responseData.usageMetadata.promptTokenCount || 0;
                const candidatesTokens = responseData.usageMetadata.candidatesTokenCount || 0;

                console.log(`[DEBUG] Token usage - Total: ${totalTokens}, Prompt: ${promptTokens}, Response: ${candidatesTokens}`);
                this.incrementStatistics(model, totalTokens);
            } else {
                console.warn('[DEBUG] usageMetadata não disponível na resposta da API');
                // Fallback: estimate tokens from response text
                const responseText = candidate.content?.parts?.[0]?.text || '';
                const estimatedTokens = this.estimateTokens(responseText);
                console.log(`[DEBUG] Usando estimativa de tokens: ${estimatedTokens}`);
                this.incrementStatistics(model, estimatedTokens);
            }
            
            // Verificar se há bloqueio por segurança primeiro
            if (candidate.finishReason === 'SAFETY') {
                console.error(`[DEBUG] ERRO: Resposta do modelo ${model} bloqueada por filtros de segurança`);
                console.error(`[DEBUG] Safety ratings:`, candidate.safetyRatings);
                throw new Error(`Resposta do modelo ${model} bloqueada por filtros de segurança. Tente reformular sua mensagem.`);
            }

            // Verificar se há tokens consumidos (indica que o processamento ocorreu)
            const tokensConsumed = responseData.usageMetadata?.totalTokenCount || 0;
            const candidateTokens = responseData.usageMetadata?.candidatesTokenCount || 0;

            console.log(`[DEBUG] ${model}: Tokens consumidos - Total: ${tokensConsumed}, Candidatos: ${candidateTokens}`);

            // Verificar se a resposta contém apenas categorias de segurança (bug conhecido da API)
            const responseStr = JSON.stringify(responseData);
            const hasOnlySafetyCategories = responseStr.includes('HARM_CATEGORY_') && !responseStr.includes('"text"');
            const hasEmptyContent = !candidate.content || !candidate.content.parts || candidate.content.parts.length === 0;
            
            if (hasOnlySafetyCategories || (candidate.finishReason === 'STOP' && hasEmptyContent && tokensConsumed > 0)) {
                console.error(`[DEBUG] ERRO: Resposta do modelo ${model} contém apenas categorias de segurança sem texto`);
                console.error(`[DEBUG] Resposta problemática:`, responseStr.substring(0, 500));
                
                // Removed automatic fallback - user must manually retry or change model
                throw new Error(`Modelo ${model} retornou apenas categorias de segurança. Tente reformular sua mensagem ou usar Gemini 2.5 Flash.`);
            }

            // Esta verificação foi movida para o bloco anterior para unificar o tratamento

            // Log detalhado da estrutura do candidato para debug
            console.log(`[DEBUG] Estrutura completa do candidate (${model}):`, JSON.stringify(candidate, null, 2));
            console.log(`[DEBUG] candidate.content existe (${model})?`, !!candidate.content);
            console.log(`[DEBUG] candidate.content.parts existe (${model})?`, !!(candidate.content && candidate.content.parts));
            console.log(`[DEBUG] candidate.content.parts length (${model}):`, candidate.content && candidate.content.parts ? candidate.content.parts.length : 'N/A');
            console.log(`[DEBUG] finishReason (${model}):`, candidate.finishReason);
            
            // Verificar se há conteúdo válido (compatível com gemini-2.5-pro e outras versões)
            let parts = null;
            let responseText = '';

            console.log(`[DEBUG] Iniciando extração de conteúdo para modelo ${model}`);

            // Tentar diferentes estruturas de resposta com abordagem mais robusta
            if (candidate.content && candidate.content.parts && candidate.content.parts.length > 0) {
                parts = candidate.content.parts;
                console.log(`[DEBUG] ${model}: Usando candidate.content.parts (${parts.length} partes)`);
            } else if (candidate.parts && candidate.parts.length > 0) {
                parts = candidate.parts;
                console.log(`[DEBUG] ${model}: Usando candidate.parts (${parts.length} partes)`);
            } else if (candidate.text && candidate.text.trim() !== '') {
                // Algumas versões podem retornar texto diretamente
                responseText = candidate.text;
                console.log(`[DEBUG] ${model}: Usando candidate.text diretamente (${responseText.length} chars)`);
            } else if (candidate.content && candidate.content.text && candidate.content.text.trim() !== '') {
                responseText = candidate.content.text;
                console.log(`[DEBUG] ${model}: Usando candidate.content.text (${responseText.length} chars)`);
            } else {
                console.error(`[DEBUG] ${model}: NENHUMA estrutura de resposta reconhecida!`);
                console.error(`[DEBUG] ${model}: candidate keys:`, Object.keys(candidate));
                console.error(`[DEBUG] ${model}: candidate.content:`, candidate.content);

                // Tentar extrair qualquer texto disponível como último recurso
                const candidateStr = JSON.stringify(candidate);
                console.error(`[DEBUG] ${model}: Tentando busca de texto em toda a estrutura...`);

                // Buscar por qualquer propriedade que contenha texto
                function findTextInObject(obj, path = '') {
                    if (typeof obj === 'string' && obj.trim().length > 10) {
                        console.log(`[DEBUG] ${model}: Texto encontrado em ${path}: ${obj.substring(0, 100)}...`);
                        return obj;
                    }
                    if (typeof obj === 'object' && obj !== null) {
                        for (const [key, value] of Object.entries(obj)) {
                            const result = findTextInObject(value, path ? `${path}.${key}` : key);
                            if (result) return result;
                        }
                    }
                    return null;
                }

                const foundText = findTextInObject(candidate);
                if (foundText) {
                    responseText = foundText;
                    console.log(`[DEBUG] ${model}: Texto recuperado via busca profunda (${responseText.length} chars)`);
                }
            }

            // Se temos parts, extrair texto delas
            if (parts && parts.length > 0) {
                console.log(`[DEBUG] ${model}: Processando ${parts.length} partes`);
                for (let i = 0; i < parts.length; i++) {
                    const part = parts[i];
                    console.log(`[DEBUG] ${model}: Parte ${i}:`, JSON.stringify(part, null, 2));
                    if (part.text) {
                        responseText += part.text;
                        console.log(`[DEBUG] ${model}: Texto adicionado da parte ${i} (${part.text.length} chars)`);
                    } else {
                        console.log(`[DEBUG] ${model}: Parte ${i} não contém texto`);
                    }
                }
            }

            console.log(`[DEBUG] ${model}: Texto final extraído: ${responseText.length} chars`);
            console.log(`[DEBUG] ${model}: Texto final (primeiros 200 chars): ${responseText.substring(0, 200)}`);

            // Verificar se temos texto válido com validação mais leniente
            const trimmedText = responseText ? responseText.trim() : '';
            if (!trimmedText || trimmedText.length === 0) {
                console.error(`[DEBUG] ${model}: ERRO - Nenhum texto válido encontrado`);
                console.error(`[DEBUG] ${model}: responseText original:`, responseText);
                console.error(`[DEBUG] ${model}: responseText.length:`, responseText ? responseText.length : 'null/undefined');
                console.error(`[DEBUG] ${model}: trimmedText.length:`, trimmedText.length);
                console.error(`[DEBUG] ${model}: Parts encontradas:`, parts);
                console.error(`[DEBUG] ${model}: Candidate completo:`, candidate);

                // Para gemini-2.5-flash, tentar recuperação mais agressiva
                if (model.includes('flash')) {
                    console.warn(`[DEBUG] ${model}: Tentando recuperação especial para flash model...`);

                    // Tentar extrair de qualquer propriedade que contenha "text"
                    const responseStr = JSON.stringify(responseData);
                    console.log(`[DEBUG] ${model}: Buscando texto em resposta completa...`);

                    // Buscar padrões de texto mais flexíveis
                    const textPatterns = [
                        /"text"\s*:\s*"([^"]+)"/g,
                        /"content"\s*:\s*"([^"]+)"/g,
                        /"message"\s*:\s*"([^"]+)"/g,
                        /"response"\s*:\s*"([^"]+)"/g
                    ];

                    for (const pattern of textPatterns) {
                        const matches = [...responseStr.matchAll(pattern)];
                        if (matches.length > 0) {
                            const extractedText = matches.map(match => match[1]).join(' ').trim();
                            if (extractedText.length > 10) {
                                console.log(`[DEBUG] ${model}: Texto recuperado via padrão ${pattern}: ${extractedText.substring(0, 100)}...`);
                                return extractedText.replace(/\\n/g, '\n').replace(/\\"/g, '"');
                            }
                        }
                    }

                    // Se ainda não encontrou, tentar busca mais ampla
                    const allTextMatches = responseStr.match(/"[^"]{20,}"/g);
                    if (allTextMatches && allTextMatches.length > 0) {
                        const longestText = allTextMatches
                            .map(match => match.slice(1, -1))
                            .sort((a, b) => b.length - a.length)[0];

                        if (longestText && longestText.length > 20) {
                            console.log(`[DEBUG] ${model}: Texto recuperado via busca ampla: ${longestText.substring(0, 100)}...`);
                            return longestText.replace(/\\n/g, '\n').replace(/\\"/g, '"');
                        }
                    }
                }
                
                // Verificar se o finishReason indica problema específico
                if (candidate.finishReason === 'STOP' && (!candidate.content || !candidate.content.parts || candidate.content.parts.length === 0)) {
                    // Caso especial: API retornou STOP mas sem conteúdo
                    console.error(`[DEBUG] ${model}: DIAGNÓSTICO DETALHADO - STOP sem conteúdo:`);
                    console.error(`[DEBUG] ${model}: - finishReason:`, candidate.finishReason);
                    console.error(`[DEBUG] ${model}: - candidate.content:`, candidate.content);
                    console.error(`[DEBUG] ${model}: - candidate.content.role:`, candidate.content?.role);
                    console.error(`[DEBUG] ${model}: - Possível causa: API processou mas não gerou texto`);
                    console.error(`[DEBUG] ${model}: - usageMetadata:`, responseData.usageMetadata);
                    console.error(`[DEBUG] ${model}: - thoughtsTokenCount:`, responseData.usageMetadata?.thoughtsTokenCount);
                    
                    // Se há thoughtsTokenCount mas sem resposta, pode ser um problema interno da API
                    if (responseData.usageMetadata?.thoughtsTokenCount > 0) {
                        console.error(`[DEBUG] ${model}: API gastou tokens em "thoughts" mas não retornou resposta`);
                        console.error(`[DEBUG] ${model}: Isso indica que a API processou internamente mas falhou ao gerar o texto final`);
                        console.error(`[DEBUG] ${model}: Possíveis causas: filtro interno, bug da API, ou problema de serialização`);

                        // Tentar uma abordagem alternativa: verificar se há outras propriedades na resposta
                        console.error(`[DEBUG] ${model}: Verificando propriedades alternativas...`);
                        console.error(`[DEBUG] ${model}: responseData keys:`, Object.keys(responseData));

                        throw new Error(`A API ${model} processou sua mensagem mas não conseguiu gerar uma resposta. Isso pode ser um problema temporário da API. Tente novamente em alguns segundos.`);
                    }

                    throw new Error(`API ${model} retornou resposta vazia. Verifique se a mensagem não viola políticas de conteúdo ou tente reformular.`);
                } else if (candidate.finishReason && candidate.finishReason !== 'STOP') {
                    console.error(`[DEBUG] ${model}: ERRO - finishReason inválido: ${candidate.finishReason}`);

                    // Para gemini-2.5-flash, ser mais tolerante com finishReason diferentes
                    if (model.includes('flash') && candidate.finishReason === 'COMPLETE') {
                        console.warn(`[DEBUG] ${model}: Aceitando finishReason 'COMPLETE' para modelo flash`);
                        // Continuar processamento mesmo com finishReason diferente
                    } else {
                        throw new Error(`Resposta incompleta do modelo ${model}: ${candidate.finishReason}`);
                    }
                }

                // Se chegamos aqui e não temos texto, mas temos um finishReason válido para flash
                if (model.includes('flash') && candidate.finishReason &&
                    ['STOP', 'COMPLETE', 'FINISHED'].includes(candidate.finishReason)) {
                    console.warn(`[DEBUG] ${model}: Tentando recuperação especial para modelo flash`);

                    // Tentar extrair texto de qualquer lugar na resposta
                    const fullResponse = JSON.stringify(responseData);
                    const textMatches = fullResponse.match(/"text"\s*:\s*"([^"]+)"/g);
                    if (textMatches && textMatches.length > 0) {
                        const extractedText = textMatches.map(match => {
                            const textMatch = match.match(/"text"\s*:\s*"([^"]+)"/);
                            return textMatch ? textMatch[1] : '';
                        }).join(' ').trim();

                        if (extractedText.length > 0) {
                            console.log(`[DEBUG] ${model}: Texto recuperado via regex: ${extractedText.substring(0, 100)}...`);
                            return extractedText.replace(/\\n/g, '\n').replace(/\\"/g, '"');
                        }
                    }

                    // Se ainda não conseguiu extrair texto, mas a API indicou sucesso, retornar erro mais específico
                    console.error(`[DEBUG] ${model}: API retornou finishReason=${candidate.finishReason} mas sem texto extraível`);
                    throw new Error(`Modelo ${model} processou a requisição (${candidate.finishReason}) mas não retornou texto válido. Isso pode ser um problema temporário da API.`);
                }

                console.error(`[DEBUG] ${model}: ERRO - Resposta vazia sem finishReason específico`);
                throw new Error(`Resposta vazia da API ${model}`);
            }
            
            console.log(`[DEBUG] ${model}: SUCESSO - Texto da resposta (${responseText.length} chars): ${responseText.substring(0, 200)}${responseText.length > 200 ? '...' : ''}`);

            // Adicionar aviso se a resposta foi cortada
            if (candidate.finishReason === 'MAX_TOKENS') {
                console.warn(`[DEBUG] ${model}: A resposta foi cortada por atingir o limite máximo de tokens.`);
                responseText += '\n\n[... Resposta cortada por limite de tokens ...]';
            }

            console.log(`[DEBUG] ${model}: Retornando resposta válida com ${responseText.trim().length} caracteres`);
            return responseText.trim();
        } catch (error) {
            clearTimeout(timeoutId); // Limpar timeout em caso de erro
            console.error('[DEBUG] Erro ao chamar a API Gemini:', error);

            // Tratamento específico para AbortError (timeout)
            if (error.name === 'AbortError') {
                console.error(`[DEBUG] Requisição abortada por timeout (${timeoutMs}ms)`);
                throw new Error(`Timeout: A requisição demorou mais que ${timeoutMs/1000} segundos. Tente usar um prompt menor ou aguarde alguns minutos antes de tentar novamente.`);
            }

            throw error;
        }
    }

    addMessageToHistory(sender, content, files = []) {
        const messageId = this.generateMessageId();
        this.messages.push({
            id: messageId,
            sender,
            content,
            files: files || [],
            status: 'sent',
            retryCount: 0,
            timestamp: Date.now()
        });
        return messageId;
    }

    // Update message status in UI and data
    updateMessageStatus(messageId, status, errorMessage = null) {
        // Update in messages array
        const messageIndex = this.messages.findIndex(msg => msg.id === messageId);
        if (messageIndex !== -1) {
            this.messages[messageIndex].status = status;
            if (errorMessage) {
                this.messages[messageIndex].errorMessage = errorMessage;
            }
        }

        // Update UI element
        const messageElement = document.querySelector(`[data-message-id="${messageId}"]`);
        const statusElement = document.querySelector(`.message-status[data-message-id="${messageId}"]`);

        if (messageElement) {
            messageElement.dataset.status = status;
        }

        if (statusElement) {
            statusElement.className = `message-status ${status}`;

            // Update status dot and add retry button if failed
            if (status === 'failed') {
                // Find the message to get retry count and error info
                const message = this.messages.find(msg => msg.id === messageId);
                const retryCount = message ? (message.retryCount || 0) : 0;
                const maxRetries = 5;
                const canRetry = retryCount < maxRetries;

                let retryButtonHtml = '';
                if (canRetry) {
                    retryButtonHtml = `
                        <button class="retry-btn" onclick="geminiChatMobile.retryMessage('${messageId}')"
                                title="Tentar novamente (${retryCount}/${maxRetries} tentativas)">
                            <i class="fas fa-redo"></i>
                        </button>
                    `;
                } else {
                    retryButtonHtml = `
                        <span class="retry-limit" title="Limite de tentativas atingido">
                            <i class="fas fa-exclamation-triangle"></i>
                        </span>
                    `;
                }

                statusElement.innerHTML = `
                    <span class="status-dot"></span>
                    ${retryButtonHtml}
                `;
            } else if (status === 'pending') {
                statusElement.innerHTML = `
                    <span class="status-dot"></span>
                    <span class="pending-indicator">
                        <i class="fas fa-spinner fa-spin"></i>
                    </span>
                `;
            } else {
                statusElement.innerHTML = `<span class="status-dot"></span>`;
            }
        }
    }

    // Save pending/failed messages to localStorage
    savePendingMessages() {
        const pendingMessages = this.messages.filter(msg =>
            msg.status === 'pending' || msg.status === 'failed'
        );
        localStorage.setItem('gemini_pending_messages', JSON.stringify(pendingMessages));
    }

    // Load pending messages from localStorage
    loadPendingMessages() {
        const saved = localStorage.getItem('gemini_pending_messages');
        if (saved) {
            try {
                const pendingMessages = JSON.parse(saved);
                return pendingMessages.filter(msg =>
                    msg.status === 'pending' || msg.status === 'failed'
                );
            } catch (error) {
                console.error('Error loading pending messages:', error);
                return [];
            }
        }
        return [];
    }

    // Clear pending messages from localStorage
    clearPendingMessages() {
        localStorage.removeItem('gemini_pending_messages');
    }

    // Clear individual update backup (call when starting new chat or session)
    clearIndividualUpdateBackup() {
        this.individualUpdateBackup = null;
        console.log(`[DEBUG] Backup de atualizações individuais limpo`);
    }

    // Categorize errors for better user feedback
    categorizeError(error) {
        const message = error.message || 'Erro desconhecido';

        // Network errors
        if (error.name === 'TypeError' && message.includes('fetch')) {
            return {
                type: 'network',
                message: 'Erro de conexão de rede',
                userMessage: 'Erro de conexão. Verifique sua internet e tente novamente.'
            };
        }

        // API Key errors
        if (message.includes('API key') || message.includes('authentication') || message.includes('unauthorized')) {
            return {
                type: 'auth',
                message: 'Erro de autenticação',
                userMessage: 'Chave da API inválida. Verifique suas configurações.'
            };
        }

        // Rate limit errors
        if (message.includes('quota') || message.includes('rate limit') || message.includes('resource_exhausted')) {
            return {
                type: 'quota',
                message: 'Limite de uso excedido',
                userMessage: 'Limite de uso da API excedido. Tente novamente mais tarde.'
            };
        }

        // Server errors
        if (message.includes('500') || message.includes('502') || message.includes('503') || message.includes('504')) {
            return {
                type: 'server',
                message: 'Erro do servidor',
                userMessage: 'Erro temporário do servidor. Tente novamente em alguns momentos.'
            };
        }

        // Content policy errors
        if (message.includes('safety') || message.includes('policy') || message.includes('blocked')) {
            return {
                type: 'content',
                message: 'Conteúdo bloqueado por políticas',
                userMessage: 'Mensagem bloqueada pelas políticas de segurança. Reformule sua pergunta.'
            };
        }

        // Generic error
        return {
            type: 'unknown',
            message: message,
            userMessage: `Erro: ${message}`
        };
    }

    // Retry a failed message (manual user-initiated retry only)
    async retryMessage(messageId) {
        const messageIndex = this.messages.findIndex(msg => msg.id === messageId);
        if (messageIndex === -1) {
            this.showToast('❌ Mensagem não encontrada', 'error');
            return;
        }

        const message = this.messages[messageIndex];
        if (message.sender !== 'user') {
            this.showToast('❌ Apenas mensagens do usuário podem ser reenviadas', 'error');
            return;
        }

        // Check retry limit to prevent infinite retries
        const maxRetries = 5;
        const currentRetryCount = message.retryCount || 0;
        if (currentRetryCount >= maxRetries) {
            this.showToast(`❌ Limite de tentativas atingido (${maxRetries}). Tente reformular a mensagem.`, 'error');
            return;
        }

        // Increment retry count
        message.retryCount = currentRetryCount + 1;

        // Update status to pending and disable retry button temporarily
        this.updateMessageStatus(messageId, 'pending');

        // Disable retry button during processing
        const retryBtn = document.querySelector(`.mobile-message[data-message-id="${messageId}"] .retry-btn`);
        if (retryBtn) {
            retryBtn.disabled = true;
            retryBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
        }

        this.showTyping();
        this.showToast(`🔄 Reenviando mensagem... (tentativa ${message.retryCount}/${maxRetries})`, 'info');

        try {
            // Always use rotation-enabled API call for better error handling
            const response = await this.callGeminiAPIWithRotation(message.content, message.files || []);

            this.hideTyping();

            // Mark message as sent
            this.updateMessageStatus(messageId, 'sent');
            message.status = 'sent';
            delete message.errorMessage;
            delete message.errorType;

            // Add assistant response
            const assistantMessageId = this.addMessageToHistory('assistant', response);
            this.addMessageToUI('assistant', response, [], assistantMessageId, 'sent');

            await this.autoSaveChat();
            this.showToast('✅ Mensagem enviada com sucesso!', 'success');

        } catch (error) {
            this.hideTyping();
            const errorInfo = this.categorizeError(error);

            // Mark as failed again with enhanced error info
            this.updateMessageStatus(messageId, 'failed', errorInfo.message);
            message.status = 'failed';
            message.errorMessage = errorInfo.message;
            message.errorType = errorInfo.type;

            // Provide helpful retry suggestions
            let retryMessage = `❌ Falha ao reenviar (${message.retryCount}/${maxRetries}): ${errorInfo.userMessage}`;
            if (message.retryCount >= maxRetries) {
                retryMessage += '\n💡 Limite atingido. Tente reformular a mensagem ou alterar o modelo.';
            } else {
                retryMessage += '\n🔄 Clique no botão de retry para tentar novamente.';
            }

            this.showToast(retryMessage, 'error');
            this.savePendingMessages();
        }
    }

    addMessageToUI(sender, content, files = [], messageId = null, status = 'saved') {
        const messageElement = document.createElement('div');
        messageElement.classList.add('mobile-message', `mobile-message-${sender}`);
        messageElement.dataset.messageId = messageId;
        messageElement.dataset.status = status;

        const messageContent = document.createElement('div');
        messageContent.classList.add('mobile-message-content');

        // Adicionar avatar
        const avatar = document.createElement('div');
        avatar.classList.add('mobile-message-avatar');
        avatar.innerHTML = sender === 'user' ? '🏹' : '🐉';
        messageElement.appendChild(avatar);

        // Adicionar conteúdo de texto
        const textElement = document.createElement('div');
        textElement.classList.add('mobile-message-text');
        textElement.innerHTML = this.formatMessage(content);
        messageContent.appendChild(textElement);

        // Adicionar anexos, se houver
        if (files && files.length > 0) {
            const attachmentsContainer = document.createElement('div');
            attachmentsContainer.classList.add('mobile-attachments-preview');
            files.forEach(file => {
                const fileElement = document.createElement('div');
                fileElement.classList.add('mobile-attachment-item');
                fileElement.innerHTML = `<i class="fas fa-paperclip"></i> ${file.name}`;
                attachmentsContainer.appendChild(fileElement);
            });
            messageContent.appendChild(attachmentsContainer);
        }

        // Adicionar botão de deletar
        const deleteBtn = document.createElement('div');
        deleteBtn.classList.add('mobile-message-delete');
        deleteBtn.innerHTML = '<i class="fas fa-trash-alt"></i>';
        deleteBtn.onclick = () => this.deleteMessage(messageId);
        messageElement.appendChild(deleteBtn);

        messageElement.appendChild(messageContent);

        // Adicionar indicador de status
        const statusElement = document.createElement('div');
        statusElement.classList.add('message-status', status);
        statusElement.dataset.messageId = messageId;
        console.log(`[DEBUG] Criando status element para mensagem ${messageId} com status: ${status}`);

        // Add status dot and retry button if failed
        if (status === 'failed') {
            // Find the message to get retry count
            const message = this.messages.find(msg => msg.id === messageId);
            const retryCount = message ? (message.retryCount || 0) : 0;
            const maxRetries = 5;
            const canRetry = retryCount < maxRetries;

            let retryButtonHtml = '';
            if (canRetry) {
                retryButtonHtml = `
                    <button class="retry-btn" onclick="geminiChatMobile.retryMessage('${messageId}')"
                            title="Tentar novamente (${retryCount}/${maxRetries} tentativas)">
                        <i class="fas fa-redo"></i>
                    </button>
                `;
            } else {
                retryButtonHtml = `
                    <span class="retry-limit" title="Limite de tentativas atingido">
                        <i class="fas fa-exclamation-triangle"></i>
                    </span>
                `;
            }

            statusElement.innerHTML = `
                <span class="status-dot"></span>
                ${retryButtonHtml}
            `;
        } else if (status === 'pending') {
            statusElement.innerHTML = `
                <span class="status-dot"></span>
                <span class="pending-indicator">
                    <i class="fas fa-spinner fa-spin"></i>
                </span>
            `;
        } else {
            statusElement.innerHTML = `<span class="status-dot"></span>`;
        }

        console.log(`[DEBUG] Status indicator adicionado para mensagem ${messageId} com status: ${status}`);
        messageContent.appendChild(statusElement);
        console.log(`[DEBUG] Status element anexado ao DOM para mensagem ${messageId}`);

        // Lógica de Long Press para mostrar o botão de deletar
        let pressTimer = null;
        messageElement.addEventListener('touchstart', (e) => {
            pressTimer = window.setTimeout(() => {
                document.querySelectorAll('.mobile-message.delete-visible').forEach(el => {
                    if (el !== messageElement) {
                        el.classList.remove('delete-visible');
                    }
                });
                messageElement.classList.toggle('delete-visible');
                pressTimer = null;
            }, 500);
        }, { passive: true });

        messageElement.addEventListener('touchend', () => {
            if (pressTimer) {
                clearTimeout(pressTimer);
                pressTimer = null;
            }
        });

        messageElement.addEventListener('touchmove', () => {
            if (pressTimer) {
                clearTimeout(pressTimer);
                pressTimer = null;
            }
        });

        const messagesContainer = document.getElementById('mobileMessages');
        messagesContainer.appendChild(messageElement);
        this.scrollToBottom(false);
    }

    // Deletar mensagem
    async deleteMessage(messageId) {
        if (!messageId) {
            console.warn('[DEBUG] deleteMessage called with empty messageId');
            return;
        }

        // Check if message exists locally first
        const messageExists = this.messages.find(msg => msg.id === messageId);
        if (!messageExists) {
            console.warn(`[DEBUG] Message ${messageId} not found in local history`);
            this.showToast('⚠️ Mensagem não encontrada no histórico local', 'warning');
            return;
        }

        // Show confirmation for important messages
        const isUserMessage = messageExists.sender === 'user';
        if (isUserMessage) {
            const confirmed = confirm('Tem certeza que deseja deletar esta mensagem?');
            if (!confirmed) {
                return;
            }
        }

        let messageElement = null;
        try {
            console.log(`[DEBUG] Deletando mensagem: ${messageId}`);

            // Add loading state to prevent multiple deletion attempts
            messageElement = document.querySelector(`.mobile-message[data-message-id="${messageId}"]`);
            if (messageElement) {
                messageElement.style.opacity = '0.5';
                messageElement.style.pointerEvents = 'none';
            }

            // Check server connectivity first
            const healthCheck = await fetch(`${this.serverUrl}/api/health`, {
                method: 'GET',
                timeout: 5000
            }).catch(() => null);

            if (!healthCheck || !healthCheck.ok) {
                console.warn('[DEBUG] Server not reachable, removing message locally only');
                this.removeMessageLocally(messageId);
                this.showToast('⚠️ Servidor indisponível. Mensagem removida localmente.', 'warning');
                return;
            }

            // Use proper DELETE endpoint with enhanced error handling
            const response = await fetch(`${this.serverUrl}/api/messages/${messageId}`, {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json'
                },
                timeout: 10000 // 10 second timeout
            });

            // Handle different HTTP status codes
            if (response.status === 404) {
                console.warn(`[DEBUG] Message ${messageId} not found on server (404)`);
                // Still remove from local storage since it doesn't exist on server
                this.removeMessageLocally(messageId);
                this.showToast('⚠️ Mensagem não encontrada no servidor, removida localmente', 'warning');
                return;
            }

            if (!response.ok) {
                const errorText = await response.text().catch(() => 'Unknown error');
                throw new Error(`HTTP ${response.status}: ${errorText}`);
            }

            const result = await response.json();
            console.log(`[DEBUG] Mensagem deletada no servidor:`, result);

            // Remove from local storage and UI
            this.removeMessageLocally(messageId);
            this.showToast('✅ Mensagem deletada com sucesso!', 'success');

        } catch (error) {
            console.error('[DEBUG] Erro ao deletar mensagem:', error);

            // Restore UI state safely
            try {
                if (messageElement) {
                    messageElement.style.opacity = '1';
                    messageElement.style.pointerEvents = 'auto';
                }
            } catch (uiError) {
                console.warn('[DEBUG] Erro ao restaurar estado da UI:', uiError);
            }

            // Provide specific error messages with fallback handling
            let errorMessage = 'Erro desconhecido';
            try {
                if (error.name === 'TypeError' && error.message.includes('fetch')) {
                    errorMessage = 'Erro de conexão com o servidor';
                } else if (error.message && error.message.includes('timeout')) {
                    errorMessage = 'Timeout - servidor demorou para responder';
                } else if (error.message) {
                    errorMessage = error.message;
                }
            } catch (parseError) {
                console.warn('[DEBUG] Erro ao processar mensagem de erro:', parseError);
                errorMessage = 'Erro interno do sistema';
            }

            // Show error but don't crash the system
            try {
                this.showToast(`❌ Erro ao deletar mensagem: ${errorMessage}`, 'error');
            } catch (toastError) {
                console.error('[DEBUG] Erro ao mostrar toast:', toastError);
            }

            // Ensure system remains operational
            console.warn('[DEBUG] Sistema continua operacional após erro de deleção');
            
            // Try to refresh the message list to maintain consistency
            try {
                this.renderMessages();
            } catch (renderError) {
                console.warn('[DEBUG] Erro ao re-renderizar mensagens após falha:', renderError);
            }
        }
    }

    // Helper method to remove message locally with enhanced error handling
    removeMessageLocally(messageId) {
        try {
            // Remove from UI safely
            const messageElement = document.querySelector(`.mobile-message[data-message-id="${messageId}"]`);
            if (messageElement) {
                messageElement.remove();
                console.log(`[DEBUG] Mensagem removida da UI`);
            } else {
                console.warn(`[DEBUG] Elemento da mensagem ${messageId} não encontrado na UI`);
            }

            // Remove from local history
            const originalLength = this.messages.length;
            this.messages = this.messages.filter(msg => msg.id !== messageId);
            console.log(`[DEBUG] Mensagem removida do histórico local: ${originalLength} -> ${this.messages.length}`);

            // Update chat status to saved
            this.updateAllMessageStatusToSaved();
            
            // Save updated messages to prevent inconsistencies
            this.savePendingMessages();
            
        } catch (error) {
            console.error('[DEBUG] Erro ao remover mensagem localmente:', error);
            // Don't throw - just log and continue
            try {
                this.showToast('⚠️ Erro ao remover mensagem localmente', 'warning');
            } catch (toastError) {
                console.error('[DEBUG] Erro ao mostrar toast de aviso:', toastError);
            }
        }
    }

    // Helper function to update all message statuses to saved
    updateAllMessageStatusToSaved() {
        const statusElements = document.querySelectorAll('.mobile-message .message-status');
        statusElements.forEach(el => {
            el.classList.remove('pending', 'failed');
            el.classList.add('saved');
        });
        console.log(`[DEBUG] Atualizados ${statusElements.length} status de mensagens para 'saved'`);
    }

    // Enhanced message formatting with RPG context-aware styling
    formatMessage(content) {
        // First, preserve any existing RPG formatting classes that the AI model provided
        // This allows the formatting reinforcement system to work properly

        // FORMATAÇÃO MARKDOWN BÁSICA (only if not already formatted with HTML)
        if (!content.includes('<div class="rpg-')) {
            // Converte **texto** em <strong>texto</strong>
            content = content.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
            // Converte *texto* em <em>texto</em>
            content = content.replace(/\*([^*]+)\*/g, '<em>$1</em>');
        }

        // Converte `codigo` em <code>codigo</code>
        content = content.replace(/`([^`]+)`/g, '<code>$1</code>');
        // Converte ```bloco``` em <pre><code>bloco</code></pre>
        content = content.replace(/```([^`]+)```/g, (match, p1) => {
            const code = p1.trim().replace(/</g, "&lt;").replace(/>/g, "&gt;");
            return `<pre><code>${code}</code></pre>`;
        });

        // Auto-detect and format content that doesn't have explicit RPG classes
        if (!content.includes('<div class="rpg-')) {
            content = this.autoDetectRPGFormatting(content);
        }

        // Converte quebras de linha em <br> (but preserve existing HTML structure)
        content = content.replace(/\n(?![^<]*>)/g, '<br>');

        return content;
    }

    // Auto-detect RPG content types and apply appropriate formatting
    autoDetectRPGFormatting(content) {
        // Split content into paragraphs for individual processing
        const paragraphs = content.split(/\n\s*\n/);

        return paragraphs.map(paragraph => {
            const trimmed = paragraph.trim();
            if (!trimmed) return '';

            // Detect dice rolls (contains dice notation like d20, 1d6, etc.)
            if (/\b\d*d\d+\b|\b(roll|rolled|dice|resultado)\b/i.test(trimmed)) {
                return `<div class="rpg-dice-roll">${trimmed}</div>`;
            }

            // Detect character dialogue (contains quotes or character names followed by colon)
            if (/^[A-Z][a-zA-Z\s]+:\s*["']|["'].*["']/.test(trimmed)) {
                // Extract character name if present
                const nameMatch = trimmed.match(/^([A-Z][a-zA-Z\s]+):\s*(.*)/);
                if (nameMatch) {
                    return `<div class="rpg-dialogue"><span class="rpg-character-name">${nameMatch[1]}:</span> "${nameMatch[2]}"</div>`;
                } else {
                    return `<div class="rpg-dialogue">${trimmed}</div>`;
                }
            }

            // Detect environmental descriptions (contains location/setting keywords)
            if (/\b(sala|quarto|floresta|montanha|cidade|castelo|masmorra|ambiente|local|lugar|cenário)\b/i.test(trimmed)) {
                return `<div class="rpg-environment">${trimmed}</div>`;
            }

            // Detect system messages (contains system keywords)
            if (/\b(sistema|regra|mecânica|teste|verificação)\b/i.test(trimmed)) {
                return `<div class="rpg-system">${trimmed}</div>`;
            }

            // Default to narration for descriptive content
            if (trimmed.length > 50) {
                return `<div class="rpg-narration">${trimmed}</div>`;
            }

            // Short content remains unformatted
            return trimmed;
        }).join('\n\n');
    }

    // Mostrar indicador de digitação
    showTyping() {
        this.isTyping = true;
        const typingElement = document.getElementById('mobileTyping');
        if (typingElement) {
            typingElement.style.display = 'flex';
        }
        this.toggleSendButton();
    }

    // Esconder indicador de digitação
    hideTyping() {
        this.isTyping = false;
        const typingElement = document.getElementById('mobileTyping');
        if (typingElement) {
            typingElement.style.display = 'none';
        }
        this.toggleSendButton();
    }

    // Rolar para o final da conversa
    scrollToBottom(fullScroll = false) {
        const messagesContainer = document.getElementById('mobileMessages');
        if (messagesContainer) {
            if (fullScroll) {
                // Rola completamente para o final
                messagesContainer.scrollTop = messagesContainer.scrollHeight;
            } else {
                // Rola apenas um pouco para indicar nova mensagem
                const targetScroll = messagesContainer.scrollTop + 200;
                messagesContainer.scrollTo({
                    top: targetScroll,
                    behavior: 'smooth'
                });
            }
        }
    }

    // Mostrar toast
    showToast(message, type = 'info') {
        const toast = document.getElementById('mobileToast');
        const statusElement = document.querySelector('.message-status');
        statusElement.textContent = 'salvo';
        statusElement.className = 'message-status saved';
        // Forçar reflow para garantir a atualização da UI
        void statusElement.offsetWidth;
        toast.textContent = message;
        toast.className = 'mobile-toast show';
        toast.classList.add(type); // Adiciona a classe de tipo (info, error, success)

        setTimeout(() => {
            toast.className = 'mobile-toast';
        }, 3000);
    }

    // --- Funções de anexo ---
    handleFileSelection(event) {
        const files = event.target.files;
        if (files.length > 0) {
            for (const file of files) {
                this.attachedFiles.push({ 
                    name: file.name, 
                    size: file.size, 
                    type: file.type, 
                    file: file // Armazena o objeto File
                });
            }
            this.updateFilePreview();
        }
    }

    updateFilePreview() {
        const container = document.getElementById('mobileFilePreview');
        const clearBtn = document.getElementById('clearMobileFiles');
        
        if (!container || !clearBtn) {
            console.warn('File preview elements not found');
            return;
        }
        
        if (this.attachedFiles.length > 0) {
            const fileNames = this.attachedFiles.map(f => f.name).join(', ');
            const spanElement = container.querySelector('span');
            if (spanElement) {
                spanElement.textContent = fileNames;
            }
            container.style.display = 'flex';
            clearBtn.style.display = 'block';
        } else {
            container.style.display = 'none';
            clearBtn.style.display = 'none';
        }
        this.toggleSendButton();
    }

    clearAttachedFiles() {
        this.attachedFiles = [];
        document.getElementById('mobileFileInput').value = ''; // Limpa o input
        this.updateFilePreview();
    }

    async fileToBase64(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = () => resolve(reader.result);
            reader.onerror = error => reject(error);
        });
    }

    // --- Funções de gerenciamento de chats ---
    async showChatsModal() {
        if (!this.serverUrl) {
            this.showToast('Configure o endereço do servidor primeiro.');
            return;
        }
        
        await this.loadChatsFromServer();
        const modal = document.getElementById('mobileChatsModal');
        modal.style.display = 'flex';
    }

    hideChatsModal() {
        const modal = document.getElementById('mobileChatsModal');
        modal.style.display = 'none';
    }

    async loadChatsFromServer() {
        try {
            const response = await fetch(`${this.serverUrl}/api/chats`);
            if (!response.ok) {
                throw new Error('Falha ao carregar conversas.');
            }
            this.chats = await response.json();
            this.renderChatsList(this.chats);
        } catch (error) {
            console.error('Erro ao carregar conversas:', error);
            this.showToast(error.message, 'error');
        }
    }

    renderChatsList(chats) {
        const chatsList = document.getElementById('mobileChatsList');
        if (!chatsList) return;

        if (!chats || chats.length === 0) {
            chatsList.innerHTML = '<div style="text-align: center; color: #d4af37; padding: 20px;">Nenhuma conversa salva</div>';
            return;
        }

        chatsList.innerHTML = chats.map(chat => `
            <div class="mobile-chat-item" data-chat-id="${chat.id}">
                <div class="mobile-chat-content" onclick="geminiChat.loadChat('${chat.id}')">
                    <div class="mobile-chat-item-title">${chat.title || 'Conversa sem título'}</div>
                    <div class="mobile-chat-item-preview">
                        <span class="mobile-chat-item-count">${chat.message_count || 0} msgs</span>
                        <span class="mobile-chat-item-date">${this.formatDate(chat.updated_at)}</span>
                    </div>
                </div>
                <div class="mobile-chat-item-actions">
                    <button class="mobile-chat-item-rename-btn" data-id="${chat.id}">✏️</button>
                    <button class="mobile-chat-item-delete-btn" data-id="${chat.id}">❌</button>
                </div>
            </div>
        `).join('');

        // Adicionar eventos após a renderização
        document.querySelectorAll('.mobile-chat-item-delete-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const chatId = e.target.closest('.mobile-chat-item').dataset.chatId;
                this.confirmDeleteChat(chatId);
            });
        });

        document.querySelectorAll('.mobile-chat-item-rename-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const chatId = e.target.closest('.mobile-chat-item').dataset.chatId;
                this.renameChat(chatId);
            });
        });

        document.querySelectorAll('.mobile-chat-content').forEach(item => {
            item.addEventListener('click', (e) => {
                const chatId = e.target.closest('.mobile-chat-item').dataset.chatId;
                this.loadChat(chatId);
                this.hideChatsModal();
            });
        });
    }

    async loadChat(chatId) {
        try {
            const response = await fetch(`${this.serverUrl}/api/chats/${chatId}`);
            if (!response.ok) {
                throw new Error('Falha ao carregar a conversa.');
            }
            const chat = await response.json();

            this.currentChatId = chat.id;
            this.messages = chat.messages || [];
            this.currentChatTitle = chat.title || 'Mestre';

            console.log('[DEBUG] Loading chat context from server...');
            console.log('[DEBUG] Server context object:', chat.context ? 'present' : 'missing');
            console.log('[DEBUG] Server aventura field (direct):', chat.aventura?.length || 0, 'characters');
            console.log('[DEBUG] Server aventura field (nested):', chat.context?.aventura?.length || 0, 'characters');
            console.log('[DEBUG] Server aventura preview (nested):', chat.context?.aventura?.substring(0, 100) || '(empty)');

            // FIXED: Extract context from nested context object, with fallback to direct fields for backward compatibility
            const contextData = chat.context || {};
            this.currentChatContext = {
                master_rules: contextData.master_rules || chat.master_rules || '',
                character_sheet: contextData.character_sheet || chat.character_sheet || '',
                local_history: contextData.local_history || chat.local_history || '',
                current_plot: contextData.current_plot || chat.current_plot || '',
                relations: contextData.relations || chat.relations || '',
                aventura: contextData.aventura || chat.aventura || '',
                lastCompressionTime: contextData.lastCompressionTime || chat.lastCompressionTime || null
            };

            console.log('[DEBUG] Loaded context aventura length:', this.currentChatContext.aventura.length);
            console.log('[DEBUG] Context extraction summary:');
            console.log('[DEBUG] - master_rules:', this.currentChatContext.master_rules.length, 'chars');
            console.log('[DEBUG] - character_sheet:', this.currentChatContext.character_sheet.length, 'chars');
            console.log('[DEBUG] - local_history:', this.currentChatContext.local_history.length, 'chars');
            console.log('[DEBUG] - current_plot:', this.currentChatContext.current_plot.length, 'chars');
            console.log('[DEBUG] - relations:', this.currentChatContext.relations.length, 'chars');
            console.log('[DEBUG] - aventura:', this.currentChatContext.aventura.length, 'chars');

            // Merge with pending messages from localStorage
            const pendingMessages = this.loadPendingMessages();
            pendingMessages.forEach(pendingMsg => {
                const existingIndex = this.messages.findIndex(msg => msg.id === pendingMsg.id);
                if (existingIndex === -1) {
                    this.messages.push(pendingMsg);
                }
            });

            this.clearMessages();
            this.updateChatTitle(this.currentChatTitle);

            this.messages.forEach(msg => {
                const status = msg.status || 'saved';
                this.addMessageToUI(msg.sender, msg.content, msg.files, msg.id, status);
            });
            this.scrollToBottom(true); // Força a rolagem completa ao carregar
            
        } catch (error) {
            console.error('Erro ao carregar conversa:', error);
            this.showToast(error.message, 'error');
        }
    }

    async loadLastChat() {
        try {
            const response = await fetch(`${this.serverUrl}/api/chats/last`);
            if (response.ok) {
                const lastChat = await response.json();
                if (lastChat && lastChat.id) {
                    await this.loadChat(lastChat.id);
                }
            } else {
                // Se não houver última conversa, mostrar tela de boas-vindas
                this.showWelcome();
            }
        } catch (error) {
            console.error('Nenhum servidor encontrado para carregar última conversa:', error);
            this.showWelcome();
        }
    }

    async renameChat(chatId) {
        const chatToRename = this.chats.find(chat => chat.id === chatId);
        if (!chatToRename) {
            this.showToast('Erro: Conversa não encontrada.', 'error');
            return;
        }

        const newTitle = prompt('Digite o novo título para a conversa:', chatToRename.title);

        if (newTitle && newTitle.trim() !== '' && newTitle.trim() !== chatToRename.title) {
            const trimmedTitle = newTitle.trim();
            try {
                const response = await fetch(`${this.serverUrl}/api/chats/${chatId}/rename`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ title: trimmedTitle })
                });

                if (!response.ok) {
                    throw new Error('Falha ao renomear no servidor.');
                }

                // Atualiza na UI e no objeto local
                const chat = this.chats.find(c => c.id === chatId);
                if (chat) {
                    chat.title = trimmedTitle;
                }
                if (this.currentChatId === chatId) {
                    this.currentChatTitle = trimmedTitle;
                    this.updateChatTitle(this.currentChatTitle);
                }
                this.showChatsModal(); // Atualiza a lista
                this.showToast('✅ Conversa renomeada!');

            } catch (error) {
                console.error('Erro ao renomear conversa:', error);
                this.showToast(error.message, 'error');
            }
        }
    }

    async confirmDeleteChat(chatId) {
        const chatToDelete = this.chats.find(chat => chat.id === chatId);
        if (!chatToDelete) {
            this.showToast('Erro: Conversa não encontrada.', 'error');
            return;
        }

        const chatTitle = chatToDelete.title || 'Conversa sem título';
        const confirmation = prompt(`Para confirmar a exclusão, digite o título da conversa abaixo:\n\n"${chatTitle}"`);

        if (confirmation === chatTitle) {
            await this.deleteChatFromServer(chatId);
        } else if (confirmation !== null) { // Evita a mensagem de erro se o usuário cancelar o prompt
            this.showToast('A exclusão foi cancelada. O título não corresponde.', 'error');
        }
    }

    async deleteChatFromServer(chatId) {
        try {
            const response = await fetch(`${this.serverUrl}/api/chats/${chatId}`, {
                method: 'DELETE'
            });

            if (!response.ok) {
                throw new Error('Falha ao deletar a conversa.');
            }

            this.showToast('Conversa deletada com sucesso!');
            
            // Se a conversa deletada era a atual, iniciar uma nova
            if (this.currentChatId === chatId) {
                this.newChat();
            }
            
            this.loadChatsFromServer(); // Recarregar a lista

        } catch (error) {
            console.error('Erro ao deletar conversa:', error);
            this.showToast(error.message, 'error');
        }
    }

    // Renderizar mensagens
    renderMessages() {
        try {
            this.clearMessages();
            this.messages.forEach(msg => {
                const status = msg.status || 'saved';
                this.addMessageToUI(msg.sender, msg.content, msg.files || [], msg.id, status);
            });
            console.log(`[DEBUG] renderMessages: Successfully rendered ${this.messages.length} messages`);
        } catch (error) {
            console.error('[DEBUG] Error in renderMessages:', error);
            this.showToast('❌ Erro ao renderizar mensagens', 'error');
            // Don't crash the system - continue operation
        }
    }

    // Mostrar toast
    showToast(message, type = 'info', duration = 3000) {
        // Criar elemento toast
        const toast = document.createElement('div');

        // Define colors based on type
        let backgroundColor, borderColor;
        switch (type) {
            case 'error':
                backgroundColor = 'linear-gradient(145deg, #dc3545, #c82333)';
                borderColor = '#721c24';
                break;
            case 'success':
                backgroundColor = 'linear-gradient(145deg, #28a745, #218838)';
                borderColor = '#155724';
                break;
            case 'warning':
                backgroundColor = 'linear-gradient(145deg, #ffc107, #e0a800)';
                borderColor = '#856404';
                break;
            default: // info
                backgroundColor = 'linear-gradient(145deg, #d4af37, #b8860b)';
                borderColor = '#654321';
        }

        toast.style.cssText = `
            position: fixed;
            top: 100px;
            left: 50%;
            transform: translateX(-50%);
            background: ${backgroundColor};
            color: #f5f5dc;
            padding: 12px 24px;
            border-radius: 8px;
            border: 2px solid ${borderColor};
            font-family: 'Medieval Sharp', cursive;
            font-weight: 700;
            z-index: 10000;
            box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);
            animation: slideInUp 0.3s ease-out;
            max-width: 90%;
            text-align: center;
        `;
        toast.textContent = message;

        document.body.appendChild(toast);

        // Remover após duração especificada
        setTimeout(() => {
            toast.style.animation = 'fadeOut 0.3s ease-out';
            setTimeout(() => {
                if (document.body.contains(toast)) {
                    document.body.removeChild(toast);
                }
            }, 300);
        }, duration);
    }

    // Utilitários
    truncateText(text, maxLength) {
        return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
    }

    formatDate(dateString) {
        const date = new Date(dateString);
        return date.toLocaleDateString('pt-BR') + ' ' + date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    }
    
    // Converter arquivo para base64
    fileToBase64(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => {
                // Remover o prefixo data:mime/type;base64,
                const base64 = reader.result.split(',')[1];
                resolve(base64);
            };
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    }
    




    // Gerar título de conversa
    generateChatTitle() {
        const firstUserMessage = this.messages.find(m => m.sender === 'user');
        return this.truncateText(firstUserMessage.content, 30) || 'Nova Conversa';
    }
    
    // Gerar ID único para mensagem
    generateMessageId() {
        return 'msg_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    // Obter nome de exibição do modelo
    getModelDisplayName(model) {
        const modelNames = {
            'gemini-2.5-pro': 'Gemini 2.5 Pro',
            'gemini-2.5-flash': 'Gemini 2.5 Flash',
            // Backward compatibility for older models
            'gemini-1.5-pro-latest': 'Gemini 1.5 Pro',
            'gemini-1.5-flash-latest': 'Gemini 1.5 Flash',
            'gemini-pro': 'Gemini Pro',
            'gemini-flash': 'Gemini Flash'
        };
        return modelNames[model] || model;
    }

    // === MÉTODOS PARA MÚLTIPLAS API KEYS E ESTATÍSTICAS ===
    
    // Carregar estatísticas do localStorage
    loadStatistics() {
        const today = new Date().toISOString().split('T')[0];
        const savedStats = localStorage.getItem('gemini_statistics');

        if (savedStats) {
            const stats = JSON.parse(savedStats);
            // Se é um novo dia, resetar estatísticas
            if (stats.date !== today) {
                return this.createEmptyStatistics(today);
            }

            // Migrate old statistics format to include new fields
            ['key1', 'key2', 'key3', 'key4'].forEach(key => {
                if (stats[key] && typeof stats[key].lastTokenCount === 'undefined') {
                    stats[key].lastTokenCount = 0;
                    stats[key].lastModel = '';
                }
            });

            return stats;
        }

        return this.createEmptyStatistics(today);
    }
    
    // Criar estrutura vazia de estatísticas
    createEmptyStatistics(date) {
        return {
            date: date,
            key1: { pro: 0, flash: 0, tokens: 0, lastTokenCount: 0, lastModel: '' },
            key2: { pro: 0, flash: 0, tokens: 0, lastTokenCount: 0, lastModel: '' },
            key3: { pro: 0, flash: 0, tokens: 0, lastTokenCount: 0, lastModel: '' },
            key4: { pro: 0, flash: 0, tokens: 0, lastTokenCount: 0, lastModel: '' }
        };
    }
    
    // Salvar estatísticas no localStorage
    saveStatistics() {
        localStorage.setItem('gemini_statistics', JSON.stringify(this.statistics));
    }
    
    // Incrementar estatísticas
    incrementStatistics(model, tokens) {
        const today = new Date().toISOString().split('T')[0];

        // Se mudou o dia, resetar estatísticas
        if (this.statistics.date !== today) {
            this.statistics = this.createEmptyStatistics(today);
        }

        const modelType = model.includes('pro') ? 'pro' : 'flash';
        this.statistics[this.activeApiKey][modelType]++;
        this.statistics[this.activeApiKey].tokens += tokens;
        this.statistics[this.activeApiKey].lastTokenCount = tokens;
        this.statistics[this.activeApiKey].lastModel = model;

        console.log(`[STATS] Updated statistics for ${this.activeApiKey}: ${modelType} calls, ${tokens} tokens this request, ${this.statistics[this.activeApiKey].tokens} total tokens`);

        this.saveStatistics();
        this.updateStatisticsDisplay();
    }
    
    // Estimar tokens (aproximação simples)
    estimateTokens(text) {
        // Aproximação: 1 token ≈ 4 caracteres em português
        return Math.ceil(text.length / 4);
    }

    // Atualizar input da API key baseado na seleção
    updateApiKeyInput() {
        const apiKeyInput = document.getElementById('mobileApiKeyInput');
        const keyLabel = document.getElementById('currentKeyLabel');

        apiKeyInput.value = this.apiKeys[this.activeApiKey] || '';
        apiKeyInput.placeholder = `Insira sua API Key (${this.activeApiKey})...`;

        // Update label to show which key is being configured
        const keyNumber = this.activeApiKey.replace('key', '');
        if (keyLabel) {
            keyLabel.textContent = `Chave da API ${keyNumber}:`;
        }

        console.log(`[API Key] Campo de input atualizado para: ${this.activeApiKey}`);
    }

    // Atualizar display de estatísticas
    updateStatisticsDisplay() {
        const stats = this.statistics[this.activeApiKey];
        document.getElementById('statPro').textContent = stats.pro || 0;
        document.getElementById('statFlash').textContent = stats.flash || 0;
        document.getElementById('statTokens').textContent = (stats.tokens || 0).toLocaleString();

        // Update last token count display
        const lastTokenElement = document.getElementById('statLastTokens');
        if (lastTokenElement) {
            const lastTokenCount = stats.lastTokenCount || 0;
            lastTokenElement.textContent = lastTokenCount.toLocaleString();

            // Add tooltip with model info if available
            if (stats.lastModel) {
                const modelName = stats.lastModel.includes('pro') ? 'Pro' : 'Flash';
                lastTokenElement.title = `Última requisição: ${lastTokenCount} tokens (${modelName})`;
            }
        }
    }
}

// Inicializar aplicação
let geminiChat;
let geminiChatMobile; // Add global reference for onclick handlers
document.addEventListener('DOMContentLoaded', () => {
    geminiChat = new GeminiChatMobile();
    geminiChatMobile = geminiChat; // Make it available globally for onclick handlers
});

// Adicionar CSS para animações do toast
const style = document.createElement('style');
style.textContent = `
    @keyframes fadeOut {
        from { opacity: 1; }
        to { opacity: 0; }
    }
`;
document.head.appendChild(style);
