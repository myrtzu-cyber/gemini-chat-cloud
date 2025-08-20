#!/usr/bin/env node
/**
 * Quick Deployment Status Check
 * Verifies which database implementation is currently running
 */

const https = require('https');

const SERVER_URL = 'https://gemini-chat-cloud.onrender.com';

function makeRequest(url) {
    return new Promise((resolve, reject) => {
        const req = https.request(url, { rejectUnauthorized: false }, (res) => {
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

        req.on('error', reject);
        req.end();
    });
}

async function checkDeploymentStatus() {
    console.log('🔍 Checking Current Deployment Status');
    console.log(`📍 Server: ${SERVER_URL}`);
    console.log('');

    try {
        // Check health endpoint
        console.log('1️⃣ Checking health endpoint...');
        const healthResponse = await makeRequest(`${SERVER_URL}/api/health`);
        
        if (healthResponse.status === 200) {
            console.log('✅ Server is healthy');
            console.log(`   Database type: ${healthResponse.data.database_type || 'unknown'}`);
            console.log(`   Status: ${healthResponse.data.status}`);
        } else {
            console.log(`❌ Health check failed: ${healthResponse.status}`);
        }
        console.log('');

        // Check stats endpoint
        console.log('2️⃣ Checking database stats...');
        const statsResponse = await makeRequest(`${SERVER_URL}/api/stats`);
        
        if (statsResponse.status === 200) {
            console.log('✅ Stats retrieved');
            console.log(`   Server type: ${statsResponse.data.server_type}`);
            console.log(`   Total chats: ${statsResponse.data.total_chats}`);
            console.log(`   Total messages: ${statsResponse.data.total_messages}`);
            console.log(`   Database URL configured: ${statsResponse.data.database_url_configured}`);
        } else {
            console.log(`❌ Stats check failed: ${statsResponse.status}`);
        }
        console.log('');

        // Analysis
        console.log('📊 ANALYSIS:');
        
        if (statsResponse.data && statsResponse.data.server_type) {
            const serverType = statsResponse.data.server_type;
            
            if (serverType === 'postgresql-database') {
                console.log('✅ GOOD: Using PostgreSQL database');
                console.log('✅ Data should persist across redeployments');
            } else if (serverType === 'cloud-database') {
                console.log('⚠️ UNCLEAR: Server type shows "cloud-database"');
                console.log('   This might be PostgreSQL or SimpleDatabase');
                console.log('   Check server logs for more details');
            } else if (serverType.includes('memory') || serverType.includes('simple')) {
                console.log('❌ PROBLEM: Using SimpleDatabase (file-based storage)');
                console.log('❌ Data WILL BE LOST on redeployments');
                console.log('🔧 SOLUTION: Deploy the PostgreSQL implementation');
            } else {
                console.log(`❓ UNKNOWN: Server type "${serverType}" not recognized`);
            }
        }
        
        console.log('');
        console.log('🚀 NEXT STEPS:');
        
        if (statsResponse.data && statsResponse.data.server_type !== 'postgresql-database') {
            console.log('1. Commit and push the PostgreSQL implementation');
            console.log('2. Wait for Render to redeploy');
            console.log('3. Run this check again to verify PostgreSQL is active');
            console.log('4. Test data persistence across a redeploy');
        } else {
            console.log('1. Test data persistence by creating a chat');
            console.log('2. Trigger a redeploy or wait for sleep cycle');
            console.log('3. Verify the chat still exists after restart');
        }

    } catch (error) {
        console.error('❌ Error checking deployment status:', error.message);
        console.error('');
        console.error('🔍 Possible issues:');
        console.error('   - Server is not responding');
        console.error('   - Network connectivity issues');
        console.error('   - Server is starting up');
    }
}

if (require.main === module) {
    checkDeploymentStatus();
}

module.exports = { checkDeploymentStatus };
