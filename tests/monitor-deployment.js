#!/usr/bin/env node
/**
 * Monitor Deployment Progress
 * Checks deployment status and waits for PostgreSQL to be active
 */

const https = require('https');

const SERVER_URL = 'https://gemini-chat-cloud.onrender.com';
const CHECK_INTERVAL = 30000; // 30 seconds
const MAX_CHECKS = 20; // 10 minutes total

function makeRequest(url) {
    return new Promise((resolve, reject) => {
        const req = https.request(url, { 
            rejectUnauthorized: false,
            timeout: 10000 
        }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const jsonData = JSON.parse(data);
                    resolve({ status: res.statusCode, data: jsonData });
                } catch (error) {
                    resolve({ status: res.statusCode, data: data });
                }
            });
        });

        req.on('error', (error) => {
            resolve({ status: 0, error: error.message });
        });
        
        req.on('timeout', () => {
            req.destroy();
            resolve({ status: 0, error: 'Request timeout' });
        });
        
        req.end();
    });
}

async function checkDeploymentStatus() {
    try {
        const statsResponse = await makeRequest(`${SERVER_URL}/api/stats`);
        
        if (statsResponse.status === 200 && statsResponse.data) {
            return {
                success: true,
                serverType: statsResponse.data.server_type,
                totalChats: statsResponse.data.total_chats,
                totalMessages: statsResponse.data.total_messages,
                databaseConfigured: statsResponse.data.database_url_configured
            };
        } else {
            return {
                success: false,
                error: `HTTP ${statsResponse.status}: ${statsResponse.error || 'Unknown error'}`
            };
        }
    } catch (error) {
        return {
            success: false,
            error: error.message
        };
    }
}

async function monitorDeployment() {
    console.log('🚀 Monitoring Deployment Progress');
    console.log(`📍 Server: ${SERVER_URL}`);
    console.log(`⏱️ Check interval: ${CHECK_INTERVAL / 1000} seconds`);
    console.log(`⏰ Max duration: ${(MAX_CHECKS * CHECK_INTERVAL) / 60000} minutes`);
    console.log('');

    let checkCount = 0;
    let lastServerType = null;
    let deploymentDetected = false;

    while (checkCount < MAX_CHECKS) {
        checkCount++;
        const timestamp = new Date().toLocaleTimeString();
        
        console.log(`🔍 Check ${checkCount}/${MAX_CHECKS} at ${timestamp}`);
        
        const status = await checkDeploymentStatus();
        
        if (status.success) {
            console.log(`   ✅ Server responding`);
            console.log(`   📊 Server type: ${status.serverType}`);
            console.log(`   💬 Chats: ${status.totalChats}, Messages: ${status.totalMessages}`);
            
            // Check if deployment happened (server type changed)
            if (lastServerType && lastServerType !== status.serverType) {
                deploymentDetected = true;
                console.log(`   🔄 DEPLOYMENT DETECTED: ${lastServerType} → ${status.serverType}`);
            }
            
            lastServerType = status.serverType;
            
            // Check if we're now using PostgreSQL
            if (status.serverType === 'postgresql-database') {
                console.log('');
                console.log('🎉 SUCCESS: PostgreSQL database is now active!');
                console.log('✅ Data persistence issue should be resolved');
                console.log('');
                console.log('🧪 Next steps:');
                console.log('1. Run persistence test: .\\portable\\node\\node.exe test-database-persistence.js');
                console.log('2. Create a test chat and verify it persists');
                console.log('3. Wait for or trigger a redeploy to test persistence');
                return true;
            } else if (status.serverType === 'cloud-database') {
                console.log('   ⚠️ Still showing "cloud-database" - may need more time');
            } else {
                console.log('   ❌ Still using fallback database');
            }
        } else {
            console.log(`   ❌ Server not responding: ${status.error}`);
            if (status.error.includes('timeout') || status.error.includes('ECONNREFUSED')) {
                console.log('   🔄 Server might be redeploying...');
                deploymentDetected = true;
            }
        }
        
        if (checkCount < MAX_CHECKS) {
            console.log(`   ⏳ Waiting ${CHECK_INTERVAL / 1000} seconds for next check...`);
            console.log('');
            await new Promise(resolve => setTimeout(resolve, CHECK_INTERVAL));
        }
    }
    
    console.log('');
    console.log('⏰ Monitoring timeout reached');
    
    if (deploymentDetected) {
        console.log('🔄 Deployment was detected, but PostgreSQL may still be initializing');
        console.log('💡 Try running the check again in a few minutes');
    } else {
        console.log('❌ No deployment detected - changes may not have triggered a redeploy');
        console.log('💡 Check Render dashboard for deployment status');
    }
    
    return false;
}

if (require.main === module) {
    monitorDeployment().then(success => {
        process.exit(success ? 0 : 1);
    });
}

module.exports = { monitorDeployment };
