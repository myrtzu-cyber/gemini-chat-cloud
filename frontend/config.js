/**
 * Frontend Configuration for Cloud Deployment
 * This file handles environment-specific settings
 */

class AppConfig {
    constructor() {
        this.init();
    }

    init() {
        // Detect environment
        this.isProduction = window.location.hostname !== 'localhost' && 
                           window.location.hostname !== '127.0.0.1' &&
                           !window.location.hostname.includes('192.168.');

        // Set API base URL based on environment
        this.apiBaseUrl = this.getApiBaseUrl();
        
        console.log(`🌍 Environment: ${this.isProduction ? 'Production' : 'Development'}`);
        console.log(`🔗 API Base URL: ${this.apiBaseUrl}`);
    }

    getApiBaseUrl() {
        // Production: Use same domain as frontend
        if (this.isProduction) {
            return window.location.origin;
        }

        // Development: Check for local servers
        const savedServerUrl = localStorage.getItem('server_url');
        if (savedServerUrl) {
            return savedServerUrl;
        }

        // Default local development URLs
        const possibleUrls = [
            'http://localhost:3000',
            'http://localhost:8080',
            'https://localhost:8080'
        ];

        return possibleUrls[0]; // Default to Node.js server
    }

    // Update API base URL (useful for development)
    setApiBaseUrl(url) {
        this.apiBaseUrl = url;
        if (!this.isProduction) {
            localStorage.setItem('server_url', url);
        }
        console.log(`🔗 API Base URL updated: ${this.apiBaseUrl}`);
    }

    // Get full API endpoint URL
    getApiUrl(endpoint) {
        return `${this.apiBaseUrl}${endpoint}`;
    }

    // Test connection to API
    async testConnection() {
        try {
            const response = await fetch(this.getApiUrl('/api/health'), {
                method: 'GET',
                headers: {
                    'Accept': 'application/json'
                }
            });

            if (response.ok) {
                const data = await response.json();
                console.log('✅ API Connection successful:', data);
                return { success: true, data };
            } else {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
        } catch (error) {
            console.error('❌ API Connection failed:', error.message);
            return { success: false, error: error.message };
        }
    }

    // Auto-detect and test multiple server URLs (for development)
    async autoDetectServer() {
        if (this.isProduction) {
            return this.testConnection();
        }

        const testUrls = [
            'http://localhost:3000',  // Node.js server
            'http://localhost:8080',  // Python server
            'https://localhost:8080'  // Python server with SSL
        ];

        for (const url of testUrls) {
            console.log(`🔍 Testing server: ${url}`);
            this.setApiBaseUrl(url);
            
            const result = await this.testConnection();
            if (result.success) {
                console.log(`✅ Server found: ${url}`);
                return result;
            }
        }

        console.warn('⚠️  No local server found. Using default URL.');
        this.setApiBaseUrl(testUrls[0]);
        return { success: false, error: 'No server detected' };
    }

    // Get CORS-safe headers for requests
    getRequestHeaders(additionalHeaders = {}) {
        return {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            ...additionalHeaders
        };
    }

    // Make API request with proper error handling
    async apiRequest(endpoint, options = {}) {
        const url = this.getApiUrl(endpoint);
        const defaultOptions = {
            headers: this.getRequestHeaders(options.headers),
            credentials: this.isProduction ? 'same-origin' : 'omit'
        };

        const requestOptions = { ...defaultOptions, ...options };

        try {
            const response = await fetch(url, requestOptions);
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const contentType = response.headers.get('content-type');
            if (contentType && contentType.includes('application/json')) {
                return await response.json();
            } else {
                return await response.text();
            }
        } catch (error) {
            console.error(`❌ API Request failed [${options.method || 'GET'} ${endpoint}]:`, error.message);
            throw error;
        }
    }

    // Deployment-specific configurations
    getDeploymentConfig() {
        return {
            isProduction: this.isProduction,
            apiBaseUrl: this.apiBaseUrl,
            enableServiceWorker: this.isProduction && 'serviceWorker' in navigator,
            enablePWA: this.isProduction,
            enableAnalytics: this.isProduction,
            logLevel: this.isProduction ? 'error' : 'debug'
        };
    }
}

// Create global config instance
window.appConfig = new AppConfig();

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AppConfig;
}
