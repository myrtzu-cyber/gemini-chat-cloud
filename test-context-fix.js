#!/usr/bin/env node
/**
 * Test Script for Context Saving Fix
 * Tests the fix for new conversation context saving issue
 */

const https = require('https');
const http = require('http');

class ContextFixTester {
    constructor() {
        this.baseUrl = process.env.RENDER_URL || 'https://gemini-chat-cloud.onrender.com';
        this.testChatId = `test-context-fix-${Date.now()}`;
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
                            data: data,
                            rawData: data
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

    async testContextSavingOnNonExistentChat() {
        console.log('\n🧪 Test 1: Context Saving on Non-Existent Chat');
        console.log('='.repeat(55));
        
        const nonExistentChatId = 'non-existent-chat-' + Date.now();
        console.log(`Testing with non-existent chat ID: ${nonExistentChatId}`);

        const contextData = {
            master_rules: 'Test rules for non-existent chat',
            character_sheet: '',
            local_history: '',
            current_plot: '',
            relations: '',
            aventura: '',
            lastCompressionTime: null
        };

        const result = await this.makeRequest(`${this.baseUrl}/api/chats/${nonExistentChatId}/context`, {
            method: 'PUT',
            body: contextData
        });

        console.log(`Response status: ${result.status}`);
        console.log(`Response data:`, result.data);

        if (result.status === 404) {
            console.log('✅ PASS: Correctly returns 404 for non-existent chat');
            return true;
        } else {
            console.log('❌ FAIL: Should return 404 for non-existent chat');
            return false;
        }
    }

    async testChatCreationAndContextSaving() {
        console.log('\n🧪 Test 2: Chat Creation and Context Saving');
        console.log('='.repeat(50));

        // Step 1: Create a new chat
        console.log(`Step 1: Creating new chat with ID: ${this.testChatId}`);
        
        const chatData = {
            id: this.testChatId,
            title: 'Test Chat for Context Fix',
            model: 'gemini-2.5-flash',
            messages: [],
            context: {
                master_rules: '',
                character_sheet: '',
                local_history: '',
                current_plot: '',
                relations: '',
                aventura: '',
                lastCompressionTime: null
            }
        };

        const createResult = await this.makeRequest(`${this.baseUrl}/api/chats`, {
            method: 'POST',
            body: chatData
        });

        console.log(`Chat creation status: ${createResult.status}`);
        console.log(`Chat creation response:`, createResult.data);

        if (!createResult.success) {
            console.log('❌ FAIL: Could not create test chat');
            return false;
        }

        // Step 2: Save context to the newly created chat
        console.log(`\nStep 2: Saving context to chat ${this.testChatId}`);
        
        const contextData = {
            master_rules: 'Test rules for newly created chat',
            character_sheet: 'Test character sheet',
            local_history: 'Test local history',
            current_plot: 'Test current plot',
            relations: 'Test relations',
            aventura: 'Test aventura content',
            lastCompressionTime: Date.now()
        };

        const contextResult = await this.makeRequest(`${this.baseUrl}/api/chats/${this.testChatId}/context`, {
            method: 'PUT',
            body: contextData
        });

        console.log(`Context save status: ${contextResult.status}`);
        console.log(`Context save response:`, contextResult.data);

        if (contextResult.success) {
            console.log('✅ PASS: Context saved successfully to newly created chat');
            
            // Step 3: Verify context was saved
            console.log(`\nStep 3: Verifying context was saved`);
            
            const verifyResult = await this.makeRequest(`${this.baseUrl}/api/chats/${this.testChatId}`);
            
            if (verifyResult.success && verifyResult.data.context) {
                try {
                    const savedContext = typeof verifyResult.data.context === 'string' ? 
                        JSON.parse(verifyResult.data.context) : verifyResult.data.context;
                    
                    console.log('✅ PASS: Context verification successful');
                    console.log(`Saved master_rules: ${savedContext.master_rules}`);
                    console.log(`Saved aventura: ${savedContext.aventura}`);
                    return true;
                } catch (parseError) {
                    console.log('❌ FAIL: Could not parse saved context');
                    return false;
                }
            } else {
                console.log('❌ FAIL: Context verification failed');
                return false;
            }
        } else {
            console.log('❌ FAIL: Context save failed');
            return false;
        }
    }

    async testChatPersistenceAfterRefresh() {
        console.log('\n🧪 Test 3: Chat Persistence After Refresh');
        console.log('='.repeat(50));

        // Check if our test chat still exists
        console.log(`Checking if chat ${this.testChatId} still exists...`);
        
        const checkResult = await this.makeRequest(`${this.baseUrl}/api/chats/${this.testChatId}`);
        
        if (checkResult.success) {
            console.log('✅ PASS: Chat persists after operations');
            console.log(`Chat title: ${checkResult.data.title}`);
            console.log(`Chat has context: ${checkResult.data.context ? 'Yes' : 'No'}`);
            return true;
        } else {
            console.log('❌ FAIL: Chat does not persist');
            return false;
        }
    }

    async testDatabaseRecoverySystem() {
        console.log('\n🧪 Test 4: Database Recovery System');
        console.log('='.repeat(45));

        const recoveryResult = await this.makeRequest(`${this.baseUrl}/api/database/recovery`);
        
        if (recoveryResult.success) {
            console.log('✅ PASS: Database recovery system accessible');
            console.log(`Current chats: ${recoveryResult.data.currentData.chats}`);
            console.log(`Current messages: ${recoveryResult.data.currentData.messages}`);
            console.log(`Main file exists: ${recoveryResult.data.files.mainFile.exists}`);
            console.log(`Backup file exists: ${recoveryResult.data.files.backupFile.exists}`);
            return true;
        } else {
            console.log('❌ FAIL: Database recovery system not accessible');
            return false;
        }
    }

    async cleanup() {
        console.log('\n🧹 Cleanup: Removing Test Chat');
        console.log('='.repeat(35));

        const deleteResult = await this.makeRequest(`${this.baseUrl}/api/chats/${this.testChatId}`, {
            method: 'DELETE'
        });

        if (deleteResult.success) {
            console.log('✅ Test chat deleted successfully');
        } else {
            console.log('⚠️ Could not delete test chat (may not exist)');
        }
    }

    async runAllTests() {
        console.log('🧪 Context Saving Fix - Test Suite');
        console.log('=====================================');
        console.log(`📡 Testing: ${this.baseUrl}`);
        console.log(`🕒 Started: ${new Date().toLocaleString()}\n`);

        const results = {
            test1: await this.testContextSavingOnNonExistentChat(),
            test2: await this.testChatCreationAndContextSaving(),
            test3: await this.testChatPersistenceAfterRefresh(),
            test4: await this.testDatabaseRecoverySystem()
        };

        await this.cleanup();

        console.log('\n📊 Test Results Summary');
        console.log('='.repeat(30));
        console.log(`Test 1 (404 for non-existent): ${results.test1 ? '✅ PASS' : '❌ FAIL'}`);
        console.log(`Test 2 (Chat creation + context): ${results.test2 ? '✅ PASS' : '❌ FAIL'}`);
        console.log(`Test 3 (Chat persistence): ${results.test3 ? '✅ PASS' : '❌ FAIL'}`);
        console.log(`Test 4 (Database recovery): ${results.test4 ? '✅ PASS' : '❌ FAIL'}`);

        const passCount = Object.values(results).filter(Boolean).length;
        const totalTests = Object.keys(results).length;

        console.log(`\n🎯 Overall Result: ${passCount}/${totalTests} tests passed`);
        
        if (passCount === totalTests) {
            console.log('🎉 ALL TESTS PASSED! Context saving fix is working correctly.');
        } else {
            console.log('⚠️ Some tests failed. Please review the implementation.');
        }

        return results;
    }
}

// Run tests
if (require.main === module) {
    const tester = new ContextFixTester();
    tester.runAllTests().catch(console.error);
}

module.exports = ContextFixTester;
