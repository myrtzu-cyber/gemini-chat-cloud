#!/usr/bin/env node
/**
 * Google Drive Backup Management Script
 * Manage, access, and restore Google Drive backups
 */

const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');

class GoogleDriveBackupManager {
    constructor() {
        this.baseUrl = process.env.RENDER_URL || 'https://gemini-chat-cloud.onrender.com';
        this.localBackupDir = './backups';
        
        // Ensure local backup directory exists
        if (!fs.existsSync(this.localBackupDir)) {
            fs.mkdirSync(this.localBackupDir, { recursive: true });
        }
    }

    async makeRequest(url, options = {}) {
        return new Promise((resolve) => {
            const urlObj = new URL(url);
            const client = urlObj.protocol === 'https:' ? https : http;
            
            const req = client.request(url, {
                method: options.method || 'GET',
                timeout: options.timeout || 60000,
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

            if (options.body) {
                req.write(JSON.stringify(options.body));
            }

            req.end();
        });
    }

    async checkBackupConfiguration() {
        console.log('🔍 Checking Google Drive Backup Configuration');
        console.log('='.repeat(50));

        const health = await this.makeRequest(`${this.baseUrl}/api/health`);
        
        if (health.success) {
            console.log('✅ App is accessible');
            
            if (health.data.backup_configured) {
                console.log('✅ Google Drive backup is configured');
                console.log(`   Service account: ${health.data.backup_service_account || 'Not shown'}`);
                console.log(`   Backup folder: ${health.data.backup_folder_id || 'Auto-created'}`);
            } else {
                console.log('❌ Google Drive backup is NOT configured');
                console.log('\n📋 Configuration Requirements:');
                console.log('   1. GOOGLE_SERVICE_ACCOUNT_EMAIL environment variable');
                console.log('   2. GOOGLE_PRIVATE_KEY environment variable');
                console.log('   3. Google Drive API enabled in Google Cloud Console');
                console.log('   4. Service account with Drive access permissions');
            }
        } else {
            console.log('❌ Cannot access app');
            console.log(`   Error: ${health.error || health.status}`);
        }

        return health.success && health.data.backup_configured;
    }

    async triggerManualBackup() {
        console.log('🔄 Triggering Manual Backup');
        console.log('='.repeat(35));

        const backup = await this.makeRequest(`${this.baseUrl}/api/backup/manual`, {
            method: 'POST'
        });

        if (backup.success) {
            console.log('✅ Manual backup completed successfully');
            console.log(`   Backup ID: ${backup.data.result?.fileId || 'N/A'}`);
            console.log(`   File name: ${backup.data.result?.fileName || 'N/A'}`);
            console.log(`   Size: ${backup.data.result?.size || 'N/A'} bytes`);
            console.log(`   Timestamp: ${backup.data.timestamp}`);
            return backup.data;
        } else {
            console.log('❌ Manual backup failed');
            console.log(`   Error: ${backup.error || backup.data?.message || 'Unknown error'}`);
            return null;
        }
    }

    async getBackupStatus() {
        console.log('📊 Backup System Status');
        console.log('='.repeat(30));

        const status = await this.makeRequest(`${this.baseUrl}/api/backup/status`);

        if (status.success) {
            console.log('✅ Backup system status:');
            console.log(`   Last backup: ${status.data.lastBackupTime ? new Date(status.data.lastBackupTime).toLocaleString() : 'Never'}`);
            console.log(`   Backup in progress: ${status.data.isBackupInProgress ? 'Yes' : 'No'}`);
            console.log(`   Total backups: ${status.data.totalBackups || 0}`);
            console.log(`   Activity tracking: ${status.data.activityTracking ? 'Enabled' : 'Disabled'}`);
            console.log(`   Last activity: ${status.data.lastActivityTime ? new Date(status.data.lastActivityTime).toLocaleString() : 'Never'}`);
            return status.data;
        } else {
            console.log('❌ Failed to get backup status');
            console.log(`   Error: ${status.error || 'Unknown error'}`);
            return null;
        }
    }

    async createLocalBackup() {
        console.log('💾 Creating Local Backup');
        console.log('='.repeat(30));

        const recovery = await this.makeRequest(`${this.baseUrl}/api/database/recovery`);
        
        if (recovery.success) {
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const filename = `local-backup-${timestamp}.json`;
            const filepath = path.join(this.localBackupDir, filename);
            
            const backupData = {
                timestamp: new Date().toISOString(),
                source: 'local_backup',
                database: recovery.data.currentData,
                files: recovery.data.files,
                backupData: recovery.data.backupData
            };
            
            try {
                fs.writeFileSync(filepath, JSON.stringify(backupData, null, 2));
                console.log('✅ Local backup created successfully');
                console.log(`   File: ${filepath}`);
                console.log(`   Size: ${fs.statSync(filepath).size} bytes`);
                return filepath;
            } catch (error) {
                console.log('❌ Failed to create local backup');
                console.log(`   Error: ${error.message}`);
                return null;
            }
        } else {
            console.log('❌ Failed to get database recovery data');
            return null;
        }
    }

    setupGoogleDriveInstructions() {
        console.log('📋 Google Drive Backup Setup Instructions');
        console.log('='.repeat(50));
        
        console.log('\n🔧 Step 1: Create Google Cloud Project');
        console.log('   1. Go to https://console.cloud.google.com/');
        console.log('   2. Create a new project or select existing one');
        console.log('   3. Enable Google Drive API');
        
        console.log('\n🔑 Step 2: Create Service Account');
        console.log('   1. Go to IAM & Admin > Service Accounts');
        console.log('   2. Click "Create Service Account"');
        console.log('   3. Name: "gemini-chat-backup"');
        console.log('   4. Grant "Editor" role (or custom Drive permissions)');
        console.log('   5. Create and download JSON key file');
        
        console.log('\n⚙️ Step 3: Configure Environment Variables');
        console.log('   Add these to your Render environment variables:');
        console.log('   GOOGLE_SERVICE_ACCOUNT_EMAIL=your-service-account@project.iam.gserviceaccount.com');
        console.log('   GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\\n...\\n-----END PRIVATE KEY-----\\n"');
        
        console.log('\n📁 Step 4: Share Drive Folder (Optional)');
        console.log('   1. Create a folder in your Google Drive');
        console.log('   2. Share it with the service account email');
        console.log('   3. Set GOOGLE_DRIVE_FOLDER_ID environment variable');
        
        console.log('\n🧪 Step 5: Test Configuration');
        console.log('   Run: node google-drive-backup-manager.js check');
        console.log('   Run: node google-drive-backup-manager.js backup');
    }
}

// CLI Interface
if (require.main === module) {
    const manager = new GoogleDriveBackupManager();
    const command = process.argv[2];

    switch (command) {
        case 'check':
            manager.checkBackupConfiguration().catch(console.error);
            break;
        case 'backup':
            manager.triggerManualBackup().catch(console.error);
            break;
        case 'status':
            manager.getBackupStatus().catch(console.error);
            break;
        case 'local-backup':
            manager.createLocalBackup().catch(console.error);
            break;
        case 'setup':
            manager.setupGoogleDriveInstructions();
            break;
        default:
            console.log('Google Drive Backup Manager');
            console.log('Usage: node google-drive-backup-manager.js <command>');
            console.log('');
            console.log('Commands:');
            console.log('  check        - Check backup configuration');
            console.log('  backup       - Create manual backup');
            console.log('  status       - Show backup system status');
            console.log('  local-backup - Create local backup');
            console.log('  setup        - Show setup instructions');
    }
}

module.exports = GoogleDriveBackupManager;
