#!/usr/bin/env node
/**
 * Sleep/Wake Cycle Testing Script
 * Tests database persistence through Render app sleep/wake cycles
 */

const https = require('https');
const http = require('http');

class SleepWakeTester {
    constructor() {
        this.baseUrl = process.env.RENDER_URL || 'https://gemini-chat-cloud.onrender.com';
        this.testData = {
            chatId: `test-chat-${Date.now()}`,
            messages: []
        };
    }

    async makeRequest(url, options = {}) {
        return new Promise((resolve) => {
            const urlObj = new URL(url);
            const client = urlObj.protocol === 'https:' ? https : http;
            
            const req = client.request(url, {
                method: options.method || 'GET',
                timeout: options.timeout || 30000,
                headers: {
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
                            success: res.statusCode >= 200 && res.statusCode < 300,
                            status: res.statusCode,
                            data: jsonData
                        });
                    } catch (error) {
                        resolve({
                            success: res.statusCode >= 200 && res.statusCode < 300,
                            status: res.statusCode,
                            data: data
                        });
                    }
                });
            });

            req.on('error', (error) => {
                resolve({
                    success: false,
                    error: error.message,
                    status: 0
                });
            });

            if (options.body) {
                req.write(JSON.stringify(options.body));
            }

            req.end();
        });
    }

    async createTestData() {
        console.log('\n📝 Creating Test Data Before Sleep');
        console.log('='.repeat(50));

        // Create test chat
        const chatData = {
            id: this.testData.chatId,
            title: `Sleep Test Chat - ${new Date().toLocaleString()}`,
            model: 'gemini-2.5-flash',
            messages: [
                {
                    role: 'user',
                    content: 'This is a test message before sleep cycle',
                    timestamp: Date.now()
                },
                {
                    role: 'assistant', 
                    content: 'This is a test response that should persist through sleep',
                    timestamp: Date.now() + 1000
                }
            ],
            context: JSON.stringify({
                test_context: 'This context should survive sleep/wake cycle',
                created_at: new Date().toISOString(),
                test_id: this.testData.chatId
            })
        };

        const result = await this.makeRequest(`${this.baseUrl}/api/chats`, {
            method: 'POST',
            body: chatData
        });

        if (result.success) {
            console.log('✅ Test chat created successfully');
            console.log(`   Chat ID: ${this.testData.chatId}`);
            console.log(`   Messages: ${chatData.messages.length}`);
            this.testData.messages = chatData.messages;
            return true;
        } else {
            console.log('❌ Failed to create test chat');
            console.log(`   Error: ${result.error || result.status}`);
            return false;
        }
    }

    async checkAppStatus() {
        console.log('\n🔍 Checking App Status');
        console.log('='.repeat(30));

        // Health check
        const health = await this.makeRequest(`${this.baseUrl}/api/health`);
        if (health.success) {
            console.log('✅ App is awake and responding');
            console.log(`   Uptime: ${health.data.uptime_human || 'N/A'}`);
            console.log(`   Database: ${health.data.database_configured ? 'Connected' : 'Not configured'}`);
        } else {
            console.log('❌ App appears to be sleeping or unreachable');
            return false;
        }

        // Activity status
        const activity = await this.makeRequest(`${this.baseUrl}/api/activity/status`);
        if (activity.success) {
            console.log('📊 Activity Status:');
            console.log(`   Active: ${activity.data.isActive}`);
            console.log(`   Request count: ${activity.data.requestCount}`);
            console.log(`   Last activity: ${activity.data.lastActivityTime ? new Date(activity.data.lastActivityTime).toLocaleString() : 'Never'}`);
        }

        return true;
    }

    async verifyDataPersistence() {
        console.log('\n🔍 Verifying Data Persistence');
        console.log('='.repeat(40));

        // Check if test chat still exists
        const chat = await this.makeRequest(`${this.baseUrl}/api/chats/${this.testData.chatId}`);
        
        if (chat.success && chat.data) {
            console.log('✅ Test chat found after wake-up');
            console.log(`   Title: ${chat.data.title}`);
            console.log(`   Messages: ${chat.data.messages ? chat.data.messages.length : 0}`);
            
            if (chat.data.context) {
                try {
                    const context = JSON.parse(chat.data.context);
                    console.log(`   Context preserved: ${context.test_context ? 'Yes' : 'No'}`);
                } catch (e) {
                    console.log('   Context: Parse error');
                }
            }

            return true;
        } else {
            console.log('❌ Test chat NOT found after wake-up');
            console.log('   This indicates data loss during sleep cycle');
            return false;
        }
    }

    async checkDatabaseRecovery() {
        console.log('\n🗄️ Checking Database Recovery System');
        console.log('='.repeat(45));

        const recovery = await this.makeRequest(`${this.baseUrl}/api/database/recovery`);
        
        if (recovery.success) {
            console.log('✅ Database recovery system accessible');
            console.log(`   Database type: ${recovery.data.databaseType}`);
            console.log(`   Current chats: ${recovery.data.currentData.chats}`);
            console.log(`   Current messages: ${recovery.data.currentData.messages}`);
            console.log(`   Main file exists: ${recovery.data.files.mainFile.exists}`);
            console.log(`   Backup file exists: ${recovery.data.files.backupFile.exists}`);
            
            if (recovery.data.backupData) {
                console.log(`   Backup chats: ${recovery.data.backupData.chats}`);
                console.log(`   Backup messages: ${recovery.data.backupData.messages}`);
                console.log(`   Last saved: ${recovery.data.backupData.lastSaved}`);
            }

            return recovery.data;
        } else {
            console.log('❌ Database recovery system not accessible');
            return null;
        }
    }

    async forceDatabaseReload() {
        console.log('\n🔄 Testing Database Reload');
        console.log('='.repeat(35));

        const reload = await this.makeRequest(`${this.baseUrl}/api/database/reload`, {
            method: 'POST'
        });

        if (reload.success) {
            console.log('✅ Database reload successful');
            console.log(`   Before: ${reload.data.before.chats} chats, ${reload.data.before.messages} messages`);
            console.log(`   After: ${reload.data.after.chats} chats, ${reload.data.after.messages} messages`);
            return true;
        } else {
            console.log('❌ Database reload failed');
            return false;
        }
    }

    async runPreSleepTest() {
        console.log('🧪 PRE-SLEEP TEST PHASE');
        console.log('='.repeat(60));
        
        const statusOk = await this.checkAppStatus();
        if (!statusOk) return false;

        const dataCreated = await this.createTestData();
        if (!dataCreated) return false;

        const recoveryData = await this.checkDatabaseRecovery();
        
        console.log('\n📋 Pre-Sleep Summary:');
        console.log(`   App Status: ✅ Awake and responding`);
        console.log(`   Test Data: ✅ Created successfully`);
        console.log(`   Recovery System: ${recoveryData ? '✅ Accessible' : '❌ Not accessible'}`);
        
        console.log('\n⏰ NEXT STEPS:');
        console.log('1. Wait 15+ minutes without making any requests');
        console.log('2. App should automatically go to sleep');
        console.log('3. Run post-sleep test to verify data persistence');
        console.log(`4. Test chat ID: ${this.testData.chatId}`);
        
        return true;
    }

    async runPostSleepTest() {
        console.log('🧪 POST-SLEEP TEST PHASE');
        console.log('='.repeat(60));
        
        console.log('🌅 Attempting to wake up app...');
        const statusOk = await this.checkAppStatus();
        
        if (!statusOk) {
            console.log('❌ App failed to wake up or is still sleeping');
            return false;
        }

        console.log('✅ App successfully woke up');
        
        const dataIntact = await this.verifyDataPersistence();
        const recoveryData = await this.checkDatabaseRecovery();
        
        console.log('\n📋 Post-Sleep Summary:');
        console.log(`   App Wake-up: ✅ Successful`);
        console.log(`   Data Persistence: ${dataIntact ? '✅ Data intact' : '❌ Data lost'}`);
        console.log(`   Recovery System: ${recoveryData ? '✅ Accessible' : '❌ Not accessible'}`);
        
        if (!dataIntact && recoveryData) {
            console.log('\n🔄 Attempting database recovery...');
            const reloadSuccess = await this.forceDatabaseReload();
            
            if (reloadSuccess) {
                console.log('✅ Database reload completed, re-checking data...');
                const dataAfterReload = await this.verifyDataPersistence();
                console.log(`   Data after reload: ${dataAfterReload ? '✅ Recovered' : '❌ Still missing'}`);
            }
        }
        
        return dataIntact;
    }

    async runSleepMonitoring() {
        console.log('🧪 SLEEP MONITORING MODE');
        console.log('='.repeat(60));
        console.log('Monitoring app status every 2 minutes...');
        console.log('Press Ctrl+C to stop monitoring\n');

        let sleepDetected = false;
        let consecutiveFailures = 0;

        const monitor = setInterval(async () => {
            const timestamp = new Date().toLocaleString();
            const health = await this.makeRequest(`${this.baseUrl}/api/health`);
            
            if (health.success) {
                consecutiveFailures = 0;
                if (sleepDetected) {
                    console.log(`${timestamp} - 🌅 APP WOKE UP! Running post-sleep verification...`);
                    clearInterval(monitor);
                    await this.runPostSleepTest();
                } else {
                    console.log(`${timestamp} - ✅ App awake (uptime: ${health.data.uptime_human || 'N/A'})`);
                }
            } else {
                consecutiveFailures++;
                if (!sleepDetected && consecutiveFailures >= 2) {
                    sleepDetected = true;
                    console.log(`${timestamp} - 😴 APP WENT TO SLEEP (${consecutiveFailures} consecutive failures)`);
                } else if (sleepDetected) {
                    console.log(`${timestamp} - 😴 Still sleeping...`);
                } else {
                    console.log(`${timestamp} - ⚠️ Connection issue (${consecutiveFailures}/2)`);
                }
            }
        }, 2 * 60 * 1000); // Check every 2 minutes
    }
}

// CLI Interface
if (require.main === module) {
    const tester = new SleepWakeTester();
    const command = process.argv[2];

    switch (command) {
        case 'pre-sleep':
            tester.runPreSleepTest().catch(console.error);
            break;
        case 'post-sleep':
            tester.runPostSleepTest().catch(console.error);
            break;
        case 'monitor':
            tester.runSleepMonitoring().catch(console.error);
            break;
        case 'status':
            tester.checkAppStatus().catch(console.error);
            break;
        case 'recovery':
            tester.checkDatabaseRecovery().catch(console.error);
            break;
        default:
            console.log('Sleep/Wake Cycle Tester');
            console.log('Usage: node test-sleep-wake-cycle.js <command>');
            console.log('');
            console.log('Commands:');
            console.log('  pre-sleep  - Create test data and prepare for sleep');
            console.log('  post-sleep - Verify data after wake-up');
            console.log('  monitor    - Monitor sleep/wake cycle in real-time');
            console.log('  status     - Check current app status');
            console.log('  recovery   - Check database recovery system');
    }
}

module.exports = SleepWakeTester;
