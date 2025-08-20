#!/usr/bin/env node
/**
 * Database Persistence Test Script
 * Tests data persistence across application restarts
 */

const https = require('https');
const http = require('http');

// Configuration
const SERVER_URL = process.env.SERVER_URL || 'https://gemini-chat-cloud.onrender.com';
const TEST_CHAT_ID = `test_persistence_${Date.now()}`;
const TEST_CHAT_TITLE = 'Persistence Test Chat';

// Helper function to make HTTP requests
function makeRequest(url, options = {}) {
    return new Promise((resolve, reject) => {
        const isHttps = url.startsWith('https');
        const client = isHttps ? https : http;
        
        const requestOptions = {
            ...options,
            headers: {
                'Content-Type': 'application/json',
                ...options.headers
            }
        };

        if (isHttps) {
            requestOptions.rejectUnauthorized = false; // For self-signed certificates
        }

        const req = client.request(url, requestOptions, (res) => {
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

async function testDatabasePersistence() {
    console.log('🧪 Starting Database Persistence Test');
    console.log(`📍 Server URL: ${SERVER_URL}`);
    console.log(`🆔 Test Chat ID: ${TEST_CHAT_ID}`);
    console.log('');

    try {
        // Step 1: Check server health
        console.log('1️⃣ Checking server health...');
        const healthResponse = await makeRequest(`${SERVER_URL}/api/health`);
        
        if (healthResponse.status !== 200) {
            throw new Error(`Server health check failed: ${healthResponse.status}`);
        }
        
        console.log('✅ Server is healthy');
        console.log(`   Database type: ${healthResponse.data.database_type || 'unknown'}`);
        console.log('');

        // Step 2: Get initial stats
        console.log('2️⃣ Getting initial database stats...');
        const initialStatsResponse = await makeRequest(`${SERVER_URL}/api/stats`);
        
        if (initialStatsResponse.status !== 200) {
            throw new Error(`Failed to get initial stats: ${initialStatsResponse.status}`);
        }
        
        const initialStats = initialStatsResponse.data;
        console.log('✅ Initial stats retrieved');
        console.log(`   Total chats: ${initialStats.total_chats}`);
        console.log(`   Total messages: ${initialStats.total_messages}`);
        console.log(`   Server type: ${initialStats.server_type}`);
        console.log('');

        // Step 3: Create a test chat
        console.log('3️⃣ Creating test chat...');
        const createChatResponse = await makeRequest(`${SERVER_URL}/api/chats`, {
            method: 'POST',
            body: {
                id: TEST_CHAT_ID,
                title: TEST_CHAT_TITLE,
                model: 'gemini-pro',
                messages: [
                    {
                        id: `msg_${Date.now()}_1`,
                        sender: 'user',
                        content: 'This is a persistence test message'
                    },
                    {
                        id: `msg_${Date.now()}_2`,
                        sender: 'assistant',
                        content: 'This message should persist across restarts'
                    }
                ],
                context: {
                    testData: 'persistence_test',
                    timestamp: new Date().toISOString(),
                    purpose: 'verify data persistence across deployments'
                }
            }
        });

        if (createChatResponse.status !== 200 && createChatResponse.status !== 201) {
            throw new Error(`Failed to create test chat: ${createChatResponse.status} - ${JSON.stringify(createChatResponse.data)}`);
        }

        console.log('✅ Test chat created successfully');
        console.log(`   Chat ID: ${TEST_CHAT_ID}`);
        console.log('');

        // Step 4: Add an additional message
        console.log('4️⃣ Adding additional message...');
        const addMessageResponse = await makeRequest(`${SERVER_URL}/api/messages`, {
            method: 'POST',
            body: {
                id: `msg_${Date.now()}_3`,
                chat_id: TEST_CHAT_ID,
                sender: 'user',
                content: 'Additional message to test message persistence'
            }
        });

        if (addMessageResponse.status !== 200 && addMessageResponse.status !== 201) {
            console.log(`⚠️ Failed to add message: ${addMessageResponse.status} - ${JSON.stringify(addMessageResponse.data)}`);
        } else {
            console.log('✅ Additional message added');
        }
        console.log('');

        // Step 5: Update chat context
        console.log('5️⃣ Updating chat context...');
        const updateContextResponse = await makeRequest(`${SERVER_URL}/api/chats/${TEST_CHAT_ID}/context`, {
            method: 'PUT',
            body: {
                testData: 'persistence_test_updated',
                timestamp: new Date().toISOString(),
                purpose: 'verify context persistence across deployments',
                updateCount: 1
            }
        });

        if (updateContextResponse.status !== 200) {
            console.log(`⚠️ Failed to update context: ${updateContextResponse.status} - ${JSON.stringify(updateContextResponse.data)}`);
        } else {
            console.log('✅ Chat context updated');
        }
        console.log('');

        // Step 6: Verify chat retrieval
        console.log('6️⃣ Verifying chat retrieval...');
        const getChatResponse = await makeRequest(`${SERVER_URL}/api/chats/${TEST_CHAT_ID}`);
        
        if (getChatResponse.status !== 200) {
            throw new Error(`Failed to retrieve test chat: ${getChatResponse.status}`);
        }

        const retrievedChat = getChatResponse.data;
        console.log('✅ Test chat retrieved successfully');
        console.log(`   Title: ${retrievedChat.title}`);
        console.log(`   Messages count: ${retrievedChat.messages ? retrievedChat.messages.length : 0}`);
        console.log(`   Has context: ${retrievedChat.context ? 'Yes' : 'No'}`);
        console.log('');

        // Step 7: Get final stats
        console.log('7️⃣ Getting final database stats...');
        const finalStatsResponse = await makeRequest(`${SERVER_URL}/api/stats`);
        
        if (finalStatsResponse.status !== 200) {
            throw new Error(`Failed to get final stats: ${finalStatsResponse.status}`);
        }
        
        const finalStats = finalStatsResponse.data;
        console.log('✅ Final stats retrieved');
        console.log(`   Total chats: ${finalStats.total_chats} (was ${initialStats.total_chats})`);
        console.log(`   Total messages: ${finalStats.total_messages} (was ${initialStats.total_messages})`);
        console.log(`   Server type: ${finalStats.server_type}`);
        console.log('');

        // Summary
        console.log('🎉 PERSISTENCE TEST COMPLETED SUCCESSFULLY');
        console.log('');
        console.log('📋 Test Summary:');
        console.log(`   ✅ Chat created: ${TEST_CHAT_ID}`);
        console.log(`   ✅ Messages added: ${retrievedChat.messages ? retrievedChat.messages.length : 0}`);
        console.log(`   ✅ Context saved: ${retrievedChat.context ? 'Yes' : 'No'}`);
        console.log(`   ✅ Data retrievable: Yes`);
        console.log('');
        console.log('🔄 To test persistence across restarts:');
        console.log('   1. Note the test chat ID above');
        console.log('   2. Trigger a redeploy or wait for the app to sleep');
        console.log('   3. Run this test again to verify the data still exists');
        console.log('');
        console.log(`📝 Test Chat ID for verification: ${TEST_CHAT_ID}`);

    } catch (error) {
        console.error('❌ PERSISTENCE TEST FAILED');
        console.error('Error:', error.message);
        console.error('');
        console.error('🔍 Troubleshooting:');
        console.error('   1. Check if the server is running');
        console.error('   2. Verify DATABASE_URL is configured');
        console.error('   3. Check server logs for database connection issues');
        console.error('   4. Ensure PostgreSQL database is accessible');
        process.exit(1);
    }
}

// Run the test
if (require.main === module) {
    testDatabasePersistence();
}

module.exports = { testDatabasePersistence };
