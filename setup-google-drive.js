#!/usr/bin/env node
/**
 * Google Drive Setup Automation Script
 * Helps configure Google Drive backup system
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');

class GoogleDriveSetup {
    constructor() {
        this.rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });
    }

    async setup() {
        console.log('🗄️ Google Drive Backup Setup');
        console.log('============================\n');
        
        console.log('This script will help you set up automated backups to Google Drive.');
        console.log('You can skip this step if you don\'t want automated backups.\n');

        const wantBackups = await this.askQuestion('Do you want to set up Google Drive backups? (y/n): ');
        
        if (wantBackups.toLowerCase() !== 'y') {
            console.log('⏭️  Skipping Google Drive setup. You can run this script later if needed.');
            this.rl.close();
            return;
        }

        await this.guideSetup();
        this.rl.close();
    }

    async guideSetup() {
        console.log('\n📋 Google Drive Setup Steps:');
        console.log('1. Create Google Cloud Project');
        console.log('2. Enable Google Drive API');
        console.log('3. Create Service Account');
        console.log('4. Download credentials');
        console.log('5. Configure environment variables\n');

        // Step 1: Google Cloud Project
        console.log('🔧 Step 1: Google Cloud Project');
        console.log('1. Go to https://console.cloud.google.com/');
        console.log('2. Create a new project or select existing one');
        console.log('3. Note your project ID\n');

        const projectId = await this.askQuestion('Enter your Google Cloud Project ID: ');

        // Step 2: Enable API
        console.log('\n🔧 Step 2: Enable Google Drive API');
        console.log('1. In Google Cloud Console, go to "APIs & Services" > "Library"');
        console.log('2. Search for "Google Drive API"');
        console.log('3. Click "Enable"\n');

        await this.askQuestion('Press Enter when you\'ve enabled the Google Drive API...');

        // Step 3: Service Account
        console.log('\n🔧 Step 3: Create Service Account');
        console.log('1. Go to "APIs & Services" > "Credentials"');
        console.log('2. Click "Create Credentials" > "Service Account"');
        console.log('3. Enter details:');
        console.log('   - Name: gemini-chat-backup');
        console.log('   - Description: Automated backup service for Gemini Chat');
        console.log('4. Skip role assignment and click "Done"\n');

        const serviceAccountEmail = await this.askQuestion('Enter the service account email (ends with @project.iam.gserviceaccount.com): ');

        // Step 4: Download Key
        console.log('\n🔧 Step 4: Download Service Account Key');
        console.log('1. Click on the service account you just created');
        console.log('2. Go to "Keys" tab');
        console.log('3. Click "Add Key" > "Create new key"');
        console.log('4. Select "JSON" format');
        console.log('5. Download the file (keep it secure!)\n');

        const keyFilePath = await this.askQuestion('Enter the path to your downloaded JSON key file: ');

        // Validate and extract credentials
        try {
            const credentials = await this.extractCredentials(keyFilePath);
            await this.generateEnvConfig(credentials);
            await this.generateRenderInstructions(credentials);
        } catch (error) {
            console.error('❌ Error processing credentials:', error.message);
            console.log('\n💡 Please check the file path and try again.');
        }
    }

    async extractCredentials(keyFilePath) {
        if (!fs.existsSync(keyFilePath)) {
            throw new Error('Key file not found');
        }

        const keyContent = fs.readFileSync(keyFilePath, 'utf8');
        const credentials = JSON.parse(keyContent);

        if (!credentials.client_email || !credentials.private_key) {
            throw new Error('Invalid credentials file - missing required fields');
        }

        console.log('\n✅ Credentials extracted successfully');
        console.log(`   Service Account: ${credentials.client_email}`);
        console.log(`   Project ID: ${credentials.project_id}`);

        return credentials;
    }

    async generateEnvConfig(credentials) {
        console.log('\n📝 Generating Environment Configuration...');

        const envConfig = `# Google Drive Backup Configuration
GOOGLE_SERVICE_ACCOUNT_EMAIL=${credentials.client_email}
GOOGLE_PRIVATE_KEY="${credentials.private_key.replace(/\n/g, '\\n')}"

# Optional: Set environment
NODE_ENV=production
`;

        fs.writeFileSync('.env.google-drive', envConfig);
        console.log('✅ Created .env.google-drive file with your configuration');
        console.log('⚠️  Keep this file secure and do not commit it to version control!');
    }

    async generateRenderInstructions(credentials) {
        console.log('\n🚀 Render Environment Variables Setup');
        console.log('=====================================');
        console.log('Add these environment variables to your Render dashboard:\n');

        console.log('1. GOOGLE_SERVICE_ACCOUNT_EMAIL');
        console.log(`   Value: ${credentials.client_email}\n`);

        console.log('2. GOOGLE_PRIVATE_KEY');
        console.log('   Value: (copy the entire private key including quotes)');
        console.log(`   "${credentials.private_key.replace(/\n/g, '\\n')}"\n`);

        console.log('📋 Steps to add to Render:');
        console.log('1. Go to your Render dashboard');
        console.log('2. Select your service');
        console.log('3. Go to "Environment" tab');
        console.log('4. Click "Add Environment Variable"');
        console.log('5. Add both variables above');
        console.log('6. Deploy your service\n');

        // Create a script to test the configuration
        const testScript = `#!/usr/bin/env node
// Test Google Drive Configuration
const { google } = require('googleapis');

async function testGoogleDrive() {
    try {
        const auth = new google.auth.GoogleAuth({
            credentials: {
                client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
                private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\\\n/g, '\\n'),
            },
            scopes: ['https://www.googleapis.com/auth/drive.file'],
        });

        const drive = google.drive({ version: 'v3', auth });
        
        const response = await drive.files.list({
            pageSize: 1,
            fields: 'files(id, name)'
        });

        console.log('✅ Google Drive connection successful!');
        console.log('   API access verified');
        return true;
    } catch (error) {
        console.error('❌ Google Drive connection failed:', error.message);
        return false;
    }
}

if (require.main === module) {
    testGoogleDrive().then(success => {
        process.exit(success ? 0 : 1);
    });
}

module.exports = testGoogleDrive;
`;

        fs.writeFileSync('test-google-drive.js', testScript);
        console.log('✅ Created test-google-drive.js to verify your configuration');

        console.log('\n🧪 Testing Configuration:');
        console.log('After setting up environment variables in Render, you can test with:');
        console.log('   node test-google-drive.js');
    }

    askQuestion(question) {
        return new Promise((resolve) => {
            this.rl.question(question, (answer) => {
                resolve(answer.trim());
            });
        });
    }
}

// Run setup
if (require.main === module) {
    const setup = new GoogleDriveSetup();
    setup.setup().catch(console.error);
}

module.exports = GoogleDriveSetup;
