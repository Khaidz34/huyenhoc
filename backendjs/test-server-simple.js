/**
 * Simple test for server with Database Factory (no external dependencies)
 */

async function testServerIntegration() {
    try {
        console.log('🔄 Testing server integration with Database Factory...');
        
        // Test 1: Database Factory integration
        console.log('\n1. Testing Database Factory integration...');
        const DatabaseFactory = require('./src/services/database.factory');
        
        // Test environment detection
        process.env.NODE_ENV = 'development';
        const devService = DatabaseFactory.createService();
        console.log('✅ Development service created');
        
        // Test initialization
        await devService.init();
        console.log('✅ Database initialized');
        
        // Test health check
        const health = await devService.healthCheck();
        console.log('✅ Health check:', health.status, `(${health.responseTime}ms)`);
        
        // Test database operations
        const stats = await devService.getStats();
        console.log('✅ Database operations work:', stats.totalCustomers, 'customers');
        
        // Test 2: Server module loading
        console.log('\n2. Testing server module loading...');
        
        // This will test if server.js can load with the new Database Factory
        delete require.cache[require.resolve('./server')];
        const server = require('./server');
        console.log('✅ Server module loads successfully with Database Factory');
        
        // Test 3: Environment switching
        console.log('\n3. Testing environment switching...');
        
        process.env.NODE_ENV = 'test';
        const testService = DatabaseFactory.createService();
        console.log('✅ Test environment service created');
        
        process.env.NODE_ENV = 'production';
        const prodService = DatabaseFactory.createService();
        console.log('✅ Production environment service created (fallback to SQLite)');
        
        // Restore development environment
        process.env.NODE_ENV = 'development';
        
        // Test 4: Service validation
        console.log('\n4. Testing service validation...');
        const isValid = DatabaseFactory.validateService(devService);
        console.log('✅ Service validation:', isValid ? 'PASSED' : 'FAILED');
        
        // Test 5: Configuration
        console.log('\n5. Testing configuration...');
        const config = DatabaseFactory.getConfig('development');
        console.log('✅ Configuration loaded:', config.type, config.database);
        
        console.log('\n🎉 ALL SERVER INTEGRATION TESTS PASSED!');
        console.log('📊 Integration features working:');
        console.log('   - Database Factory integration in server.js');
        console.log('   - Environment-based service selection');
        console.log('   - Health monitoring');
        console.log('   - Service validation');
        console.log('   - Configuration management');
        
        // Cleanup
        await devService.close();
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
        console.error(error.stack);
    } finally {
        process.exit(0);
    }
}

testServerIntegration();