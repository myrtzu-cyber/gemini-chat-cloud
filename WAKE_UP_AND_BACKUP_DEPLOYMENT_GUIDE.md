# Wake-up System & Google Drive Backup Deployment Guide

This guide covers the implementation of two critical features for your Render-hosted application:
1. **Automatic Wake-up System** - Prevents Render free tier from sleeping
2. **Automated Google Drive Backup** - Hourly database backups to Google Drive

## 🚀 Quick Setup Overview

### 1. Wake-up System
- ✅ GitHub Actions workflow pings app every 14 minutes
- ✅ Enhanced health check endpoint with monitoring
- ✅ Automatic wake-up attempts for sleeping apps

### 2. Backup System
- ✅ Hourly automated backups to Google Drive
- ✅ Retention policy: 24 hourly + 7 daily backups
- ✅ Automatic cleanup of old backups
- ✅ Manual backup triggers via API

## 📋 Prerequisites

### For Wake-up System
- GitHub repository with Actions enabled
- Render app deployed and accessible

### For Google Drive Backup
- Google Cloud Project with Drive API enabled
- Service Account with Google Drive access
- Environment variables configured in Render

## 🔧 Step 1: Configure Google Drive API

### 1.1 Create Google Cloud Project
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing one
3. Enable the Google Drive API:
   - Go to "APIs & Services" > "Library"
   - Search for "Google Drive API"
   - Click "Enable"

### 1.2 Create Service Account
1. Go to "APIs & Services" > "Credentials"
2. Click "Create Credentials" > "Service Account"
3. Fill in service account details:
   - Name: `gemini-chat-backup`
   - Description: `Service account for automated database backups`
4. Click "Create and Continue"
5. Skip role assignment (click "Continue")
6. Click "Done"

### 1.3 Generate Service Account Key
1. Click on the created service account
2. Go to "Keys" tab
3. Click "Add Key" > "Create new key"
4. Select "JSON" format
5. Download the key file (keep it secure!)

### 1.4 Extract Credentials
From the downloaded JSON file, you need:
- `client_email` (for GOOGLE_SERVICE_ACCOUNT_EMAIL)
- `private_key` (for GOOGLE_PRIVATE_KEY)

## 🔧 Step 2: Configure Render Environment Variables

### 2.1 Required Environment Variables
In your Render dashboard, add these environment variables:

```bash
# Database (already configured)
DATABASE_URL=postgresql://...

# Google Drive Backup
GOOGLE_SERVICE_ACCOUNT_EMAIL=your-service-account@your-project.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYour private key here\n-----END PRIVATE KEY-----"

# Environment
NODE_ENV=production
```

### 2.2 Important Notes
- The `GOOGLE_PRIVATE_KEY` must include the full key with `\n` for line breaks
- Keep the quotes around the private key
- The service account email should match exactly from your JSON file

## 🔧 Step 3: Update GitHub Actions

### 3.1 Update Workflow File
The workflow file `.github/workflows/keep-alive.yml` is already created. Update the URL:

```yaml
# Line 18 - Update with your actual Render URL
RENDER_URL="https://your-app-name.onrender.com"
```

### 3.2 Enable GitHub Actions
1. Go to your GitHub repository
2. Click "Actions" tab
3. Enable workflows if prompted
4. The workflow will start running automatically

## 🔧 Step 4: Deploy to Render

### 4.1 Update Dependencies
The required dependencies are already in `package.json`:
- `googleapis` - For Google Drive API
- `pg` - For PostgreSQL connection

### 4.2 Deploy
1. Push your changes to GitHub
2. Render will automatically redeploy
3. Check the deployment logs for:
   - ✅ Google Drive API initialization
   - ✅ Backup service startup
   - ✅ Database connection

## 📊 Step 5: Verify Setup

### 5.1 Test Wake-up System
```bash
# Check if app responds
curl https://your-app.onrender.com/api/health

# Should return enhanced health info with uptime
```

### 5.2 Test Backup System
```bash
# Check backup status
curl https://your-app.onrender.com/api/backup/status

# Trigger manual backup
curl -X POST https://your-app.onrender.com/api/backup/manual

# Check backup trigger (used by GitHub Actions)
curl https://your-app.onrender.com/api/backup/trigger
```

### 5.3 Monitor GitHub Actions
1. Go to GitHub repository > Actions
2. Check if "Keep Render App Alive" workflow is running
3. Verify it runs every 14 minutes
4. Check logs for successful pings

## 📈 Monitoring & Maintenance

### Health Check Endpoints
- `GET /api/health` - Enhanced health check with uptime
- `GET /api/backup/status` - Backup system status
- `GET /api/backup/trigger` - Trigger backup check
- `POST /api/backup/manual` - Manual backup

### Expected Behavior
- **Wake-up**: App pinged every 14 minutes by GitHub Actions
- **Backup**: Automatic backup every hour when app is active
- **Retention**: Keeps 24 hourly + 7 daily backups
- **Cleanup**: Old backups automatically deleted

### Troubleshooting

#### Wake-up Issues
- Check GitHub Actions logs
- Verify Render URL in workflow
- Ensure app health endpoint responds

#### Backup Issues
- Check Render logs for Google Drive errors
- Verify environment variables are set correctly
- Test Google Drive API connection manually

#### Common Error Messages
```bash
# Google Drive not configured
"Google Drive backup service not configured"

# Authentication failed
"Error initializing Google Drive API"

# Backup in progress
"Backup already in progress, skipping..."
```

## 🔒 Security Best Practices

1. **Service Account Permissions**: Only grant necessary Drive permissions
2. **Environment Variables**: Never commit credentials to code
3. **Key Rotation**: Regularly rotate service account keys
4. **Access Monitoring**: Monitor Google Cloud audit logs

## 💰 Cost Considerations

### Free Tier Limits
- **Render**: 750 hours/month (wake-up system keeps within limits)
- **Google Drive**: 15GB free storage
- **GitHub Actions**: 2000 minutes/month (wake-up uses ~60 minutes/month)

### Storage Management
- Backup retention automatically manages storage
- Average backup size: ~1-10MB depending on data
- Monthly storage: ~720MB (24 hourly × 30 days)

## 🎯 Next Steps

1. ✅ Deploy the updated code to Render
2. ✅ Configure Google Drive API credentials
3. ✅ Set up environment variables in Render
4. ✅ Update GitHub Actions workflow URL
5. ✅ Test both systems end-to-end
6. ✅ Monitor for 24 hours to ensure stability

## 📞 Support

If you encounter issues:
1. Check Render deployment logs
2. Verify GitHub Actions execution
3. Test API endpoints manually
4. Review Google Cloud audit logs
5. Check environment variable configuration

The system is designed to be resilient and will gracefully handle failures while maintaining your app's availability and data safety.
