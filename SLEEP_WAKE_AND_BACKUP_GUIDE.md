# 🛌 Sleep/Wake Testing & 🗄️ Google Drive Backup Guide

## 📋 **Question 1: Force Sleep Testing**

### **🎯 Overview**
Test database persistence through Render's automatic sleep/wake cycles to ensure data survives app hibernation.

### **⏰ How Render Sleep Works**
- **Automatic Sleep**: Apps sleep after **15 minutes** of inactivity (no HTTP requests)
- **Wake-up Trigger**: Any HTTP request wakes the app (takes 10-30 seconds)
- **Data Risk**: In-memory data can be lost during sleep if not properly persisted

### **🧪 Testing Methods**

#### **Method 1: Automated Sleep/Wake Testing (Recommended)**
```bash
# Step 1: Create test data and prepare for sleep
node test-sleep-wake-cycle.js pre-sleep

# Step 2: Monitor sleep/wake cycle in real-time
node test-sleep-wake-cycle.js monitor

# Step 3: After wake-up, verify data persistence
node test-sleep-wake-cycle.js post-sleep
```

#### **Method 2: Manual Sleep Testing**
```bash
# 1. Create test data
node test-sleep-wake-cycle.js pre-sleep

# 2. Wait 15+ minutes without accessing the app
# 3. Check app status
node test-sleep-wake-cycle.js status

# 4. Verify data after wake-up
node test-sleep-wake-cycle.js post-sleep
```

#### **Method 3: Force Sleep via Inactivity**
1. **Stop all traffic** to your Render app for 15+ minutes
2. **Monitor status** using health check endpoint
3. **Trigger wake-up** by visiting the app URL
4. **Verify data persistence** using recovery endpoints

### **🔍 Monitoring Endpoints**

#### **Health Check**
```bash
curl https://your-app.onrender.com/api/health
```

#### **Database Recovery Status**
```bash
curl https://your-app.onrender.com/api/database/recovery
```

#### **Activity Status**
```bash
curl https://your-app.onrender.com/api/activity/status
```

### **🛠️ Recovery Tools**

#### **Force Database Reload**
```bash
curl -X POST https://your-app.onrender.com/api/database/reload
```

#### **Check Recovery System**
```bash
node test-sleep-wake-cycle.js recovery
```

### **✅ What to Verify**
- [ ] Test chat conversations persist through sleep
- [ ] Context data survives wake-up
- [ ] Auto-save mechanism (5-min intervals) works
- [ ] Backup files are created and accessible
- [ ] Recovery system can restore from backup

---

## 📋 **Question 2: Google Drive Backup Access**

### **🎯 Overview**
Access, manage, and restore data from the Google Drive backup system integrated into your Gemini Chat application.

### **🔧 Setup Google Drive Backup**

#### **Step 1: Google Cloud Console Setup**
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create new project or select existing one
3. Enable **Google Drive API**
4. Go to **IAM & Admin > Service Accounts**
5. Create service account: `gemini-chat-backup`
6. Download JSON key file

#### **Step 2: Configure Environment Variables**
Add to your Render environment variables:
```bash
GOOGLE_SERVICE_ACCOUNT_EMAIL=your-service-account@project.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
```

#### **Step 3: Optional - Shared Folder**
1. Create folder in your Google Drive
2. Share with service account email
3. Add folder ID to environment:
```bash
GOOGLE_DRIVE_FOLDER_ID=your-folder-id
```

### **🛠️ Backup Management Commands**

#### **Check Configuration**
```bash
node google-drive-backup-manager.js check
```

#### **Create Manual Backup**
```bash
node google-drive-backup-manager.js backup
```

#### **Check Backup Status**
```bash
node google-drive-backup-manager.js status
```

#### **Create Local Backup**
```bash
node google-drive-backup-manager.js local-backup
```

#### **Setup Instructions**
```bash
node google-drive-backup-manager.js setup
```

### **📂 Accessing Backup Files**

#### **Via Google Drive Web Interface**
1. Go to [Google Drive](https://drive.google.com/)
2. Look for folder: `Gemini Chat Backups` (or your custom folder)
3. Files are named: `gemini-chat-backup-YYYY-MM-DD-HH-MM-SS.json`

#### **Via API Endpoints**
```bash
# List all backups
curl https://your-app.onrender.com/api/backup/list

# Download specific backup
curl https://your-app.onrender.com/api/backup/download/BACKUP_ID

# Restore from backup
curl -X POST https://your-app.onrender.com/api/backup/restore \
  -H "Content-Type: application/json" \
  -d '{"backupId": "BACKUP_ID"}'
```

### **📄 Backup File Format**
```json
{
  "timestamp": "2025-08-20T12:00:00.000Z",
  "source": "automatic_backup",
  "database": {
    "chats": [...],
    "messages": [...],
    "context": {...}
  },
  "metadata": {
    "totalChats": 10,
    "totalMessages": 150,
    "appVersion": "1.0.0"
  }
}
```

### **🔄 Backup Schedule**
- **Automatic**: Every hour when app is active
- **Activity-based**: Only when there's user activity
- **Manual**: On-demand via API or script
- **Sleep-based**: Before app goes to sleep (if activity detected)

### **🚨 Troubleshooting**

#### **Backup Not Working**
1. Check environment variables are set correctly
2. Verify service account has Drive permissions
3. Check Google Drive API is enabled
4. Review app logs for authentication errors

#### **Cannot Access Backups**
1. Verify service account email has access to Drive folder
2. Check if backup folder exists and is accessible
3. Ensure GOOGLE_DRIVE_FOLDER_ID is correct (if using custom folder)

#### **Restore Failed**
1. Verify backup file integrity
2. Check database write permissions
3. Ensure app has sufficient memory for restore operation

### **📊 Monitoring Backup Health**
```bash
# Check backup system status
curl https://your-app.onrender.com/api/backup/status

# View backup history
curl https://your-app.onrender.com/api/backup/history

# Test backup configuration
node google-drive-backup-manager.js check
```

---

## 🎯 **Quick Testing Checklist**

### **Sleep/Wake Testing**
- [ ] Run pre-sleep test to create data
- [ ] Monitor app for sleep detection
- [ ] Verify wake-up functionality
- [ ] Check data persistence after wake-up
- [ ] Test recovery system if data is lost

### **Backup System Testing**
- [ ] Verify Google Drive configuration
- [ ] Create manual backup
- [ ] Check backup appears in Google Drive
- [ ] Test backup download
- [ ] Test backup restoration
- [ ] Verify automatic backup schedule

### **Integration Testing**
- [ ] Test backup creation before sleep
- [ ] Verify backup restoration after wake-up
- [ ] Check activity-based backup triggers
- [ ] Test recovery from backup during data loss

---

## 📞 **Support Commands**

```bash
# Complete sleep/wake test
node test-sleep-wake-cycle.js monitor

# Check all systems
node test-new-features.js

# Backup management
node google-drive-backup-manager.js status

# Database recovery
curl https://your-app.onrender.com/api/database/recovery
```
