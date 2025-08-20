#!/usr/bin/env node
/**
 * Google Drive Configuration Validator
 * Helps diagnose and fix Google Drive backup configuration issues
 */

require('dotenv').config();
const { google } = require('googleapis');

class GoogleDriveConfigValidator {
    constructor() {
        this.requiredEnvVars = [
            'GOOGLE_SERVICE_ACCOUNT_EMAIL',
            'GOOGLE_PRIVATE_KEY'
        ];
    }

    validateEnvironmentVariables() {
        console.log('🔍 Validating Environment Variables');
        console.log('='.repeat(40));

        const missing = [];
        const present = [];

        for (const envVar of this.requiredEnvVars) {
            if (process.env[envVar]) {
                present.push(envVar);
                console.log(`✅ ${envVar}: Present`);
            } else {
                missing.push(envVar);
                console.log(`❌ ${envVar}: Missing`);
            }
        }

        if (missing.length > 0) {
            console.log('\n🚨 Missing Required Environment Variables:');
            missing.forEach(envVar => {
                console.log(`   - ${envVar}`);
            });
            return false;
        }

        console.log('\n✅ All required environment variables are present');
        return true;
    }

    validatePrivateKeyFormat() {
        console.log('\n🔑 Validating Private Key Format');
        console.log('='.repeat(35));

        const privateKey = process.env.GOOGLE_PRIVATE_KEY;
        if (!privateKey) {
            console.log('❌ GOOGLE_PRIVATE_KEY not found');
            return false;
        }

        // Check basic format
        const hasBeginMarker = privateKey.includes('-----BEGIN PRIVATE KEY-----');
        const hasEndMarker = privateKey.includes('-----END PRIVATE KEY-----');
        const hasNewlines = privateKey.includes('\\n') || privateKey.includes('\n');

        console.log(`   Begin marker: ${hasBeginMarker ? '✅' : '❌'}`);
        console.log(`   End marker: ${hasEndMarker ? '✅' : '❌'}`);
        console.log(`   Has newlines: ${hasNewlines ? '✅' : '❌'}`);
        console.log(`   Length: ${privateKey.length} characters`);

        if (!hasBeginMarker || !hasEndMarker) {
            console.log('\n❌ Invalid private key format');
            console.log('   Private key must include BEGIN and END markers');
            return false;
        }

        // Test key processing
        try {
            let processedKey = privateKey;
            
            if (processedKey.includes('\\n')) {
                processedKey = processedKey.replace(/\\n/g, '\n');
            }
            
            processedKey = processedKey.trim();
            if (processedKey.startsWith('"') && processedKey.endsWith('"')) {
                processedKey = processedKey.slice(1, -1);
            }

            console.log('\n✅ Private key format appears valid');
            console.log(`   Processed length: ${processedKey.length} characters`);
            return true;

        } catch (error) {
            console.log('\n❌ Error processing private key:', error.message);
            return false;
        }
    }

