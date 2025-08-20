# On-Demand Wake-up & Backup System Deployment Guide

This guide covers the implementation of a resource-efficient on-demand system that only wakes up your Render application when users actually visit it, while maintaining automated backup capabilities during active periods.

## 🎯 System Overview

### What Changed from Constant Ping Model
- ❌ **Removed**: Constant 14-minute pings that kept the app always awake
- ✅ **Added**: On-demand wake-up when users visit the application
- ✅ **Added**: Activity-based backup system that only runs during active periods
- ✅ **Added**: Smart wake-up detection and loading screens for better UX

### Benefits of On-Demand Model
- 💰 **Cost Efficient**: Only uses resources when actually needed
- 🌱 **Environmentally Friendly**: Reduces unnecessary server usage
- 📊 **Better Analytics**: Clear distinction between active and inactive periods
- 🔋 **Resource Optimization**: Backup system only runs during usage

## 📋 Prerequisites

### Required Components
- Render application deployed and accessible
- Google Cloud Project with Drive API enabled (for backups)
- GitHub repository with Actions enabled
- Domain/URL where your app is hosted

### API Key Management (Current Setup)
Based on your codebase analysis:
- **Gemini API Keys**: Stored in browser localStorage (client-side only)
  - `gemini_api_key1`, `gemini_api_key2`, `gemini_api_key3`
  - No server-side API key storage required
- **Google Drive**: Server-side environment variables for backup service
- **Database**: `DATABASE_URL` environment variable in Render

## 🔧 Step 1: Configure Google Drive Backup (Optional but Recommended)

### 1.1 Create Google Cloud Project
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project: `gemini-chat-backup`
3. Enable Google Drive API:
   - Navigate to "APIs & Services" > "Library"
   - Search for "Google Drive API" and enable it

### 1.2 Create Service Account
1. Go to "APIs & Services" > "Credentials"
2. Click "Create Credentials" > "Service Account"
3. Service account details:
   - **Name**: `gemini-chat-backup-service`
   - **Description**: `Automated backup service for Gemini Chat`
4. Skip role assignment and click "Done"

### 1.3 Generate Service Account Key
1. Click on the created service account
2. Go to "Keys" tab > "Add Key" > "Create new key"
3. Select "JSON" format and download
4. **Keep this file secure** - it contains your credentials

### 1.4 Extract Credentials
From the downloaded JSON file, you need:
```json
{
  "client_email": "your-service-account@project.iam.gserviceaccount.com",
  "private_key": "-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
}
```

## 🔧 Step 2: Update Render Environment Variables

### 2.1 Required Environment Variables
In your Render dashboard, add these environment variables:

```bash
# Database (already configured)
DATABASE_URL=postgresql://...

# Google Drive Backup (optional)
GOOGLE_SERVICE_ACCOUNT_EMAIL=your-service-account@your-project.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYour private key here\n-----END PRIVATE KEY-----"

# Environment
NODE_ENV=production
```

### 2.2 Important Notes
- The `GOOGLE_PRIVATE_KEY` must include `\n` for line breaks
- Keep quotes around the private key
- If you skip Google Drive setup, the app will work without backups

## 🔧 Step 3: Update GitHub Actions

### 3.1 Modify Workflow File
The workflow in `.github/workflows/keep-alive.yml` has been updated to:
- **Disable automatic scheduling** (no more 14-minute pings)
- **Enable manual triggers** for testing
- **Trigger on repository activity** (pushes, PRs)

### 3.2 Update Your App URL
Edit `.github/workflows/keep-alive.yml` line 33:
```yaml
RENDER_URL="https://your-actual-app-name.onrender.com"
```

### 3.3 Workflow Behavior
- **No automatic pings**: App will sleep when not in use
- **Manual triggers**: You can manually wake the app via GitHub Actions
- **Development triggers**: App wakes up when you push code changes

## 🔧 Step 4: Integrate Smart Wake-up in Your Frontend

### 4.1 Add Smart Wake-up Script
Include the smart wake-up script in your main HTML files:

```html
<!-- Add before closing </body> tag -->
<script src="/smart-wake-up.js"></script>
```

### 4.2 Configure Wake-up Behavior
The script automatically:
- Detects when the server is sleeping
- Shows a loading overlay during wake-up
- Handles wake-up process transparently
- Redirects to wake-up page if needed

### 4.3 Customize Wake-up Options (Optional)
```javascript
// Custom configuration
window.smartWakeUp = new SmartWakeUp({
    timeout: 15000,           // 15 second timeout
    retryAttempts: 3,         // 3 retry attempts
    showLoadingOverlay: true, // Show loading screen
    autoRedirect: true        // Auto-redirect to wake-up page
});
```

## 🔧 Step 5: Deploy and Test

