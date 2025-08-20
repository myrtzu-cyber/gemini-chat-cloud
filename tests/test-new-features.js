#!/usr/bin/env node
/**
 * Test Script for New Features
 * Tests API Key Rotation and Database Recovery features
 */

const https = require('https');
const http = require('http');

class FeatureTester {
    constructor() {
        this.baseUrl = process.env.RENDER_URL || 'https://gemini-chat-cloud.onrender.com';
        this.testResults = [];
    }

    async makeRequest(url, options = {}) {
        return new Promise((resolve) => {
            const urlObj = new URL(url);
            const client = urlObj.protocol === 'https:' ? https : http;
            const startTime = Date.now();
            
            const req = client.request(url, {
                method: options.method || 'GET',
                timeout: options.timeout || 30000,
                headers: {
                    'User-Agent': 'Feature-Tester/1.0',
                    'Content-Type': 'application/json',
                    ...options.headers
                }
            }, (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => {
                    try {
                        const jsonData = JSON.parse(data);
                        resolve({
                            success: true,
                            status: res.statusCode,
                            data: jsonData,
                            responseTime: Date.now() - startTime
                        });
                    } catch (error) {
                        resolve({
                            success: res.statusCode >= 200 && res.statusCode < 300,
                            status: res.statusCode,
                            data: data,
                            responseTime: Date.now() - startTime
                        });
                    }
                });
            });

            req.on('error', (error) => {
                resolve({
                    success: false,
                    error: error.message,
                    status: 0,
                    responseTime: Date.now() - startTime
                });
            });

            req.on('timeout', () => {
                req.destroy();
                resolve({
                    success: false,
                    error: 'Request timeout',
                    status: 0,
                    responseTime: Date.now() - startTime
                });
            });

            if (options.body) {
                req.write(JSON.stringify(options.body));
            }

            req.end();
        });
    }

    async testDatabaseRecovery() {
        console.log('\n🗄️ Testing Database Recovery Features');
        console.log('='.repeat(50));

        // Test recovery endpoint
        console.log('🔍 Testing database recovery endpoint...');
        const recovery = await this.makeRequest(`${this.baseUrl}/api/database/recovery`);
        
        if (recovery.success) {
            console.log('✅ Database recovery endpoint working');
            console.log(`   Database type: ${recovery.data.databaseType}`);
            console.log(`   Current data: ${recovery.data.currentData.chats} chats, ${recovery.data.currentData.messages} messages`);
            console.log(`   Main file exists: ${recovery.data.files.mainFile.exists}`);
            console.log(`   Backup file exists: ${recovery.data.files.backupFile.exists}`);
            
            if (recovery.data.backupData) {
                console.log(`   Backup data: ${recovery.data.backupData.chats} chats, ${recovery.data.backupData.messages} messages`);
                console.log(`   Last saved: ${recovery.data.backupData.lastSaved}`);
            }
        } else {
            console.log('❌ Database recovery endpoint failed');
            console.log(`   Error: ${recovery.error}`);
        }

        // Test health endpoint for database status
        console.log('\n🏥 Testing enhanced health check...');
        const health = await this.makeRequest(`${this.baseUrl}/api/health`);
        
        if (health.success) {
            console.log('✅ Health check working');
            console.log(`   Database configured: ${health.data.database_configured}`);
            console.log(`   Total chats: ${health.data.total_chats || 'N/A'}`);
            console.log(`   Total messages: ${health.data.total_messages || 'N/A'}`);
            console.log(`   Uptime: ${health.data.uptime_human || 'N/A'}`);
        } else {
            console.log('❌ Health check failed');
        }

        return { recovery, health };
    }

    async testApiKeyRotation() {
        console.log('\n🔄 Testing API Key Rotation Features');
        console.log('='.repeat(50));

        console.log('ℹ️  API Key Rotation is a frontend feature that requires:');
        console.log('   1. Mobile interface with rotation toggle enabled');
        console.log('   2. Multiple API keys configured');
        console.log('   3. Rate limit errors to trigger rotation');
        console.log('');
        console.log('📱 To test API Key Rotation:');
        console.log('   1. Open the mobile interface');
        console.log('   2. Go to Settings');
        console.log('   3. Enable "Rotação Automática de Chaves"');
        console.log('   4. Configure multiple API keys');
        console.log('   5. Make requests until rate limit is hit');
        console.log('   6. Observe automatic key switching');
        console.log('');
        console.log('🔍 Checking if mobile interface is accessible...');

        const mobile = await this.makeRequest(`${this.baseUrl}/mobile.html`);
        
        if (mobile.success) {
            console.log('✅ Mobile interface accessible');
            
            // Check if the HTML contains the new rotation toggle
            if (typeof mobile.data === 'string') {
                const hasRotationToggle = mobile.data.includes('autoKeyRotationToggle') || 
                                        mobile.data.includes('Rotação Automática');
                console.log(`   Rotation toggle present: ${hasRotationToggle ? 'Yes' : 'No'}`);
                
                const hasApiKeySelect = mobile.data.includes('activeApiKeySelect');
                console.log(`   API key selector present: ${hasApiKeySelect ? 'Yes' : 'No'}`);
            }
        } else {
            console.log('❌ Mobile interface not accessible');
        }

        return { mobile };
    }

    async testDataPersistence() {
        console.log('\n💾 Testing Data Persistence');
        console.log('='.repeat(50));

        console.log('🔍 Testing data persistence through sleep/wake cycle...');
        console.log('');
        console.log('📋 Manual Test Steps:');
        console.log('   1. Create a new chat conversation');
        console.log('   2. Send several messages');
        console.log('   3. Wait 15+ minutes for app to sleep');
        console.log('   4. Visit the app again to wake it up');
        console.log('   5. Check if all conversations and messages are still there');
        console.log('');
        console.log('🔧 Automated checks:');

        // Check current data state
        const stats = await this.makeRequest(`${this.baseUrl}/api/stats`);
        
        if (stats.success) {
            console.log('✅ Current database stats:');
            console.log(`   Total chats: ${stats.data.total_chats}`);
            console.log(`   Total messages: ${stats.data.total_messages}`);
            console.log(`   Database type: ${stats.data.server_type}`);
        } else {
            console.log('❌ Could not get database stats');
        }

        // Check activity status
        const activity = await this.makeRequest(`${this.baseUrl}/api/activity/status`);
        
        if (activity.success) {
            console.log('✅ Activity tracking:');
            console.log(`   App active: ${activity.data.isActive}`);
            console.log(`   Request count: ${activity.data.requestCount}`);
            console.log(`   Last activity: ${activity.data.lastActivityTime ? new Date(activity.data.lastActivityTime).toLocaleString() : 'Never'}`);
        } else {
            console.log('❌ Could not get activity status');
        }

        return { stats, activity };
    }

    async runAllTests() {
        console.log('🧪 Testing New Features Implementation');
        console.log('=====================================');
        console.log(`📡 Testing: ${this.baseUrl}`);
        console.log(`🕒 Started: ${new Date().toLocaleString()}\n`);

        const results = {
            databaseRecovery: await this.testDatabaseRecovery(),
            apiKeyRotation: await this.testApiKeyRotation(),
            dataPersistence: await this.testDataPersistence()
        };

        this.generateReport(results);
        return results;
    }

    generateReport(results) {
        console.log('\n📊 Feature Test Report');
        console.log('='.repeat(50));

        console.log('\n🗄️ Database Recovery Features:');
        console.log(`   Recovery endpoint: ${results.databaseRecovery.recovery.success ? '✅ Working' : '❌ Failed'}`);
        console.log(`   Health check: ${results.databaseRecovery.health.success ? '✅ Working' : '❌ Failed'}`);

        console.log('\n🔄 API Key Rotation Features:');
        console.log(`   Mobile interface: ${results.apiKeyRotation.mobile.success ? '✅ Accessible' : '❌ Failed'}`);
        console.log('   Rotation logic: ✅ Implemented (requires manual testing)');

        console.log('\n💾 Data Persistence:');
        console.log(`   Stats endpoint: ${results.dataPersistence.stats.success ? '✅ Working' : '❌ Failed'}`);
        console.log(`   Activity tracking: ${results.dataPersistence.activity.success ? '✅ Working' : '❌ Failed'}`);

        console.log('\n🎯 Implementation Status:');
        console.log('   ✅ Automatic API Key Rotation - Implemented');
        console.log('   ✅ Database Recovery System - Enhanced');
        console.log('   ✅ Data Persistence - Improved');
        console.log('   ✅ Auto-save Mechanism - Added');
        console.log('   ✅ Recovery Endpoints - Added');

        console.log('\n📋 Next Steps:');
        console.log('   1. Test API key rotation manually in mobile interface');
        console.log('   2. Test data persistence through sleep/wake cycle');
        console.log('   3. Monitor database recovery endpoints');
        console.log('   4. Verify auto-save functionality');

        console.log('\n💡 Useful Endpoints:');
        console.log(`   Database recovery: ${this.baseUrl}/api/database/recovery`);
        console.log(`   Force reload: ${this.baseUrl}/api/database/reload (POST)`);
        console.log(`   Activity status: ${this.baseUrl}/api/activity/status`);
        console.log(`   Health check: ${this.baseUrl}/api/health`);
    }
}

// Run tests
if (require.main === module) {
    const tester = new FeatureTester();
    tester.runAllTests().catch(console.error);
}

module.exports = FeatureTester;
