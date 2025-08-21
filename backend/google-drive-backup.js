const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

class GoogleDriveBackup {
    constructor() {
        this.auth = null;
        this.drive = null;
        this.backupFolderId = null;
        this.lastBackupTime = null;
        this.backupInterval = 60 * 60 * 1000; // 1 hour in milliseconds
        this.isBackupInProgress = false;
        this.backupHistory = [];
        this.maxHourlyBackups = 24;
        this.maxDailyBackups = 7;

        // Activity tracking for on-demand model
        this.lastActivityTime = Date.now();
        this.activityThreshold = 30 * 60 * 1000; // 30 minutes
        this.requestCount = 0;
        this.lastRequestTime = Date.now();

        this.initializeAuth();
        this.startBackupScheduler();
    }

    initializeAuth() {
        try {
            // Service Account authentication (recommended for production)
            if (process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL && process.env.GOOGLE_PRIVATE_KEY) {
                console.log('🗄️ Google Drive backup service initialized');
                
                // Clean and format the private key properly
                let privateKey = process.env.GOOGLE_PRIVATE_KEY;
                
                // Handle different private key formats
                if (privateKey.includes('\\n')) {
                    privateKey = privateKey.replace(/\\n/g, '\n');
                }
                
                // Ensure proper BEGIN/END format
                if (!privateKey.includes('-----BEGIN PRIVATE KEY-----')) {
                    throw new Error('Invalid private key format - missing BEGIN marker');
                }
                
                if (!privateKey.includes('-----END PRIVATE KEY-----')) {
                    throw new Error('Invalid private key format - missing END marker');
                }
                
                // Remove any extra quotes or whitespace
                privateKey = privateKey.trim();
                if (privateKey.startsWith('"') && privateKey.endsWith('"')) {
                    privateKey = privateKey.slice(1, -1);
                }
                
                this.auth = new google.auth.GoogleAuth({
                    credentials: {
                        client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
                        private_key: privateKey,
                    },
                    scopes: [
                        'https://www.googleapis.com/auth/drive.file',
                        'https://www.googleapis.com/auth/drive.metadata'
                    ],
                });
                
                this.drive = google.drive({ version: 'v3', auth: this.auth });
                console.log('✅ Google Drive API initialized with Service Account');
                
                // Initialize backup folder
                this.initializeBackupFolder();
            } else {
                console.log('⚠️ Google Drive backup not configured (missing environment variables)');
                console.log('   Required: GOOGLE_SERVICE_ACCOUNT_EMAIL, GOOGLE_PRIVATE_KEY');
            }
        } catch (error) {
            console.error('❌ Error initializing backup folder:', error.message);
            console.error('   This is usually caused by:');
            console.error('   1. Incorrectly formatted GOOGLE_PRIVATE_KEY environment variable');
            console.error('   2. Missing or invalid service account credentials');
            console.error('   3. Private key not properly escaped in environment variables');
            console.error('   💡 Tip: Ensure private key includes proper \\n line breaks');
        }
    }

    async initializeBackupFolder() {
        if (!this.drive) return;

        try {
            const customFolderId = process.env.GOOGLE_DRIVE_FOLDER_ID;

            if (customFolderId) {
                console.log(`📁 Using custom backup folder ID from environment: ${customFolderId}`);
                // Verify access to the custom folder
                try {
                    const folder = await this.drive.files.get({
                        fileId: customFolderId,
                        fields: 'id, name, mimeType'
                    });

                    if (folder.data.mimeType !== 'application/vnd.google-apps.folder') {
                        console.error(`❌ The provided ID (${customFolderId}) is not a folder.`);
                        this.backupFolderId = null;
                        return;
                    }

                    this.backupFolderId = folder.data.id;
                    console.log(`✅ Successfully verified access to folder: "${folder.data.name}"`);
                } catch (error) {
                    console.error(`❌ Error accessing custom folder ID (${customFolderId}):`, error.message);
                    console.error('   Please ensure the service account has "Editor" permissions on this folder.');
                    this.backupFolderId = null;
                    return;
                }
            } else {
                // Fallback to default behavior
                const folderName = `Gemini-Chat-Backups-${process.env.NODE_ENV || 'production'}`;
                
                const response = await this.drive.files.list({
                    q: `name='${folderName}' and mimeType='application/vnd.google-apps.folder' and 'root' in parents`,
                    fields: 'files(id, name)'
                });

                if (response.data.files.length > 0) {
                    this.backupFolderId = response.data.files[0].id;
                    console.log(`📁 Using existing backup folder: ${folderName} (${this.backupFolderId})`);
                } else {
                    console.log(`📁 Backup folder "${folderName}" not found. Creating it...`);
                    const folderResponse = await this.drive.files.create({
                        resource: {
                            name: folderName,
                            mimeType: 'application/vnd.google-apps.folder'
                        },
                        fields: 'id'
                    });
                    
                    this.backupFolderId = folderResponse.data.id;
                    console.log(`📁 Created backup folder: ${folderName} (${this.backupFolderId})`);
                }
            }

            // Share folder with user email if specified
            await this.shareFolderWithUser();
            
        } catch (error) {
            console.error('❌ Error initializing backup folder:', error.message);
        }
    }

