#!/usr/bin/env node
/**
 * Local PostgreSQL Database Test
 * Tests the PostgreSQL implementation locally before deployment
 */

require('dotenv').config();

async function testPostgresDatabase() {
    console.log('🧪 Testing PostgreSQL Database Implementation');
    console.log('');

    // Check if DATABASE_URL is configured
    if (!process.env.DATABASE_URL) {
        console.log('⚠️ DATABASE_URL not configured');
        console.log('💾 Testing with SimpleDatabase fallback...');
        console.log('');
        
        // Test SimpleDatabase
        const SimpleDatabase = require('./backend/server-cloud.js');
        // This would require extracting SimpleDatabase class, but for now we'll skip
        console.log('ℹ️ To test SimpleDatabase, run the server locally and use the API endpoints');
        return;
    }

    try {
        // Import PostgreSQL database
        const PostgresDatabase = require('./backend/database-postgres.js');
        
        console.log('✅ PostgresDatabase imported successfully');
        console.log('');

        // Create database instance
        const db = new PostgresDatabase();
        console.log('✅ PostgresDatabase instance created');
        console.log('');

        // Initialize database
        console.log('🔄 Initializing database...');
        await db.initialize();
        console.log('✅ Database initialized successfully');
        console.log('');

        // Test creating a chat
        console.log('🔄 Testing chat creation...');
        const testChatId = `test_${Date.now()}`;
        const createResult = await db.createChat({
            id: testChatId,
            title: 'Test Chat',
            model: 'gemini-pro',
            context: { test: true },
            messages: [
                {
                    id: `msg_${Date.now()}_1`,
                    sender: 'user',
                    content: 'Test message 1'
                },
                {
                    id: `msg_${Date.now()}_2`,
                    sender: 'assistant',
                    content: 'Test response 1'
                }
            ]
        });

        if (createResult.success) {
            console.log('✅ Chat created successfully');
        } else {
            throw new Error(`Chat creation failed: ${createResult.error}`);
        }
        console.log('');

        // Test adding a message
        console.log('🔄 Testing message addition...');
        const messageResult = await db.addMessage({
            id: `msg_${Date.now()}_3`,
            chat_id: testChatId,
            sender: 'user',
            content: 'Additional test message',
            files: []
        });

        if (messageResult.success) {
            console.log('✅ Message added successfully');
        } else {
            throw new Error(`Message addition failed: ${messageResult.error}`);
        }
        console.log('');

        // Test updating context
        console.log('🔄 Testing context update...');
        const contextResult = await db.updateChatContext(testChatId, {
            test: true,
            updated: true,
            timestamp: new Date().toISOString()
        });

        if (contextResult.success) {
            console.log('✅ Context updated successfully');
        } else {
            throw new Error(`Context update failed: ${contextResult.error}`);
        }
        console.log('');

        // Test retrieving chat with messages
        console.log('🔄 Testing chat retrieval...');
        const retrievedChat = await db.getChatWithMessages(testChatId);

        if (retrievedChat) {
            console.log('✅ Chat retrieved successfully');
            console.log(`   Title: ${retrievedChat.title}`);
            console.log(`   Messages: ${retrievedChat.messages.length}`);
            console.log(`   Has context: ${retrievedChat.context ? 'Yes' : 'No'}`);
        } else {
            throw new Error('Chat retrieval failed');
        }
        console.log('');

        // Test getting all chats
        console.log('🔄 Testing chats list...');
        const allChats = await db.getChats();
        console.log(`✅ Retrieved ${allChats.length} chats`);
        console.log('');

        // Test getting stats
        console.log('🔄 Testing stats...');
        const stats = await db.getStats();
        console.log('✅ Stats retrieved:');
        console.log(`   Total chats: ${stats.total_chats}`);
        console.log(`   Total messages: ${stats.total_messages}`);
        console.log(`   Server type: ${stats.server_type}`);
        console.log('');

        // Close connection
        await db.close();
        console.log('✅ Database connection closed');
        console.log('');

        console.log('🎉 ALL TESTS PASSED!');
        console.log('');
        console.log('✅ PostgreSQL database implementation is working correctly');
        console.log('✅ Ready for deployment to Render');

    } catch (error) {
        console.error('❌ TEST FAILED');
        console.error('Error:', error.message);
        console.error('');
        console.error('🔍 Troubleshooting:');
        console.error('   1. Check DATABASE_URL format: postgresql://user:password@host:port/database');
        console.error('   2. Ensure PostgreSQL server is running and accessible');
        console.error('   3. Verify database credentials and permissions');
        console.error('   4. Check if pg module is installed: npm install pg');
        console.error('');
        console.error('Stack trace:');
        console.error(error.stack);
        process.exit(1);
    }
}

// Run the test
if (require.main === module) {
    testPostgresDatabase();
}

module.exports = { testPostgresDatabase };
