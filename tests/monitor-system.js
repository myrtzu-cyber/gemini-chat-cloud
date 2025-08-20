#!/usr/bin/env node
/**
 * System Monitor for Wake-up and Backup Systems
 * Monitors the health of both the keep-alive and backup systems
 */

const https = require('https');
const http = require('http');

// Configuration
const RENDER_URL = process.env.RENDER_URL || 'https://gemini-chat-cloud.onrender.com';
const CHECK_INTERVAL = 5 * 60 * 1000; // 5 minutes
const GITHUB_API_URL = 'https://api.github.com/repos/YOUR_USERNAME/YOUR_REPO/actions/workflows';

class SystemMonitor {
    constructor() {
        this.lastHealthCheck = null;
        this.lastBackupCheck = null;
        this.healthHistory = [];
        this.backupHistory = [];
        this.isMonitoring = false;
    }

    async makeRequest(url, options = {}) {
        return new Promise((resolve, reject) => {
            const urlObj = new URL(url);
            const client = urlObj.protocol === 'https:' ? https : http;
            
            const req = client.request(url, {
                method: options.method || 'GET',
                headers: {
                    'User-Agent': 'Gemini-Chat-Monitor/1.0',
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
                            data: jsonData,
                            headers: res.headers
                        });
                    } catch (error) {
                        resolve({
                            success: res.statusCode >= 200 && res.statusCode < 300,
                            status: res.statusCode,
                            data: data,
                            headers: res.headers
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

            req.end();
        });
    }

    async checkHealth() {
        console.log('🏥 Checking application health...');
        
        const result = await this.makeRequest(`${RENDER_URL}/api/health`);
        const timestamp = new Date().toISOString();
        
        if (result.success && result.data) {
            const health = result.data;
            console.log(`✅ Health check successful`);
            console.log(`   Status: ${health.status}`);
            console.log(`   Uptime: ${health.uptime_human || 'Unknown'}`);
            console.log(`   Memory: ${health.memory_usage?.rss_mb || 'Unknown'}MB RSS`);
            console.log(`   Database: ${health.database_configured ? 'Connected' : 'Not configured'}`);
            console.log(`   Chats: ${health.total_chats || 0}, Messages: ${health.total_messages || 0}`);
            
            this.healthHistory.unshift({
                timestamp,
                status: 'success',
                uptime: health.uptime_seconds,
                memory: health.memory_usage?.rss_mb,
                database: health.database_configured
            });
        } else {
            console.log(`❌ Health check failed: ${result.error || 'Unknown error'}`);
            this.healthHistory.unshift({
                timestamp,
                status: 'error',
                error: result.error
            });
        }

        // Keep only last 20 entries
        if (this.healthHistory.length > 20) {
            this.healthHistory = this.healthHistory.slice(0, 20);
        }

        this.lastHealthCheck = timestamp;
        return result;
    }

    async checkBackupSystem() {
        console.log('🗄️ Checking backup system...');
        
        const result = await this.makeRequest(`${RENDER_URL}/api/backup/status`);
        const timestamp = new Date().toISOString();
        
        if (result.success && result.data) {
            const backup = result.data;
            console.log(`✅ Backup system check successful`);
            console.log(`   Configured: ${backup.configured ? 'Yes' : 'No'}`);
            console.log(`   Last backup: ${backup.lastBackupTime ? new Date(backup.lastBackupTime).toLocaleString() : 'Never'}`);
            console.log(`   In progress: ${backup.isBackupInProgress ? 'Yes' : 'No'}`);
            
            if (backup.nextBackupAt) {
                console.log(`   Next backup: ${new Date(backup.nextBackupAt).toLocaleString()}`);
            }
            
            if (backup.statistics) {
                console.log(`   Total backups: ${backup.statistics.totalBackups}`);
                console.log(`   Successful: ${backup.statistics.successfulBackups}`);
                console.log(`   Failed: ${backup.statistics.failedBackups}`);
            }

            if (backup.driveInfo) {
                console.log(`   Drive folder: ${backup.driveInfo.folderName}`);
                console.log(`   Total files: ${backup.driveInfo.totalFiles}`);
                console.log(`   Total size: ${Math.round(backup.driveInfo.totalSize / 1024 / 1024)}MB`);
            }
            
            this.backupHistory.unshift({
                timestamp,
                status: 'success',
                configured: backup.configured,
                lastBackup: backup.lastBackupTime,
                totalBackups: backup.statistics?.totalBackups || 0
            });
        } else {
            console.log(`❌ Backup system check failed: ${result.error || 'Unknown error'}`);
            this.backupHistory.unshift({
                timestamp,
                status: 'error',
                error: result.error
            });
        }

        // Keep only last 20 entries
        if (this.backupHistory.length > 20) {
            this.backupHistory = this.backupHistory.slice(0, 20);
        }

        this.lastBackupCheck = timestamp;
        return result;
    }

    async triggerBackup() {
        console.log('🔧 Triggering manual backup...');
        
        const result = await this.makeRequest(`${RENDER_URL}/api/backup/manual`, {
            method: 'POST'
        });
        
        if (result.success) {
            console.log('✅ Manual backup triggered successfully');
            if (result.data?.result) {
                const backup = result.data.result;
                console.log(`   File: ${backup.fileName}`);
                console.log(`   Size: ${Math.round(backup.size / 1024)}KB`);
                console.log(`   Chats: ${backup.chatsCount}, Messages: ${backup.messagesCount}`);
            }
        } else {
            console.log(`❌ Manual backup failed: ${result.error || 'Unknown error'}`);
        }
        
        return result;
    }

    printSummary() {
        console.log('\n📊 System Summary');
        console.log('='.repeat(50));
        
        // Health summary
        const recentHealth = this.healthHistory.slice(0, 5);
        const healthSuccess = recentHealth.filter(h => h.status === 'success').length;
        console.log(`🏥 Health Checks (last 5): ${healthSuccess}/5 successful`);
        
        if (recentHealth.length > 0 && recentHealth[0].status === 'success') {
            console.log(`   Current uptime: ${Math.floor(recentHealth[0].uptime / 3600)}h ${Math.floor((recentHealth[0].uptime % 3600) / 60)}m`);
            console.log(`   Memory usage: ${recentHealth[0].memory}MB`);
        }
        
        // Backup summary
        const recentBackups = this.backupHistory.slice(0, 5);
        const backupSuccess = recentBackups.filter(b => b.status === 'success').length;
        console.log(`🗄️ Backup Checks (last 5): ${backupSuccess}/5 successful`);
        
        if (recentBackups.length > 0 && recentBackups[0].status === 'success') {
            console.log(`   Configured: ${recentBackups[0].configured ? 'Yes' : 'No'}`);
            console.log(`   Total backups: ${recentBackups[0].totalBackups}`);
            if (recentBackups[0].lastBackup) {
                const lastBackup = new Date(recentBackups[0].lastBackup);
                const hoursAgo = Math.floor((Date.now() - lastBackup.getTime()) / (1000 * 60 * 60));
                console.log(`   Last backup: ${hoursAgo}h ago`);
            }
        }
        
        console.log(`\n⏰ Last checks:`);
        console.log(`   Health: ${this.lastHealthCheck ? new Date(this.lastHealthCheck).toLocaleTimeString() : 'Never'}`);
        console.log(`   Backup: ${this.lastBackupCheck ? new Date(this.lastBackupCheck).toLocaleTimeString() : 'Never'}`);
    }

    async runSingleCheck() {
        console.log(`🔍 Running system check at ${new Date().toLocaleString()}`);
        console.log('='.repeat(60));
        
        await this.checkHealth();
        console.log('');
        await this.checkBackupSystem();
        console.log('');
        this.printSummary();
    }

    startMonitoring() {
        if (this.isMonitoring) {
            console.log('⚠️ Monitoring already running');
            return;
        }

        this.isMonitoring = true;
        console.log(`🚀 Starting continuous monitoring (every ${CHECK_INTERVAL / 60000} minutes)`);
        console.log(`📡 Monitoring: ${RENDER_URL}`);
        console.log('Press Ctrl+C to stop\n');

        // Run initial check
        this.runSingleCheck();

        // Set up interval
        this.monitorInterval = setInterval(() => {
            this.runSingleCheck();
        }, CHECK_INTERVAL);
    }

    stopMonitoring() {
        if (this.monitorInterval) {
            clearInterval(this.monitorInterval);
            this.monitorInterval = null;
        }
        this.isMonitoring = false;
        console.log('\n🛑 Monitoring stopped');
    }
}

// CLI Interface
async function main() {
    const monitor = new SystemMonitor();
    const command = process.argv[2];

    switch (command) {
        case 'check':
            await monitor.runSingleCheck();
            break;
        case 'backup':
            await monitor.triggerBackup();
            break;
        case 'monitor':
            monitor.startMonitoring();
            // Handle graceful shutdown
            process.on('SIGINT', () => {
                monitor.stopMonitoring();
                process.exit(0);
            });
            break;
        default:
            console.log('🔧 Gemini Chat System Monitor');
            console.log('Usage:');
            console.log('  node monitor-system.js check    - Run single system check');
            console.log('  node monitor-system.js backup   - Trigger manual backup');
            console.log('  node monitor-system.js monitor  - Start continuous monitoring');
            console.log('');
            console.log('Environment variables:');
            console.log('  RENDER_URL - Your Render app URL (default: https://gemini-chat-cloud.onrender.com)');
    }
}

if (require.main === module) {
    main().catch(console.error);
}

module.exports = SystemMonitor;