    async shareFolderWithUser() {
        if (!this.backupFolderId || !process.env.USER_EMAIL_FOR_SHARING) {
            return;
        }

        try {
            console.log(`🔗 Sharing backup folder with: ${process.env.USER_EMAIL_FOR_SHARING}`);
            
            // Check if already shared
            const permissions = await this.drive.permissions.list({
                fileId: this.backupFolderId,
                fields: 'permissions(id, emailAddress, role)'
            });

            const existingPermission = permissions.data.permissions.find(
                p => p.emailAddress === process.env.USER_EMAIL_FOR_SHARING
            );

            if (existingPermission) {
                console.log(`✅ Folder already shared with ${process.env.USER_EMAIL_FOR_SHARING}`);
                return;
            }

            // Share folder with viewer permissions
            await this.drive.permissions.create({
                fileId: this.backupFolderId,
                resource: {
                    role: 'reader', // 'reader' for view-only, 'writer' for edit access
                    type: 'user',
                    emailAddress: process.env.USER_EMAIL_FOR_SHARING
                },
                sendNotificationEmail: true,
                emailMessage: 'Você agora tem acesso aos backups automáticos do Gemini Chat. Esta pasta contém backups regulares dos seus dados de conversas.'
            });

            console.log(`✅ Successfully shared backup folder with ${process.env.USER_EMAIL_FOR_SHARING}`);
            
        } catch (error) {
            console.error('❌ Error sharing folder with user:', error.message);
            console.error('   Make sure the email address is valid and the service account has sharing permissions');
        }
    }

    startBackupScheduler() {
        if (!this.drive) {
            console.log('⚠️ Backup scheduler not started (Google Drive not configured)');
            return;
        }

        console.log('⏰ Starting on-demand backup scheduler');

        // For on-demand model: only backup during active periods
        // Check for backup need every hour, but only when app is active
        setInterval(async () => {
            if (this.isAppActive()) {
                console.log('📱 App is active - checking if backup is needed');
                await this.performScheduledBackup();
            } else {
                console.log('😴 App appears inactive - skipping backup check');
            }
        }, this.backupInterval);

        // Run initial backup after app has been active for 10 minutes
        setTimeout(async () => {
            if (this.isAppActive()) {
                console.log('🚀 Running initial backup after startup activity...');
                await this.performScheduledBackup();
            }
        }, 10 * 60 * 1000);
    }

    async performScheduledBackup(database = null) {
        if (!this.drive) {
            return { status: 'skipped', reason: 'Google Drive not configured' };
        }

        if (this.isBackupInProgress) {
            console.log('⏳ Backup already in progress, skipping...');
            return { status: 'skipped', reason: 'Backup already in progress' };
        }

        // Check if enough time has passed since last backup
        const now = Date.now();
        if (this.lastBackupTime && (now - this.lastBackupTime) < (55 * 60 * 1000)) {
            console.log('⏳ Too soon for next backup, skipping...');
            return { status: 'skipped', reason: 'Too soon for next backup' };
        }

        try {
            this.isBackupInProgress = true;
            console.log('🗄️ Starting scheduled database backup...');

            // If no database provided, try to get global db instance
            if (!database) {
                // This will be set by the server when calling this method
                console.log('⚠️ No database instance provided for backup');
                return { status: 'error', reason: 'No database instance available' };
            }

            const result = await this.createDatabaseBackup(database);
            this.lastBackupTime = now;
            
            // Add to backup history
            this.backupHistory.unshift({
                timestamp: new Date().toISOString(),
                status: result.status,
                fileId: result.fileId,
                fileName: result.fileName,
                size: result.size
            });

            // Keep only last 50 history entries
            if (this.backupHistory.length > 50) {
                this.backupHistory = this.backupHistory.slice(0, 50);
            }

            // Clean up old backups
            await this.cleanupOldBackups();

            console.log('✅ Scheduled backup completed successfully');
            return result;

        } catch (error) {
            console.error('❌ Scheduled backup failed:', error.message);
            
            // Add error to history
            this.backupHistory.unshift({
                timestamp: new Date().toISOString(),
                status: 'error',
                error: error.message
            });

            return { status: 'error', error: error.message };
        } finally {
            this.isBackupInProgress = false;
        }
    }

