#!/usr/bin/env node
/**
 * Test Chat Loading Fix
 * Verifies that the getAllChats method fix resolves the runtime error
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
            req.write(typeof options.body === 'string' ? options.body : JSON.stringify(options.body));
        }
        
        req.end();
    });
}

async function testChatLoadingFix() {
    console.log('🧪 Testing Chat Loading Fix');
    console.log(`📍 Server: ${SERVER_URL}`);
    console.log('');

    try {
        // Test 1: Check if server is running with PostgreSQL
        console.log('1️⃣ Checking server status...');
        const healthResponse = await makeRequest(`${SERVER_URL}/api/health`);
        
        if (healthResponse.status === 200) {
            console.log('✅ Server is healthy');
            console.log(`   Database type: ${healthResponse.data.database_type}`);
        } else {
            throw new Error(`Server health check failed: ${healthResponse.status}`);
        }
        console.log('');

        // Test 2: Test /api/chats endpoint (this was failing before)
        console.log('2️⃣ Testing /api/chats endpoint...');
        const chatsResponse = await makeRequest(`${SERVER_URL}/api/chats`);
        
        if (chatsResponse.status === 200) {
            console.log('✅ /api/chats endpoint working successfully!');
            console.log(`   Retrieved ${chatsResponse.data.length} chats`);
            
            if (chatsResponse.data.length > 0) {
                const firstChat = chatsResponse.data[0];
                console.log(`   First chat: "${firstChat.title}" (${firstChat.id})`);
                console.log(`   Created: ${firstChat.created_at}`);
                console.log(`   Updated: ${firstChat.updated_at}`);
            }
        } else {
            console.log(`❌ /api/chats endpoint failed: HTTP ${chatsResponse.status}`);
            console.log(`   Response: ${JSON.stringify(chatsResponse.data)}`);
        }
        console.log('');

        // Test 3: Test /api/chats/last endpoint (this was also failing before)
        console.log('3️⃣ Testing /api/chats/last endpoint...');
        const lastChatResponse = await makeRequest(`${SERVER_URL}/api/chats/last`);
        
        if (lastChatResponse.status === 200) {
            console.log('✅ /api/chats/last endpoint working successfully!');
            
            if (lastChatResponse.data) {
                console.log(`   Last chat: "${lastChatResponse.data.title}" (${lastChatResponse.data.id})`);
                console.log(`   Messages: ${lastChatResponse.data.messages ? lastChatResponse.data.messages.length : 0}`);
                console.log(`   Has context: ${lastChatResponse.data.context ? 'Yes' : 'No'}`);
            } else {
                console.log('   No chats found (empty database)');
            }
        } else if (lastChatResponse.status === 404) {
            console.log('✅ /api/chats/last endpoint working (no chats found)');
        } else {
            console.log(`❌ /api/chats/last endpoint failed: HTTP ${lastChatResponse.status}`);
            console.log(`   Response: ${JSON.stringify(lastChatResponse.data)}`);
        }
        console.log('');

        // Test 4: Create a test chat to verify full functionality
        console.log('4️⃣ Creating test chat to verify full functionality...');
        const testChatId = `test_fix_${Date.now()}`;
        
        const createResponse = await makeRequest(`${SERVER_URL}/api/chats`, {
            method: 'POST',
            body: {
                id: testChatId,
                title: 'Test Chat - getAllChats Fix',
                model: 'gemini-pro',
                messages: [
                    {
                        id: `msg_${Date.now()}_1`,
                        sender: 'user',
                        content: 'Testing the getAllChats fix'
                    },
                    {
                        id: `msg_${Date.now()}_2`,
                        sender: 'assistant',
                        content: 'The fix is working correctly!'
                    }
                ],
                context: {
                    testFix: true,
                    timestamp: new Date().toISOString()
                }
            }
        });

        if (createResponse.status === 200 || createResponse.status === 201) {
            console.log('✅ Test chat created successfully');
            console.log(`   Chat ID: ${testChatId}`);
        } else {
            console.log(`⚠️ Failed to create test chat: ${createResponse.status}`);
        }
        console.log('');

        // Test 5: Verify the new chat appears in the list
        console.log('5️⃣ Verifying new chat appears in chat list...');
        const updatedChatsResponse = await makeRequest(`${SERVER_URL}/api/chats`);
        
        if (updatedChatsResponse.status === 200) {
            const testChat = updatedChatsResponse.data.find(chat => chat.id === testChatId);
            
            if (testChat) {
                console.log('✅ New test chat found in chat list');
                console.log(`   Title: ${testChat.title}`);
                console.log(`   ID: ${testChat.id}`);
            } else {
                console.log('⚠️ Test chat not found in list (might be a persistence issue)');
            }
            
            console.log(`   Total chats now: ${updatedChatsResponse.data.length}`);
        }
        console.log('');

        // Test 6: Check database stats
        console.log('6️⃣ Checking database statistics...');
        const statsResponse = await makeRequest(`${SERVER_URL}/api/stats`);
        
        if (statsResponse.status === 200) {
            console.log('✅ Database stats retrieved');
            console.log(`   Server type: ${statsResponse.data.server_type}`);
            console.log(`   Total chats: ${statsResponse.data.total_chats}`);
            console.log(`   Total messages: ${statsResponse.data.total_messages}`);
        }
        console.log('');

        // Summary
        console.log('🎉 CHAT LOADING FIX TEST COMPLETED');
        console.log('');
        console.log('📋 RESULTS SUMMARY:');
        console.log(`   ✅ Server health: ${healthResponse.status === 200 ? 'OK' : 'FAILED'}`);
        console.log(`   ✅ /api/chats: ${chatsResponse.status === 200 ? 'WORKING' : 'FAILED'}`);
        console.log(`   ✅ /api/chats/last: ${lastChatResponse.status === 200 || lastChatResponse.status === 404 ? 'WORKING' : 'FAILED'}`);
        console.log(`   ✅ Chat creation: ${createResponse.status === 200 || createResponse.status === 201 ? 'WORKING' : 'FAILED'}`);
        
        if (chatsResponse.status === 200 && (lastChatResponse.status === 200 || lastChatResponse.status === 404)) {
            console.log('');
            console.log('🎯 SUCCESS: The getAllChats method fix has resolved the runtime error!');
            console.log('✅ Chat conversations should now load properly in the mobile application');
        } else {
            console.log('');
            console.log('❌ ISSUE: Some endpoints are still failing');
            console.log('🔍 Check the server logs for additional error details');
        }

    } catch (error) {
        console.error('❌ Test failed with error:', error.message);
        console.error('');
        console.error('🔍 Possible issues:');
        console.error('   - Server is not responding');
        console.error('   - Network connectivity problems');
        console.error('   - Server is still starting up');
        console.error('   - The fix has not been deployed yet');
    }
}

if (require.main === module) {
    testChatLoadingFix();
}

module.exports = { testChatLoadingFix };
