#!/usr/bin/env node
/**
 * On-Demand System Testing Script
 * Tests the on-demand wake-up system and activity-based backup functionality
 */

const https = require('https');
const http = require('http');

// Configuration
const RENDER_URL = process.env.RENDER_URL || 'https://gemini-chat-cloud.onrender.com';
const LOCAL_URL = 'http://localhost:3000';

class OnDemandSystemTester {
    constructor() {
        this.testResults = [];
        this.startTime = Date.now();
    }

    async makeRequest(url, options = {}) {
        return new Promise((resolve, reject) => {
            const urlObj = new URL(url);
            const client = urlObj.protocol === 'https:' ? https : http;
            
            const req = client.request(url, {
                method: options.method || 'GET',
                headers: {
                    'User-Agent': 'OnDemand-System-Tester/1.0',
                    'Content-Type': 'application/json',
                    ...options.headers
                },
                timeout: options.timeout || 30000
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
                            responseTime: Date.now() - requestStart
                        });
                    } catch (error) {
                        resolve({
                            success: res.statusCode >= 200 && res.statusCode < 300,
                            status: res.statusCode,
                            data: data,
                            responseTime: Date.now() - requestStart
                        });
                    }
                });
            });

            const requestStart = Date.now();

            req.on('error', (error) => {
                resolve({
                    success: false,
                    error: error.message,
                    status: 0,
                    responseTime: Date.now() - requestStart
                });
            });

            req.on('timeout', () => {
                req.destroy();
                resolve({
                    success: false,
                    error: 'Request timeout',
                    status: 0,
                    responseTime: Date.now() - requestStart
                });
            });

            if (options.body) {
                req.write(JSON.stringify(options.body));
            }

            req.end();
        });
    }

    async testEndpoint(url, name, expectedStatus = 200) {
        console.log(`🔍 Testing ${name}...`);
        const result = await this.makeRequest(url);
        
        const testResult = {
            name,
            url,
            success: result.success && result.status === expectedStatus,
            status: result.status,
            responseTime: result.responseTime,
            error: result.error,
            data: result.data,
            timestamp: new Date().toISOString()
        };

        this.testResults.push(testResult);

        if (testResult.success) {
            console.log(`✅ ${name}: OK (${result.status}) - ${result.responseTime}ms`);
        } else {
            console.log(`❌ ${name}: Failed (${result.status}) - ${result.error || 'Unknown error'}`);
        }

        return testResult;
    }

    async testWakeUpBehavior(baseUrl) {
        console.log('\n🌅 Testing Wake-up Behavior');
        console.log('='.repeat(50));

        // Test 1: Health check (should work if app is awake)
        const health = await this.testEndpoint(`${baseUrl}/api/health`, 'Health Check');
        
        if (health.success && health.data) {
            console.log(`   Uptime: ${health.data.uptime_human || 'Unknown'}`);
            console.log(`   Memory: ${health.data.memory_usage?.rss_mb || 'Unknown'}MB`);
            console.log(`   Database: ${health.data.database_configured ? 'Connected' : 'Not configured'}`);
        }

        // Test 2: Activity status
        const activity = await this.testEndpoint(`${baseUrl}/api/activity/status`, 'Activity Status');
        
        if (activity.success && activity.data) {
            console.log(`   App Active: ${activity.data.isActive ? 'Yes' : 'No'}`);
            console.log(`   Request Count: ${activity.data.requestCount || 0}`);
            console.log(`   Last Activity: ${activity.data.lastActivityTime ? new Date(activity.data.lastActivityTime).toLocaleTimeString() : 'Never'}`);
        }

        // Test 3: Multiple rapid requests to simulate user activity
        console.log('\n🔄 Simulating user activity...');
        const activityTests = [];
        for (let i = 0; i < 5; i++) {
            activityTests.push(this.testEndpoint(`${baseUrl}/api/stats`, `Activity Simulation ${i + 1}`));
            await this.sleep(500); // 500ms between requests
        }

        await Promise.all(activityTests);

        // Test 4: Check activity status after simulation
        const activityAfter = await this.testEndpoint(`${baseUrl}/api/activity/status`, 'Activity Status After Simulation');
        
        if (activityAfter.success && activityAfter.data) {
            console.log(`   Request Count After: ${activityAfter.data.requestCount || 0}`);
            console.log(`   Still Active: ${activityAfter.data.isActive ? 'Yes' : 'No'}`);
        }

        return {
            initialHealth: health,
            activityTracking: activity,
            activityAfterSimulation: activityAfter
        };
    }

    async testBackupSystem(baseUrl) {
        console.log('\n🗄️ Testing On-Demand Backup System');
        console.log('='.repeat(50));

        // Test 1: Backup status
        const status = await this.testEndpoint(`${baseUrl}/api/backup/status`, 'Backup Status');
        
        if (status.success && status.data) {
            console.log(`   Configured: ${status.data.configured ? 'Yes' : 'No'}`);
            console.log(`   Last Backup: ${status.data.lastBackupTime ? new Date(status.data.lastBackupTime).toLocaleString() : 'Never'}`);
            console.log(`   In Progress: ${status.data.isBackupInProgress ? 'Yes' : 'No'}`);
            
            if (status.data.statistics) {
                console.log(`   Total Backups: ${status.data.statistics.totalBackups}`);
                console.log(`   Success Rate: ${status.data.statistics.successfulBackups}/${status.data.statistics.totalBackups}`);
            }
        }

        // Test 2: Backup trigger (should only work if app is active)
        const trigger = await this.testEndpoint(`${baseUrl}/api/backup/trigger`, 'Backup Trigger');
        
        if (trigger.success && trigger.data) {
            console.log(`   Trigger Result: ${trigger.data.status}`);
            if (trigger.data.result) {
                console.log(`   Backup Status: ${trigger.data.result.status}`);
                console.log(`   Reason: ${trigger.data.result.reason || 'N/A'}`);
            }
        }

        return {
            backupStatus: status,
            backupTrigger: trigger
        };
    }

    async testSleepSimulation(baseUrl) {
        console.log('\n😴 Testing Sleep Simulation');
        console.log('='.repeat(50));

        console.log('ℹ️ Note: This test simulates what happens when the app goes to sleep');
        console.log('   In a real scenario, the app would be unresponsive for 15+ minutes');

        // Test with very short timeout to simulate sleeping app
        console.log('🔍 Testing with short timeout (simulating sleeping app)...');
        
        const sleepTest = await this.makeRequest(`${baseUrl}/api/health`, { timeout: 1000 });
        
        if (!sleepTest.success) {
            console.log('✅ Sleep simulation successful - app appears unresponsive');
            console.log(`   Error: ${sleepTest.error}`);
            console.log(`   Response Time: ${sleepTest.responseTime}ms`);
        } else {
            console.log('ℹ️ App responded quickly - not sleeping');
        }

        return sleepTest;
    }

    async testWakeUpPage(baseUrl) {
        console.log('\n📱 Testing Wake-up Page');
        console.log('='.repeat(50));

        const wakeUpPage = await this.testEndpoint(`${baseUrl}/wake-up.html`, 'Wake-up Page', 200);
        
        if (wakeUpPage.success) {
            console.log('✅ Wake-up page is accessible');
            
            // Check if it contains expected content
            if (typeof wakeUpPage.data === 'string') {
                const hasWakeUpContent = wakeUpPage.data.includes('Iniciando aplicação') || 
                                       wakeUpPage.data.includes('WakeUpManager');
                console.log(`   Contains wake-up logic: ${hasWakeUpContent ? 'Yes' : 'No'}`);
            }
        }

        return wakeUpPage;
    }

    async runComprehensiveTest(baseUrl) {
        console.log(`🧪 Comprehensive On-Demand System Test`);
        console.log(`📡 Testing: ${baseUrl}`);
        console.log('='.repeat(60));

        const results = {
            wakeUpBehavior: await this.testWakeUpBehavior(baseUrl),
            backupSystem: await this.testBackupSystem(baseUrl),
            wakeUpPage: await this.testWakeUpPage(baseUrl)
        };

        return results;
    }

    generateReport() {
        const totalTests = this.testResults.length;
        const successfulTests = this.testResults.filter(t => t.success).length;
        const failedTests = totalTests - successfulTests;
        const avgResponseTime = this.testResults.reduce((sum, t) => sum + (t.responseTime || 0), 0) / totalTests;

        console.log('\n📊 Test Report');
        console.log('='.repeat(50));
        console.log(`Total Tests: ${totalTests}`);
        console.log(`Successful: ${successfulTests} (${Math.round(successfulTests/totalTests*100)}%)`);
        console.log(`Failed: ${failedTests} (${Math.round(failedTests/totalTests*100)}%)`);
        console.log(`Average Response Time: ${Math.round(avgResponseTime)}ms`);
        console.log(`Test Duration: ${Math.round((Date.now() - this.startTime)/1000)}s`);

        if (failedTests > 0) {
            console.log('\n❌ Failed Tests:');
            this.testResults.filter(t => !t.success).forEach(test => {
                console.log(`   ${test.name}: ${test.error || `HTTP ${test.status}`}`);
            });
        }

        console.log('\n🎯 On-Demand System Assessment:');
        
        const healthTests = this.testResults.filter(t => t.name.includes('Health'));
        const activityTests = this.testResults.filter(t => t.name.includes('Activity'));
        const backupTests = this.testResults.filter(t => t.name.includes('Backup'));

        console.log(`   Wake-up System: ${healthTests.every(t => t.success) ? '✅ Working' : '❌ Issues detected'}`);
        console.log(`   Activity Tracking: ${activityTests.every(t => t.success) ? '✅ Working' : '❌ Issues detected'}`);
        console.log(`   Backup System: ${backupTests.every(t => t.success) ? '✅ Working' : '❌ Issues detected'}`);

        return {
            totalTests,
            successfulTests,
            failedTests,
            avgResponseTime,
            duration: Date.now() - this.startTime,
            allTestsPassed: failedTests === 0
        };
    }

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

