/**
 * Keep-Alive Endpoint para Render.com
 * Endpoint especial para ser chamado por serviços externos
 */

function setupKeepAlive(app) {
    // Endpoint público para keep-alive
    app.get('/keep-alive', (req, res) => {
        const timestamp = new Date().toISOString();
        const uptime = process.uptime();
        const memoryUsage = process.memoryUsage();
        
        console.log(`🏓 Keep-alive ping recebido em ${timestamp}`);
        
        res.json({
            status: 'alive',
            timestamp,
            uptime: Math.floor(uptime),
            memory: {
                used: Math.round(memoryUsage.heapUsed / 1024 / 1024) + 'MB',
                total: Math.round(memoryUsage.heapTotal / 1024 / 1024) + 'MB'
            },
            message: 'Servidor acordado e funcionando!'
        });
    });

    // Endpoint para status detalhado
    app.get('/api/status', (req, res) => {
        const timestamp = new Date().toISOString();
        const uptime = process.uptime();
        
        res.json({
            status: 'ok',
            timestamp,
            uptime: {
                seconds: Math.floor(uptime),
                minutes: Math.floor(uptime / 60),
                hours: Math.floor(uptime / 3600)
            },
            environment: process.env.NODE_ENV || 'development',
            version: require('./package.json').version,
            database: 'connected' // Assumindo que chegou até aqui
        });
    });

    console.log('✅ Keep-alive endpoints configurados:');
    console.log('   GET /keep-alive - Ping simples');
    console.log('   GET /api/status - Status detalhado');
}

module.exports = { setupKeepAlive };
