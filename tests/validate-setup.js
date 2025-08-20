#!/usr/bin/env node
/**
 * Setup Validation Script
 * Validates current configuration and identifies what needs to be done
 */

const fs = require('fs');
const path = require('path');

class SetupValidator {
    constructor() {
        this.issues = [];
        this.recommendations = [];
        this.config = {};
    }

    async validate() {
        console.log('🔍 Validating On-Demand System Setup');
        console.log('=====================================\n');

        await this.checkFiles();
        await this.checkGitHubActions();
        await this.checkFrontendIntegration();
        await this.checkBackendIntegration();
        await this.generateReport();
    }

    checkFiles() {
        console.log('📁 Checking Required Files...');
        
        const requiredFiles = [
            { path: 'smart-wake-up.js', description: 'Smart wake-up detection script' },
            { path: 'wake-up.html', description: 'Wake-up landing page' },
            { path: 'test-on-demand-system.js', description: 'Testing script' },
            { path: 'backend/google-drive-backup.js', description: 'Backup service' },
            { path: 'backend/server-cloud.js', description: 'Main server file' },
            { path: '.github/workflows/keep-alive.yml', description: 'GitHub Actions workflow' }
        ];

        requiredFiles.forEach(file => {
            if (fs.existsSync(file.path)) {
                console.log(`✅ ${file.path} - ${file.description}`);
            } else {
                console.log(`❌ ${file.path} - ${file.description}`);
                this.issues.push(`Missing file: ${file.path}`);
            }
        });

        console.log('');
    }

    checkGitHubActions() {
        console.log('🔄 Checking GitHub Actions Configuration...');
        
        const workflowPath = '.github/workflows/keep-alive.yml';
        
        if (!fs.existsSync(workflowPath)) {
            this.issues.push('GitHub Actions workflow file missing');
            return;
        }

        const content = fs.readFileSync(workflowPath, 'utf8');
        
        // Check if constant pinging is disabled
        if (content.includes('*/14 * * * *') && !content.includes('# */14 * * * *')) {
            console.log('⚠️  Constant pinging still enabled');
            this.issues.push('GitHub Actions still has constant pinging enabled');
            this.recommendations.push('Disable the cron schedule in GitHub Actions workflow');
        } else {
            console.log('✅ Constant pinging disabled');
        }

        // Check Render URL
        const urlMatch = content.match(/RENDER_URL="([^"]+)"/);
        if (urlMatch) {
            this.config.renderUrl = urlMatch[1];
            console.log(`✅ Render URL configured: ${this.config.renderUrl}`);
            
            // Check if URL ends with /mobile (which might be incorrect for base URL)
            if (this.config.renderUrl.endsWith('/mobile')) {
                console.log('⚠️  Render URL ends with /mobile - this might be incorrect for the base app');
                this.recommendations.push('Consider if the base URL should be without /mobile suffix');
            }
        } else {
            console.log('❌ Render URL not found');
            this.issues.push('Render URL not configured in GitHub Actions');
        }

        // Check for manual triggers
        if (content.includes('workflow_dispatch')) {
            console.log('✅ Manual triggers enabled');
        } else {
            console.log('⚠️  Manual triggers not found');
            this.recommendations.push('Add workflow_dispatch for manual triggers');
        }

        console.log('');
    }

    checkFrontendIntegration() {
        console.log('🌐 Checking Frontend Integration...');
        
        const frontendFiles = [
            { path: 'index.html', name: 'Desktop' },
            { path: 'mobile.html', name: 'Mobile' }
        ];

        frontendFiles.forEach(file => {
            if (fs.existsSync(file.path)) {
                const content = fs.readFileSync(file.path, 'utf8');
                
                if (content.includes('smart-wake-up.js')) {
                    console.log(`✅ ${file.name} frontend integrated`);
                } else {
                    console.log(`❌ ${file.name} frontend not integrated`);
                    this.issues.push(`${file.name} frontend missing smart-wake-up.js integration`);
                }
            } else {
                console.log(`⚠️  ${file.path} not found`);
            }
        });

        console.log('');
    }

    checkBackendIntegration() {
        console.log('⚙️ Checking Backend Integration...');
        
        const serverPath = 'backend/server-cloud.js';
        
        if (!fs.existsSync(serverPath)) {
            this.issues.push('Main server file not found');
            return;
        }

        const content = fs.readFileSync(serverPath, 'utf8');
        
        // Check for activity tracking
        if (content.includes('recordActivity')) {
            console.log('✅ Activity tracking integrated');
        } else {
            console.log('❌ Activity tracking not integrated');
            this.issues.push('Backend missing activity tracking integration');
        }

        // Check for backup service integration
        if (content.includes('GoogleDriveBackup')) {
            console.log('✅ Backup service integrated');
        } else {
            console.log('❌ Backup service not integrated');
            this.issues.push('Backend missing backup service integration');
        }

        // Check for new API endpoints
        const endpoints = [
            { pattern: '/api/activity/status', name: 'Activity status endpoint' },
            { pattern: '/api/backup/trigger', name: 'Backup trigger endpoint' },
            { pattern: '/api/backup/status', name: 'Backup status endpoint' }
        ];

        endpoints.forEach(endpoint => {
            if (content.includes(endpoint.pattern)) {
                console.log(`✅ ${endpoint.name}`);
            } else {
                console.log(`❌ ${endpoint.name}`);
                this.issues.push(`Missing ${endpoint.name}`);
            }
        });

        console.log('');
    }

    generateReport() {
        console.log('📊 Validation Report');
        console.log('='.repeat(40));
        
        if (this.issues.length === 0) {
            console.log('🎉 All checks passed! Your on-demand system is ready.');
        } else {
            console.log(`❌ Found ${this.issues.length} issue(s):`);
            this.issues.forEach((issue, index) => {
                console.log(`   ${index + 1}. ${issue}`);
            });
        }

        if (this.recommendations.length > 0) {
            console.log(`\n💡 Recommendations:`);
            this.recommendations.forEach((rec, index) => {
                console.log(`   ${index + 1}. ${rec}`);
            });
        }

        console.log('\n🚀 Next Steps:');
        
        if (this.issues.length > 0) {
            console.log('1. Fix the issues listed above');
            console.log('2. Run this validation script again');
            console.log('3. Proceed with deployment when all checks pass');
        } else {
            console.log('1. Run the deployment script: node deploy-on-demand-system.js');
            console.log('2. Test the system: node test-on-demand-system.js');
            console.log('3. Monitor the deployment');
        }

        console.log('\n📚 Available Scripts:');
        console.log('   node validate-setup.js          - Run this validation');
        console.log('   node deploy-on-demand-system.js - Automated deployment');
        console.log('   node test-on-demand-system.js   - Test the system');
        console.log('   node monitor-system.js monitor  - Continuous monitoring');

        return this.issues.length === 0;
    }
}

// Run validation
if (require.main === module) {
    const validator = new SetupValidator();
    validator.validate().then(success => {
        process.exit(success ? 0 : 1);
    }).catch(console.error);
}

module.exports = SetupValidator;
