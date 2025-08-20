#!/usr/bin/env node
/**
 * Check Debug Endpoint
 * Calls the debug endpoint to see database status
 */

const https = require('https');

const SERVER_URL = 'https://gemini-chat-cloud.onrender.com';

function makeRequest(url) {
    return new Promise((resolve, reject) => {
        const req = https.request(url, { rejectUnauthorized: false }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const jsonData = JSON.parse(data);
                    resolve({ status: res.statusCode, data: jsonData });
                } catch (error) {
                    resolve({ status: res.statusCode, data: data });
                }
            });
        });

        req.on('error', reject);
        req.end();
    });
}

async function checkDebugEndpoint() {
    console.log('🔍 Checking Debug Endpoint');
    console.log(`📍 Server: ${SERVER_URL}/api/debug/database`);
    console.log('');

    try {
        const response = await makeRequest(`${SERVER_URL}/api/debug/database`);
        
        if (response.status === 200) {
            console.log('✅ Debug endpoint responded successfully');
            console.log('');
            console.log('📊 DATABASE DEBUG INFO:');
            console.log('');
            
            const debug = response.data;
            
            if (debug.database_info) {
                const info = debug.database_info;
                console.log(`🔧 Database Type: ${info.type}`);
                console.log(`📊 Server Type: ${info.server_type}`);
                console.log(`🐘 PostgreSQL Available: ${info.postgres_available}`);
                console.log(`❌ PostgreSQL Import Error: ${info.postgres_import_error || 'None'}`);
                console.log(`🔗 DATABASE_URL Configured: ${info.database_url_configured}`);
                console.log(`📏 DATABASE_URL Length: ${info.database_url_length} characters`);
                console.log('');
                
                console.log('🔧 Required Methods Available:');
                Object.entries(info.required_methods_available).forEach(([method, available]) => {
                    console.log(`   ${available ? '✅' : '❌'} ${method}: ${available}`);
                });
                console.log('');
            }
            
            if (debug.stats) {
                console.log('📈 Database Stats:');
                console.log(`   Total chats: ${debug.stats.total_chats}`);
                console.log(`   Total messages: ${debug.stats.total_messages}`);
                console.log(`   Server type: ${debug.stats.server_type}`);
                console.log(`   Database URL configured: ${debug.stats.database_url_configured}`);
                if (debug.stats.fallback_reason) {
                    console.log(`   Fallback reason: ${debug.stats.fallback_reason}`);
                }
                console.log('');
            }
            
            // Analysis
            console.log('🔍 ANALYSIS:');
            
            if (debug.database_info) {
                const info = debug.database_info;
                
                if (info.type === 'PostgresDatabase') {
                    console.log('✅ SUCCESS: PostgreSQL database is being used!');
                } else if (info.type === 'SimpleDatabase') {
                    console.log('⚠️ ISSUE: Still using SimpleDatabase fallback');
                    
                    if (!info.postgres_available) {
                        console.log('❌ PostgreSQL not available');
                        if (info.postgres_import_error) {
                            console.log(`   Import error: ${info.postgres_import_error}`);
                        }
                    } else if (!info.database_url_configured) {
                        console.log('❌ DATABASE_URL not configured');
                    } else {
                        console.log('❓ PostgreSQL available but not being used - check initialization');
                    }
                }
            }
            
        } else {
            console.log(`❌ Debug endpoint failed: HTTP ${response.status}`);
            console.log(`Response: ${JSON.stringify(response.data)}`);
        }
        
    } catch (error) {
        console.error('❌ Error checking debug endpoint:', error.message);
    }
}

if (require.main === module) {
    checkDebugEndpoint();
}

module.exports = { checkDebugEndpoint };