    async createDatabaseBackup(database) {
        if (!this.drive || !this.backupFolderId) {
            throw new Error('Google Drive not properly configured');
        }

        try {
            console.log('📊 Exporting database data...');
            
            // Get all data from database
            const chats = await database.getAllChats();
            const allMessages = [];

            // Collect all messages from all chats
            for (const chat of chats) {
                try {
                    let chatMessages = [];
                    
                    // Try different methods to get messages based on database type
                    if (typeof database.getChatMessages === 'function') {
                        chatMessages = await database.getChatMessages(chat.id);
                    } else if (typeof database.getChatWithMessages === 'function') {
                        const chatWithMessages = await database.getChatWithMessages(chat.id);
                        chatMessages = chatWithMessages?.messages || [];
                    } else if (database.messages) {
                        // SimpleDatabase fallback
                        chatMessages = database.messages.filter(m => m.chat_id === chat.id);
                    }
                    
                    allMessages.push(...chatMessages);
                } catch (error) {
                    console.warn(`⚠️ Error getting messages for chat ${chat.id}:`, error.message);
                }
            }

            // Create backup data structure
            const backupData = {
                export_info: {
                    timestamp: new Date().toISOString(),
                    source: 'google-drive-auto-backup',
                    total_chats: chats.length,
                    total_messages: allMessages.length,
                    database_type: database.constructor.name,
                    backup_version: '2.0'
                },
                chats: chats,
                messages: allMessages
            };

            // Create filename with timestamp
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const fileName = `gemini-chat-backup-${timestamp}.json`;

            console.log(`💾 Creating backup file: ${fileName}`);
            console.log(`   Chats: ${chats.length}, Messages: ${allMessages.length}`);

            // Convert to JSON string
            const jsonData = JSON.stringify(backupData, null, 2);
            const fileSize = Buffer.byteLength(jsonData, 'utf8');

            // Upload to Google Drive
            const response = await this.drive.files.create({
                resource: {
                    name: fileName,
                    parents: [this.backupFolderId],
                    description: `Automatic backup of Gemini Chat database - ${new Date().toISOString()}`
                },
                media: {
                    mimeType: 'application/json',
                    body: jsonData
                },
                fields: 'id, name, size, createdTime'
            });

            console.log(`✅ Backup uploaded to Google Drive: ${response.data.name}`);
            console.log(`   File ID: ${response.data.id}`);
            console.log(`   Size: ${Math.round(fileSize / 1024)} KB`);

            return {
                status: 'success',
                fileName: response.data.name,
                fileId: response.data.id,
                size: fileSize,
                chatsCount: chats.length,
                messagesCount: allMessages.length,
                uploadedAt: response.data.createdTime
            };

        } catch (error) {
            console.error('❌ Error creating database backup:', error.message);
            throw error;
        }
    }

    async cleanupOldBackups() {
        if (!this.drive || !this.backupFolderId) return;

        try {
            console.log('🧹 Cleaning up old backups...');

            // Get all backup files in the folder
            const response = await this.drive.files.list({
                q: `'${this.backupFolderId}' in parents and name contains 'gemini-chat-backup'`,
                fields: 'files(id, name, createdTime, size)',
                orderBy: 'createdTime desc'
            });

            const backupFiles = response.data.files || [];
            console.log(`📁 Found ${backupFiles.length} backup files`);

            if (backupFiles.length === 0) return;

            // Separate files by type (hourly vs daily)
            const now = new Date();
            const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

            // Keep last 24 hourly backups
            const hourlyBackups = backupFiles.slice(0, this.maxHourlyBackups);

            // For daily backups, keep one per day for the last 7 days
            const dailyBackups = [];
            const dailyBackupDates = new Set();

            for (const file of backupFiles) {
                const fileDate = new Date(file.createdTime);
                const dateKey = fileDate.toISOString().split('T')[0]; // YYYY-MM-DD

                if (fileDate >= oneWeekAgo && !dailyBackupDates.has(dateKey) && dailyBackups.length < this.maxDailyBackups) {
                    dailyBackups.push(file);
                    dailyBackupDates.add(dateKey);
                }
            }

            // Combine files to keep
            const filesToKeep = new Set();
            hourlyBackups.forEach(file => filesToKeep.add(file.id));
            dailyBackups.forEach(file => filesToKeep.add(file.id));

            // Delete old files
            const filesToDelete = backupFiles.filter(file => !filesToKeep.has(file.id));

            if (filesToDelete.length > 0) {
                console.log(`🗑️ Deleting ${filesToDelete.length} old backup files...`);

                for (const file of filesToDelete) {
                    try {
                        await this.drive.files.delete({ fileId: file.id });
                        console.log(`   Deleted: ${file.name}`);
                    } catch (error) {
                        console.warn(`⚠️ Failed to delete ${file.name}:`, error.message);
                    }
                }
            } else {
                console.log('✅ No old backups to delete');
            }

            console.log(`📊 Backup retention summary:`);
            console.log(`   Hourly backups kept: ${hourlyBackups.length}/${this.maxHourlyBackups}`);
            console.log(`   Daily backups kept: ${dailyBackups.length}/${this.maxDailyBackups}`);
            console.log(`   Total files kept: ${filesToKeep.size}`);

        } catch (error) {
            console.error('❌ Error cleaning up old backups:', error.message);
        }
    }

