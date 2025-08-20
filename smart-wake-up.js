/**
 * Smart Wake-up Detection Script
 * Automatically detects if the Render app is sleeping and handles wake-up process
 * Can be embedded in any page to provide seamless wake-up experience
 */

class SmartWakeUp {
    constructor(options = {}) {
        this.options = {
            baseUrl: options.baseUrl || window.location.origin,
            healthEndpoint: options.healthEndpoint || '/api/health',
            wakeUpPage: options.wakeUpPage || '/wake-up.html',
            timeout: options.timeout || 10000,
            retryAttempts: options.retryAttempts || 3,
            retryDelay: options.retryDelay || 2000,
            autoRedirect: options.autoRedirect !== false,
            showLoadingOverlay: options.showLoadingOverlay !== false,
            ...options
        };

        this.isWakingUp = false;
        this.loadingOverlay = null;
        
        this.init();
    }

    init() {
        console.log('🌅 Smart Wake-up initialized');
        
        // Check server status on page load
        this.checkServerStatus();
        
        // Monitor fetch requests to detect server issues
        this.interceptFetchRequests();
        
        // Handle page visibility changes
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden && !this.isWakingUp) {
                this.checkServerStatus();
            }
        });
    }

    async checkServerStatus() {
        try {
            console.log('🔍 Checking server status...');
            
            const response = await this.makeRequest(this.options.healthEndpoint, {
                timeout: this.options.timeout
            });

            if (response.ok) {
                const data = await response.json();
                console.log('✅ Server is awake:', data);
                this.hideLoadingOverlay();
                return true;
            } else {
                console.log('⚠️ Server responded with error:', response.status);
                await this.handleSleepingServer();
                return false;
            }
        } catch (error) {
            console.log('⏰ Server appears to be sleeping:', error.message);
            await this.handleSleepingServer();
            return false;
        }
    }

    async handleSleepingServer() {
        if (this.isWakingUp) {
            console.log('⏳ Wake-up already in progress');
            return;
        }

        this.isWakingUp = true;
        console.log('🌅 Starting wake-up process...');

        if (this.options.showLoadingOverlay) {
            this.showLoadingOverlay();
        }

        try {
            // Try to wake up the server
            const success = await this.wakeUpServer();
            
            if (success) {
                console.log('✅ Server wake-up successful');
                this.hideLoadingOverlay();
                
                // Trigger a backup check since the app is now active
                this.triggerBackupCheck();
            } else {
                console.log('❌ Server wake-up failed');
                
                if (this.options.autoRedirect) {
                    console.log('🔄 Redirecting to wake-up page...');
                    window.location.href = this.options.wakeUpPage;
                } else {
                    this.showWakeUpError();
                }
            }
        } catch (error) {
            console.error('❌ Wake-up process error:', error);
            
            if (this.options.autoRedirect) {
                window.location.href = this.options.wakeUpPage;
            } else {
                this.showWakeUpError(error.message);
            }
        } finally {
            this.isWakingUp = false;
        }
    }

    async wakeUpServer() {
        console.log('🔄 Attempting to wake up server...');
        
        const wakeUpEndpoints = [
            this.options.healthEndpoint,
            '/',
            '/api/stats'
        ];

        // Try multiple endpoints simultaneously
        const wakeUpPromises = wakeUpEndpoints.map(endpoint => 
            this.attemptWakeUp(endpoint)
        );

        try {
            // Wait for at least one successful wake-up
            await Promise.race(wakeUpPromises);
            
            // Wait a bit for the server to fully start
            await this.sleep(3000);
            
            // Verify server is actually ready
            return await this.verifyServerReady();
        } catch (error) {
            console.error('❌ All wake-up attempts failed:', error);
            return false;
        }
    }

    async attemptWakeUp(endpoint) {
        for (let attempt = 1; attempt <= this.options.retryAttempts; attempt++) {
            try {
                console.log(`🔄 Wake-up attempt ${attempt}/${this.options.retryAttempts} for ${endpoint}`);
                
                const response = await this.makeRequest(endpoint, {
                    timeout: 30000 // Longer timeout for wake-up
                });

                if (response.ok) {
                    console.log(`✅ Wake-up successful for ${endpoint}`);
                    return response;
                }
            } catch (error) {
                console.log(`⚠️ Wake-up attempt ${attempt} failed for ${endpoint}:`, error.message);
                
                if (attempt < this.options.retryAttempts) {
                    await this.sleep(this.options.retryDelay);
                }
            }
        }
        
        throw new Error(`Failed to wake up ${endpoint} after ${this.options.retryAttempts} attempts`);
    }

    async verifyServerReady() {
        const maxVerifyAttempts = 10;
        const verifyDelay = 2000;

        for (let attempt = 1; attempt <= maxVerifyAttempts; attempt++) {
            try {
                console.log(`🔍 Verifying server ready (${attempt}/${maxVerifyAttempts})...`);
                
                const response = await this.makeRequest(this.options.healthEndpoint, {
                    timeout: 10000
                });

                if (response.ok) {
                    const data = await response.json();
                    console.log('✅ Server verification successful:', data);
                    return true;
                }
            } catch (error) {
                console.log(`⏳ Server not ready yet (attempt ${attempt}):`, error.message);
            }

            if (attempt < maxVerifyAttempts) {
                await this.sleep(verifyDelay);
            }
        }

        console.log('⚠️ Server verification timeout');
        return false;
    }

    async triggerBackupCheck() {
        try {
            console.log('🗄️ Triggering backup check after wake-up...');
            
            const response = await this.makeRequest('/api/backup/trigger', {
                timeout: 5000
            });

            if (response.ok) {
                const data = await response.json();
                console.log('✅ Backup check triggered:', data);
            } else {
                console.log('ℹ️ Backup check not available or failed');
            }
        } catch (error) {
            console.log('ℹ️ Could not trigger backup check:', error.message);
        }
    }

    interceptFetchRequests() {
        const originalFetch = window.fetch;
        const self = this;

        window.fetch = async function(...args) {
            try {
                const response = await originalFetch.apply(this, args);
                
                // Check if this is an API request that failed
                if (!response.ok && args[0] && args[0].includes('/api/')) {
                    console.log('🔍 API request failed, checking server status...');
                    setTimeout(() => self.checkServerStatus(), 1000);
                }
                
                return response;
            } catch (error) {
                // Network error - server might be sleeping
                if (args[0] && args[0].includes('/api/')) {
                    console.log('🔍 Network error on API request, checking server status...');
                    setTimeout(() => self.checkServerStatus(), 1000);
                }
                
                throw error;
            }
        };
    }

    showLoadingOverlay() {
        if (this.loadingOverlay) return;

        this.loadingOverlay = document.createElement('div');
        this.loadingOverlay.innerHTML = `
            <div style="
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.8);
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 10000;
                color: white;
                font-family: Arial, sans-serif;
            ">
                <div style="text-align: center;">
                    <div style="
                        width: 50px;
                        height: 50px;
                        border: 4px solid rgba(255, 255, 255, 0.3);
                        border-top: 4px solid white;
                        border-radius: 50%;
                        animation: spin 1s linear infinite;
                        margin: 0 auto 20px;
                    "></div>
                    <h3>Iniciando aplicação...</h3>
                    <p>O servidor estava em modo de economia. Aguarde alguns segundos.</p>
                </div>
            </div>
            <style>
                @keyframes spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }
            </style>
        `;

        document.body.appendChild(this.loadingOverlay);
    }

    hideLoadingOverlay() {
        if (this.loadingOverlay) {
            document.body.removeChild(this.loadingOverlay);
            this.loadingOverlay = null;
        }
    }

    showWakeUpError(message = 'Não foi possível conectar ao servidor') {
        this.hideLoadingOverlay();
        
        const errorDiv = document.createElement('div');
        errorDiv.innerHTML = `
            <div style="
                position: fixed;
                top: 20px;
                right: 20px;
                background: #ef4444;
                color: white;
                padding: 15px;
                border-radius: 8px;
                z-index: 10001;
                max-width: 300px;
                font-family: Arial, sans-serif;
            ">
                <h4>⚠️ Erro de Conexão</h4>
                <p>${message}</p>
                <button onclick="location.reload()" style="
                    background: white;
                    color: #ef4444;
                    border: none;
                    padding: 8px 16px;
                    border-radius: 4px;
                    margin-top: 10px;
                    cursor: pointer;
                ">Tentar Novamente</button>
            </div>
        `;

        document.body.appendChild(errorDiv);

        // Auto-remove after 10 seconds
        setTimeout(() => {
            if (errorDiv.parentNode) {
                document.body.removeChild(errorDiv);
            }
        }, 10000);
    }

    async makeRequest(url, options = {}) {
        const controller = new AbortController();
        const timeout = options.timeout || this.options.timeout;

        const timeoutId = setTimeout(() => controller.abort(), timeout);

        try {
            const response = await fetch(this.options.baseUrl + url, {
                signal: controller.signal,
                ...options
            });

            clearTimeout(timeoutId);
            return response;
        } catch (error) {
            clearTimeout(timeoutId);
            throw error;
        }
    }

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // Public method to manually trigger wake-up check
    async manualWakeUpCheck() {
        console.log('🔧 Manual wake-up check triggered');
        return await this.checkServerStatus();
    }

    // Public method to get current status
    getStatus() {
        return {
            isWakingUp: this.isWakingUp,
            hasLoadingOverlay: !!this.loadingOverlay,
            options: this.options
        };
    }
}

// Auto-initialize if not in a module environment
if (typeof module === 'undefined') {
    // Wait for DOM to be ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            window.smartWakeUp = new SmartWakeUp();
        });
    } else {
        window.smartWakeUp = new SmartWakeUp();
    }
}

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SmartWakeUp;
}
