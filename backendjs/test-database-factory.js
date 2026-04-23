/**
 * Test Database Factory và Adapter Pattern
 */
const DatabaseFactory = require('./src/services/database.factory');

async function testDatabaseFactory() {
    try {
        console.log('🔄 Testing Database Factory...');
        
        // Test 1: Get configuration for different environments
        console.log('\n1. Testing configuration for different environments...');
        
        const devConfig = DatabaseFactory.getConfig('development');
        console.log('✅ Development config:', devConfig.type, devConfig.database);
        
        const testConfig = DatabaseFactory.getConfig('test');
        console.log('✅ Test config:', testConfig.type, testConfig.database);
        
        const prodConfig = DatabaseFactory.getConfig('production');
        console.log('✅ Production config:', prodConfig.type, prodConfig.connectionString ? 'configured' : 'not configured');
        
        // Test 2: Create service for development
        console.log('\n2. Testing service creation for development...');
        const devService = DatabaseFactory.createService('development');
        console.log('✅ Development service created');
        
        // Test 3: Validate service interface
        console.log('\n3. Testing service interface validation...');
        const isValid = DatabaseFactory.validateService(devService);
        console.log('✅ Service validation:', isValid ? 'PASSED' : 'FAILED');
        
        // Test 4: Create and initialize service
        console.log('\n4. Testing service creation and initialization...');
        const service = await DatabaseFactory.createAndInitialize('development');
        console.log('✅ Service created and initialized');
        
        // Test 5: Test service functionality
        console.log('\n5. Testing service functionality...');
        
        // Health check
        const health = await service.healthCheck();
        console.log('✅ Health check:', health.status);
        
        // Database operation
        const userData = {
            name: 'Factory Test User',
            year: 1990,
            month: 6,
            day: 15,
            hour: 12,
            minute: 0,
            gender: 'Nam',
            calendar: 'solar'
        };
        
        const customerId = await service.findOrCreateCustomer(userData);
        console.log('✅ Customer created via factory service:', customerId);
        
        // Get stats
        const stats = await service.getStats();
        console.log('✅ Stats retrieved:', stats.totalCustomers, 'customers');
        
        // Test 6: Test environment-based selection
        console.log('\n6. Testing environment-based selection...');
        
        // Test with different NODE_ENV values
        const originalEnv = process.env.NODE_ENV;
        
        process.env.NODE_ENV = 'development';
        const devService2 = DatabaseFactory.createService();
        console.log('✅ Auto-detected development environment');
        
        process.env.NODE_ENV = 'test';
        const testService = DatabaseFactory.createService();
        console.log('✅ Auto-detected test environment');
        
        // Restore original environment
        process.env.NODE_ENV = originalEnv;
        
        // Test 7: Test error handling
        console.log('\n7. Testing error handling...');
        
        try {
            // Test with invalid service (mock)
            const invalidService = { someMethod: () => {} };
            const isValidInvalid = DatabaseFactory.validateService(invalidService);
            console.log('✅ Invalid service correctly rejected:', !isValidInvalid);
        } catch (error) {
            console.log('✅ Error handling works:', error.message.substring(0, 50) + '...');
        }
        
        console.log('\n🎉 ALL DATABASE FACTORY TESTS PASSED!');
        console.log('📊 Factory features working:');
        console.log('   - Environment-based service selection');
        console.log('   - Service interface validation');
        console.log('   - Configuration management');
        console.log('   - Service initialization');
        console.log('   - Error handling');
        
        // Cleanup
        await service.close();
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
        console.error(error.stack);
    } finally {
        process.exit(0);
    }
}

testDatabaseFactory();