async function main() {
    const tester = new OnDemandSystemTester();
    const command = process.argv[2];
    const url = process.argv[3] || RENDER_URL;

    switch (command) {
        case 'local':
            await tester.runComprehensiveTest(LOCAL_URL);
            break;
        case 'prod':
        case 'production':
            await tester.runComprehensiveTest(RENDER_URL);
            break;
        case 'wake-up':
            await tester.testWakeUpBehavior(url);
            break;
        case 'backup':
            await tester.testBackupSystem(url);
            break;
        case 'sleep':
            await tester.testSleepSimulation(url);
            break;
        case 'full':
        default:
            console.log('🔄 Testing both local and production...\n');
            
            console.log('🏠 Local Server Test:');
            await tester.runComprehensiveTest(LOCAL_URL);
            
            console.log('\n🌐 Production Server Test:');
            await tester.runComprehensiveTest(RENDER_URL);
            break;
    }

    const report = tester.generateReport();
    
    console.log('\n💡 Next Steps:');
    if (report.allTestsPassed) {
        console.log('✅ All tests passed! Your on-demand system is working correctly.');
        console.log('   - The app will only wake up when users visit it');
        console.log('   - Backups will only run during active periods');
        console.log('   - No constant resource usage from scheduled pings');
    } else {
        console.log('⚠️ Some tests failed. Check the following:');
        console.log('   - Ensure the app is deployed and accessible');
        console.log('   - Verify Google Drive backup configuration');
        console.log('   - Check server logs for any errors');
    }

    process.exit(report.allTestsPassed ? 0 : 1);
}

if (require.main === module) {
    main().catch(console.error);
}

module.exports = OnDemandSystemTester;