### 5.1 Deploy to Render
1. Push your changes to GitHub
2. Render will automatically redeploy
3. Monitor deployment logs for:
   - ✅ Server startup
   - ✅ Google Drive backup initialization (if configured)
   - ✅ Activity tracking setup

### 5.2 Test the System
```bash
# Test on-demand wake-up behavior
node test-on-demand-system.js

# Test specific components
node test-on-demand-system.js wake-up
node test-on-demand-system.js backup
node test-on-demand-system.js sleep

# Test production deployment
node test-on-demand-system.js prod
```

## 📊 Step 6: Monitor System Behavior

### 6.1 Available Monitoring Endpoints
```bash
# Enhanced health check with uptime info
GET /api/health

# Activity tracking status
GET /api/activity/status

# Backup system status
GET /api/backup/status

# Manual backup trigger
POST /api/backup/manual

# Activity-based backup trigger
GET /api/backup/trigger
```

### 6.2 Expected Behavior
- **First Visit**: 15-30 second wake-up time with loading screen
- **Active Period**: Normal response times (< 2 seconds)
- **Backup Frequency**: Only during active usage periods
- **Sleep Time**: App sleeps after 15 minutes of inactivity

### 6.3 User Experience Flow
1. **User visits sleeping app** → Loading screen appears
2. **Smart wake-up detects sleep** → Multiple wake-up requests sent
3. **Server starts responding** → Loading screen shows progress
4. **App fully awake** → User redirected to main application
5. **During usage** → Normal performance, backups may trigger
6. **After 15 min inactivity** → App goes back to sleep

## 🔧 Step 7: Testing Wake-up Scenarios

### 7.1 Test Sleeping App
1. Wait 15+ minutes without visiting the app
2. Visit your app URL
3. Should see wake-up loading screen
4. App should become responsive within 30 seconds

### 7.2 Test Activity Tracking
```bash
# Check current activity status
curl https://your-app.onrender.com/api/activity/status

# Make some requests to simulate activity
curl https://your-app.onrender.com/api/health
curl https://your-app.onrender.com/api/stats

# Check activity status again
curl https://your-app.onrender.com/api/activity/status
```

### 7.3 Test Backup System
```bash
# Check backup status
curl https://your-app.onrender.com/api/backup/status

# Trigger manual backup (only works when app is active)
curl -X POST https://your-app.onrender.com/api/backup/manual
```

## 💰 Cost Analysis

### Resource Usage Comparison
| Aspect | Constant Ping Model | On-Demand Model |
|--------|-------------------|-----------------|
| GitHub Actions | ~60 min/month | ~5 min/month |
| Render Uptime | 100% | Usage-based |
| Google Drive API | Constant usage | Activity-based |
| Server Resources | Always consuming | Only when needed |

### Expected Savings
- **GitHub Actions**: 90% reduction in usage
- **Render Resources**: 70-90% reduction (depends on usage patterns)
- **Environmental Impact**: Significant reduction in unnecessary resource consumption

## 🚨 Troubleshooting

### Common Issues

#### 1. App Takes Too Long to Wake Up
- **Cause**: Cold start on Render free tier
- **Solution**: Normal behavior, loading screen handles UX
- **Improvement**: Consider upgrading to paid Render plan

#### 2. Backup Not Working
- **Check**: Google Drive environment variables
- **Verify**: Service account permissions
- **Test**: Manual backup endpoint

#### 3. Smart Wake-up Not Triggering
- **Check**: Script is included in HTML
- **Verify**: No JavaScript errors in console
- **Test**: Manual wake-up check

#### 4. Activity Tracking Issues
- **Check**: Server logs for activity recording
- **Verify**: API requests are being made
- **Test**: Activity status endpoint

### Debug Commands
```bash
# Check server status
curl https://your-app.onrender.com/api/health

# Check activity tracking
curl https://your-app.onrender.com/api/activity/status

# Check backup system
curl https://your-app.onrender.com/api/backup/status

# Test wake-up page
curl https://your-app.onrender.com/wake-up.html
```

## 🎯 Success Criteria

Your on-demand system is working correctly when:
- ✅ App sleeps after 15 minutes of inactivity
- ✅ Users see loading screen when visiting sleeping app
- ✅ App wakes up within 30 seconds of first visit
- ✅ Activity tracking records user interactions
- ✅ Backups only trigger during active periods
- ✅ No constant GitHub Actions usage
- ✅ Good user experience during wake-up process

## 🔄 Maintenance

### Regular Checks
- Monitor Render logs for any wake-up issues
- Check Google Drive storage usage (if backups enabled)
- Verify GitHub Actions are not running constantly
- Test wake-up experience periodically

### Updates
- Keep dependencies updated in package.json
- Monitor Render platform changes
- Update wake-up timeouts if Render changes sleep behavior

This on-demand system provides a much more resource-efficient approach while maintaining excellent user experience and data protection through activity-based backups.
