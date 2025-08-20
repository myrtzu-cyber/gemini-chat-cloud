#!/usr/bin/env node
/**
 * Debug Database Connection
 * Tests what's happening with the database connection
 */

const https = require('https');

const SERVER_URL = 'https://gemini-chat-cloud.onrender.com';

function makeRequest(url, options = {}) {
    return new Promise((resolve, reject) => {
        const requestOptions = {
            ...options,
            headers: {
                'Content-Type': 'application/json',
                ...options.headers
            },
            rejectUnauthorized: false
        };

        const req = https.request(url, requestOptions, (res) => {
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
        
        if (options.body) {
            req.write(JSON.stringify(options.body));
        }
        
        req.end();
    });
}

async function debugDatabaseConnection() {
    console.log('🔍 Debugging Database Connection');
    console.log(`📍 Server: ${SERVER_URL}`);
    console.log('');

    try {
        // Test 1: Create a new chat to see what database is actually being used
        console.log('1️⃣ Creating test chat to debug database...');
        const testChatId = `debug_${Date.now()}`;
        
        const createResponse = await makeRequest(`${SERVER_URL}/api/chats`, {
            method: 'POST',
            body: {
                id: testChatId,
                title: 'Database Debug Test',
                model: 'gemini-pro',
                messages: [
                    {
                        id: `msg_${Date.now()}_debug`,
                        sender: 'user',
                        content: 'Debug message to test database type'
                    }
                ]
            }
        });

        if (createResponse.status === 200 || createResponse.status === 201) {
            console.log('✅ Test chat created');
            console.log(`   Chat ID: ${testChatId}`);
        } else {
            console.log(`❌ Failed to create test chat: ${createResponse.status}`);
            console.log(`   Response: ${JSON.stringify(createResponse.data)}`);
        }
        console.log('');

        // Test 2: Try to retrieve the chat to see the structure
        console.log('2️⃣ Retrieving test chat...');
        const getResponse = await makeRequest(`${SERVER_URL}/api/chats/${testChatId}`);
        
        if (getResponse.status === 200) {
            console.log('✅ Test chat retrieved');
            console.log(`   Title: ${getResponse.data.title}`);
            console.log(`   Messages count: ${getResponse.data.messages ? getResponse.data.messages.length : 0}`);
            console.log(`   Has context: ${getResponse.data.context ? 'Yes' : 'No'}`);
            console.log(`   Created at: ${getResponse.data.created_at}`);
            console.log(`   Updated at: ${getResponse.data.updated_at}`);
        } else {
            console.log(`❌ Failed to retrieve test chat: ${getResponse.status}`);
        }
        console.log('');

        // Test 3: Add a message to see if it persists
        console.log('3️⃣ Adding message to test persistence...');
        const messageResponse = await makeRequest(`${SERVER_URL}/api/messages`, {
            method: 'POST',
            body: {
                id: `msg_${Date.now()}_debug2`,
                chat_id: testChatId,
                sender: 'assistant',
                content: 'Debug response to test message persistence'
            }
        });

        if (messageResponse.status === 200 || messageResponse.status === 201) {
            console.log('✅ Message added successfully');
        } else {
            console.log(`❌ Failed to add message: ${messageResponse.status}`);
            console.log(`   Response: ${JSON.stringify(messageResponse.data)}`);
        }
        console.log('');

        // Test 4: Check stats again
        console.log('4️⃣ Checking updated stats...');
        const statsResponse = await makeRequest(`${SERVER_URL}/api/stats`);
        
        if (statsResponse.status === 200) {
            console.log('✅ Stats retrieved');
            console.log(`   Server type: ${statsResponse.data.server_type}`);
            console.log(`   Total chats: ${statsResponse.data.total_chats}`);
            console.log(`   Total messages: ${statsResponse.data.total_messages}`);
            console.log(`   Database URL configured: ${statsResponse.data.database_url_configured}`);
        }
        console.log('');

        // Test 5: Get all chats to see the structure
        console.log('5️⃣ Getting all chats...');
        const chatsResponse = await makeRequest(`${SERVER_URL}/api/chats`);
        
        if (chatsResponse.status === 200) {
            console.log('✅ Chats list retrieved');
            console.log(`   Total chats returned: ${chatsResponse.data.length}`);
            
            if (chatsResponse.data.length > 0) {
                const firstChat = chatsResponse.data[0];
                console.log(`   First chat ID: ${firstChat.id}`);
                console.log(`   First chat title: ${firstChat.title}`);
                console.log(`   First chat has messages: ${firstChat.messages ? firstChat.messages.length : 'No messages field'}`);
            }
        }
        console.log('');

        // Analysis
        console.log('📊 ANALYSIS:');
        
        if (statsResponse.data) {
            const stats = statsResponse.data;
            
            console.log(`🔍 Server type: "${stats.server_type}"`);
            
            if (stats.server_type === 'postgresql-database') {
                console.log('✅ PostgreSQL is being used correctly');
            } else if (stats.server_type === 'cloud-database') {
                console.log('⚠️ Showing "cloud-database" - likely SimpleDatabase with DATABASE_URL');
                console.log('   This means PostgreSQL import or initialization failed');
            } else {
                console.log(`❓ Unknown server type: ${stats.server_type}`);
            }
            
            if (stats.total_messages === 0 && createResponse.status === 200) {
                console.log('🚨 ISSUE: Messages not being counted properly');
                console.log('   This suggests SimpleDatabase is being used');
            }
        }

        console.log('');
        console.log('🔧 RECOMMENDATIONS:');
        console.log('1. Check Render deployment logs for PostgreSQL import errors');
        console.log('2. Verify pg module is installed during build');
        console.log('3. Check if DATABASE_URL is accessible from the application');
        console.log('4. Look for PostgreSQL connection errors in server logs');

    } catch (error) {
        console.error('❌ Debug failed:', error.message);
    }
}

if (require.main === module) {
    debugDatabaseConnection();
}

module.exports = { debugDatabaseConnection };
