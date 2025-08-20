/**
 * Self-Ping System para Render.com
 * Sistema interno de keep-alive (backup para serviços externos)
 */

const https = require('https');

class SelfPing {
    constructor(url, interval = 14 * 60 * 1000) { // 14 minutos
        this.url = url;
        this.interval = interval;
        this.timer = null;
        this.enabled = process.env.NODE_ENV === 'production';
        this.lastPing = null;
        this.consecutiveErrors = 0;
        this.maxErrors = 3;
    }

    start() {
        if (!this.enabled) {
            console.log('⏸️  Self-ping desabilitado (desenvolvimento)');
            return;
        }

        if (!this.url) {
            console.log('⚠️  URL não configurada para self-ping');
            return;
        }

        console.log(`🔄 Self-ping iniciado: ${this.url}`);
        console.log(`⏱️  Intervalo: ${this.interval / 1000 / 60} minutos`);

        // Primeira execução após 5 minutos
        setTimeout(() => {
            this.ping();
            // Depois executa no intervalo regular
            this.timer = setInterval(() => this.ping(), this.interval);
        }, 5 * 60 * 1000);
    }

    stop() {
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
            console.log('🛑 Self-ping parado');
        }
    }

    ping() {
        const startTime = Date.now();
        const endpoint = this.url + '/keep-alive';

        https.get(endpoint, (res) => {
            const duration = Date.now() - startTime;
            this.lastPing = new Date();
            this.consecutiveErrors = 0;

            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                try {
                    const response = JSON.parse(data);
                    console.log(`🏓 Self-ping OK (${duration}ms):`, response.timestamp);
                } catch (e) {
                    console.log(`🏓 Self-ping OK (${duration}ms): Status ${res.statusCode}`);
                }
            });

        }).on('error', (error) => {
            this.consecutiveErrors++;
            console.error(`❌ Self-ping erro (${this.consecutiveErrors}/${this.maxErrors}):`, error.message);

            // Se muitos erros consecutivos, para o self-ping
            if (this.consecutiveErrors >= this.maxErrors) {
                console.log('🛑 Muitos erros consecutivos, parando self-ping');
                this.stop();
            }
        });
    }

    getStatus() {
        return {
            enabled: this.enabled,
            url: this.url,
            interval: this.interval,
            lastPing: this.lastPing,
            consecutiveErrors: this.consecutiveErrors,
            isRunning: this.timer !== null
        };
    }
}

// Função para inicializar
function initSelfPing() {
    // Detectar URL do Render automaticamente
    const renderUrl = process.env.RENDER_EXTERNAL_URL || 
                     process.env.APP_URL || 
                     'https://gemini-chat-cloud.onrender.com'; // URL específica do seu app

    console.log(`🔗 Self-ping URL detectada: ${renderUrl}`);

    if (renderUrl && (renderUrl.includes('onrender.com') || renderUrl.includes('localhost'))) {
        const selfPing = new SelfPing(renderUrl);
        selfPing.start();

        // Graceful shutdown
        process.on('SIGTERM', () => selfPing.stop());
        process.on('SIGINT', () => selfPing.stop());

        return selfPing;
    } else {
        console.log('⏸️  Self-ping: URL não configurada para keep-alive');
        return null;
    }
}

module.exports = { SelfPing, initSelfPing };