    async testGoogleDriveConnection() {
        console.log('\n🌐 Testing Google Drive Connection');
        console.log('='.repeat(35));

        try {
            // Process private key
            let privateKey = process.env.GOOGLE_PRIVATE_KEY;
            
            if (privateKey.includes('\\n')) {
                privateKey = privateKey.replace(/\\n/g, '\n');
            }
            
            privateKey = privateKey.trim();
            if (privateKey.startsWith('"') && privateKey.endsWith('"')) {
                privateKey = privateKey.slice(1, -1);
            }

            const auth = new google.auth.GoogleAuth({
                credentials: {
                    client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
                    private_key: privateKey,
                },
                scopes: [
                    'https://www.googleapis.com/auth/drive.file',
                    'https://www.googleapis.com/auth/drive.metadata'
                ],
            });

            const drive = google.drive({ version: 'v3', auth });

            // Test basic connection
            console.log('   Testing basic connection...');
            const response = await drive.files.list({
                pageSize: 1,
                fields: 'files(id, name)'
            });

            console.log('✅ Google Drive connection successful!');
            console.log(`   Can access Drive API: Yes`);
            console.log(`   Service account: ${process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL}`);

            // Test folder creation capability
            console.log('\n   Testing folder creation capability...');
            const testFolderName = `Test-Folder-${Date.now()}`;
            
            try {
                const folderResponse = await drive.files.create({
                    resource: {
                        name: testFolderName,
                        mimeType: 'application/vnd.google-apps.folder'
                    },
                    fields: 'id, name'
                });

                console.log('✅ Folder creation test successful');
                console.log(`   Test folder ID: ${folderResponse.data.id}`);

                // Clean up test folder
                await drive.files.delete({ fileId: folderResponse.data.id });
                console.log('✅ Test folder cleaned up');

            } catch (folderError) {
                console.log('⚠️ Folder creation test failed:', folderError.message);
                console.log('   This might indicate insufficient permissions');
            }

            return true;

        } catch (error) {
            console.log('❌ Google Drive connection failed');
            console.log(`   Error: ${error.message}`);
            
            if (error.message.includes('DECODER routines::unsupported')) {
                console.log('\n💡 This error typically means:');
                console.log('   1. Private key format is incorrect');
                console.log('   2. Newlines in private key are not properly escaped');
                console.log('   3. Private key contains extra quotes or characters');
                console.log('\n🔧 Try these fixes:');
                console.log('   1. Ensure private key has \\n instead of actual newlines');
                console.log('   2. Remove any surrounding quotes from the private key');
                console.log('   3. Copy private key directly from the JSON file');
            }

            return false;
        }
    }

    generateFixInstructions() {
        console.log('\n🔧 Configuration Fix Instructions');
        console.log('='.repeat(40));
        
        console.log('\n📋 Step 1: Check Environment Variables');
        console.log('   Ensure these are set in your deployment environment:');
        console.log('   - GOOGLE_SERVICE_ACCOUNT_EMAIL');
        console.log('   - GOOGLE_PRIVATE_KEY');
        
        console.log('\n🔑 Step 2: Fix Private Key Format');
        console.log('   The private key should be formatted as:');
        console.log('   "-----BEGIN PRIVATE KEY-----\\nMIIE...\\n-----END PRIVATE KEY-----\\n"');
        console.log('   ');
        console.log('   Common fixes:');
        console.log('   1. Replace actual newlines with \\n');
        console.log('   2. Remove surrounding quotes if present');
        console.log('   3. Ensure no extra spaces or characters');
        
        console.log('\n🌐 Step 3: Verify Service Account Permissions');
        console.log('   1. Go to Google Cloud Console');
        console.log('   2. Navigate to IAM & Admin > Service Accounts');
        console.log('   3. Ensure your service account has Drive access');
        console.log('   4. Consider granting "Editor" role for full access');
        
        console.log('\n🧪 Step 4: Test Configuration');
        console.log('   Run: node validate-google-drive-config.js');
        console.log('   All tests should pass before deploying');
    }

    async runAllTests() {
        console.log('🚀 Google Drive Configuration Validator');
        console.log('='.repeat(50));
        
        const envValid = this.validateEnvironmentVariables();
        if (!envValid) {
            this.generateFixInstructions();
            return false;
        }

        const keyValid = this.validatePrivateKeyFormat();
        if (!keyValid) {
            this.generateFixInstructions();
            return false;
        }

        const connectionValid = await this.testGoogleDriveConnection();
        if (!connectionValid) {
            this.generateFixInstructions();
            return false;
        }

        console.log('\n🎉 All Tests Passed!');
        console.log('✅ Google Drive backup is properly configured');
        console.log('✅ Ready for production deployment');
        
        return true;
    }
}

// CLI Interface
if (require.main === module) {
    const validator = new GoogleDriveConfigValidator();
    
    validator.runAllTests()
        .then(success => {
            process.exit(success ? 0 : 1);
        })
        .catch(error => {
            console.error('❌ Validation failed:', error.message);
            process.exit(1);
        });
}

module.exports = GoogleDriveConfigValidator;