    async getBackupStatus() {
        const status = {
            configured: !!this.drive,
            lastBackupTime: this.lastBackupTime,
            isBackupInProgress: this.isBackupInProgress,
            backupInterval: this.backupInterval,
            nextBackupIn: null,
            recentBackups: this.backupHistory.slice(0, 10),
            statistics: {
                totalBackups: this.backupHistory.length,
                successfulBackups: this.backupHistory.filter(b => b.status === 'success').length,
                failedBackups: this.backupHistory.filter(b => b.status === 'error').length
            }
        };

        if (this.lastBackupTime) {
            const nextBackup = this.lastBackupTime + this.backupInterval;
            const now = Date.now();
            status.nextBackupIn = Math.max(0, nextBackup - now);
            status.nextBackupAt = new Date(nextBackup).toISOString();
        }

        // Get folder info if available
        if (this.drive && this.backupFolderId) {
            try {
                const folderResponse = await this.drive.files.get({
                    fileId: this.backupFolderId,
                    fields: 'name, createdTime'
                });

                const filesResponse = await this.drive.files.list({
                    q: `'${this.backupFolderId}' in parents`,
                    fields: 'files(id, name, size, createdTime)'
                });

                status.driveInfo = {
                    folderName: folderResponse.data.name,
                    folderCreated: folderResponse.data.createdTime,
                    totalFiles: filesResponse.data.files.length,
                    totalSize: filesResponse.data.files.reduce((sum, file) => sum + parseInt(file.size || 0), 0)
                };
            } catch (error) {
                console.warn('⚠️ Could not get Drive folder info:', error.message);
            }
        }

        return status;
    }

    // Manual backup trigger
    async triggerManualBackup(database) {
        console.log('🔧 Manual backup triggered');
        return await this.createDatabaseBackup(database);
    }

    // Test Google Drive connection
    async testConnection() {
        if (!this.drive) {
            return { success: false, error: 'Google Drive not configured' };
        }

        try {
            const response = await this.drive.files.list({
                pageSize: 1,
                fields: 'files(id, name)'
            });

            return {
                success: true,
                message: 'Google Drive connection successful',
                canAccess: true
            };
        } catch (error) {
            return {
                success: false,
                error: error.message,
                canAccess: false
            };
        }
    }

    // Activity tracking methods for on-demand model
    recordActivity() {
        this.lastActivityTime = Date.now();
        this.requestCount++;
        this.lastRequestTime = Date.now();

        // Log activity periodically
        if (this.requestCount % 10 === 0) {
            console.log(`📊 Activity recorded: ${this.requestCount} requests, last activity: ${new Date(this.lastActivityTime).toLocaleTimeString()}`);
        }
    }

    isAppActive() {
        const now = Date.now();
        const timeSinceLastActivity = now - this.lastActivityTime;
        const isActive = timeSinceLastActivity < this.activityThreshold;

        if (!isActive) {
            console.log(`😴 App inactive for ${Math.round(timeSinceLastActivity / 60000)} minutes`);
        }

        return isActive;
    }

    getActivityStats() {
        const now = Date.now();
        return {
            lastActivityTime: this.lastActivityTime,
            timeSinceLastActivity: now - this.lastActivityTime,
            isActive: this.isAppActive(),
            requestCount: this.requestCount,
            lastRequestTime: this.lastRequestTime,
            activityThreshold: this.activityThreshold
        };
    }

    // Enhanced backup trigger that considers activity
    async performActivityBasedBackup(database) {
        if (!this.isAppActive()) {
            console.log('⏰ Skipping backup - app is not active');
            return { status: 'skipped', reason: 'App not active' };
        }

        console.log('📱 App is active - proceeding with backup');
        return await this.performScheduledBackup(database);
    }
}

module.exports = GoogleDriveBackup;
