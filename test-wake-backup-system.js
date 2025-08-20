#!/usr/bin/env node
/**
 * Test Script for Wake-up and Backup Systems
 * Tests both local and production deployments
 */

const https = require('https');
const http = require('http');

// Configuration
const RENDER_URL = process.env.RENDER_URL || 'https://gemini-chat-cloud.onrender.com';
const LOCAL_URL = 'http://localhost:3000';

async function makeRequest(url, options = {}) {
    return new Promise((resolve, reject) => {
        const urlObj = new URL(url);
        const client = urlObj.protocol === 'https:' ? https : http;
        
        const req = client.request(url, {
            method: options.method || 'GET',
            headers: {
                'User-Agent': 'Gemini-Chat-Test/1.0',
                'Content-Type': 'application/json',
                ...options.headers
            },
            timeout: 30000
        }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const jsonData = JSON.parse(data);
                    resolve({
                        success: true,
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

        req.on('timeout', () => {
            req.destroy();
            resolve({
                success: false,
                error: 'Request timeout',
                status: 0
            });
        });

        if (options.body) {
            req.write(JSON.stringify(options.body));
        }

        req.end();
    });
}

async function testEndpoint(url, name, expectedStatus = 200) {
    console.log(`🔍 Testing ${name}...`);
    const result = await makeRequest(url);
    
    if (result.success && result.status === expectedStatus) {
        console.log(`✅ ${name}: OK (${result.status})`);
        return { success: true, data: result.data };
    } else {
        console.log(`❌ ${name}: Failed (${result.status}) - ${result.error || 'Unknown error'}`);
        return { success: false, error: result.error };
    }
}

async function testWakeUpSystem(baseUrl) {
    console.log('\n🏥 Testing Wake-up System');
    console.log('='.repeat(40));
    
    // Test health endpoint
    const health = await testEndpoint(`${baseUrl}/api/health`, 'Health Check');
    
    if (health.success && health.data) {
        console.log(`   Status: ${health.data.status}`);
        console.log(`   Uptime: ${health.data.uptime_human || 'Unknown'}`);
        console.log(`   Memory: ${health.data.memory_usage?.rss_mb || 'Unknown'}MB`);
        console.log(`   Database: ${health.data.database_configured ? 'Connected' : 'Not configured'}`);
        console.log(`   Last ping: ${health.data.last_ping}`);
    }
    
    // Test stats endpoint
    await testEndpoint(`${baseUrl}/api/stats`, 'Stats Endpoint');
    
    return health.success;
}

async function testBackupSystem(baseUrl) {
    console.log('\n🗄️ Testing Backup System');
    console.log('='.repeat(40));
    
    // Test backup status
    const status = await testEndpoint(`${baseUrl}/api/backup/status`, 'Backup Status');
    
    if (status.success && status.data) {
        console.log(`   Configured: ${status.data.configured ? 'Yes' : 'No'}`);
        console.log(`   Last backup: ${status.data.lastBackupTime ? new Date(status.data.lastBackupTime).toLocaleString() : 'Never'}`);
        console.log(`   In progress: ${status.data.isBackupInProgress ? 'Yes' : 'No'}`);
        
        if (status.data.statistics) {
            console.log(`   Total backups: ${status.data.statistics.totalBackups}`);
            console.log(`   Success rate: ${status.data.statistics.successfulBackups}/${status.data.statistics.totalBackups}`);
        }
        
        if (status.data.driveInfo) {
            console.log(`   Drive folder: ${status.data.driveInfo.folderName}`);
            console.log(`   Files in Drive: ${status.data.driveInfo.totalFiles}`);
        }
    }
    
    // Test backup trigger
    const trigger = await testEndpoint(`${baseUrl}/api/backup/trigger`, 'Backup Trigger');
    
    if (trigger.success && trigger.data) {
        console.log(`   Trigger result: ${trigger.data.status}`);
        if (trigger.data.result) {
            console.log(`   Backup status: ${trigger.data.result.status}`);
        }
    }
    
    return status.success;
}

async function testManualBackup(baseUrl) {
    console.log('\n🔧 Testing Manual Backup');
    console.log('='.repeat(40));
    
    const result = await makeRequest(`${baseUrl}/api/backup/manual`, { method: 'POST' });
    
    if (result.success && result.data) {
        console.log(`✅ Manual backup: ${result.data.status}`);
        if (result.data.result) {
            const backup = result.data.result;
            console.log(`   File: ${backup.fileName}`);
            console.log(`   Size: ${Math.round(backup.size / 1024)}KB`);
            console.log(`   Chats: ${backup.chatsCount}, Messages: ${backup.messagesCount}`);
        }
        return true;
    } else {
        console.log(`❌ Manual backup failed: ${result.error || 'Unknown error'}`);
        return false;
    }
}

async function testLocalServer() {
    console.log('🏠 Testing Local Server');
    console.log('='.repeat(50));
    
    const wakeUpOk = await testWakeUpSystem(LOCAL_URL);
    const backupOk = await testBackupSystem(LOCAL_URL);
    
    return { wakeUpOk, backupOk };
}

async function testProductionServer() {
    console.log('\n🌐 Testing Production Server (Render)');
    console.log('='.repeat(50));
    
    const wakeUpOk = await testWakeUpSystem(RENDER_URL);
    const backupOk = await testBackupSystem(RENDER_URL);
    
    return { wakeUpOk, backupOk };
}

async function runFullTest() {
    console.log('🧪 Full System Test');
    console.log('='.repeat(60));
    console.log(`Local URL: ${LOCAL_URL}`);
    console.log(`Production URL: ${RENDER_URL}`);
    console.log('');
    
    // Test local server first
    const localResults = await testLocalServer();
    
    // Test production server
    const prodResults = await testProductionServer();
    
    // Summary
    console.log('\n📊 Test Summary');
    console.log('='.repeat(50));
    console.log(`🏠 Local Server:`);
    console.log(`   Wake-up System: ${localResults.wakeUpOk ? '✅ OK' : '❌ Failed'}`);
    console.log(`   Backup System: ${localResults.backupOk ? '✅ OK' : '❌ Failed'}`);
    
    console.log(`🌐 Production Server:`);
    console.log(`   Wake-up System: ${prodResults.wakeUpOk ? '✅ OK' : '❌ Failed'}`);
    console.log(`   Backup System: ${prodResults.backupOk ? '✅ OK' : '❌ Failed'}`);
    
    const allOk = localResults.wakeUpOk && localResults.backupOk && 
                  prodResults.wakeUpOk && prodResults.backupOk;
    
    console.log(`\n🎯 Overall Status: ${allOk ? '✅ All systems operational' : '⚠️ Some issues detected'}`);
    
    return allOk;
}

async function main() {
    const command = process.argv[2];
    
    switch (command) {
        case 'local':
            await testLocalServer();
            break;
        case 'prod':
        case 'production':
            await testProductionServer();
            break;
        case 'backup':
            console.log('🔧 Testing Manual Backup on Production');
            await testManualBackup(RENDER_URL);
            break;
        case 'full':
        default:
            await runFullTest();
            break;
    }
}

if (require.main === module) {
    main().catch(console.error);
}

module.exports = { testWakeUpSystem, testBackupSystem, testManualBackup };
