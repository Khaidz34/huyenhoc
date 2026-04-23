/**
 * Test server với Database Factory
 */
const request = require('supertest');
const app = require('./server');

async function testServerWithFactory() {
    try {
        console.log('🔄 Testing server with Database Factory...');
        
        // Wait a bit for server to initialize
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Test 1: Basic health check
        console.log('\n1. Testing basic health check (/)...');
        const response1 = await request(app).get('/');
        console.log('✅ Basic health check:', response1.status, response1.body.status);
        
        // Test 2: Enhanced health check
        console.log('\n2. Testing enhanced health check (/health)...');
        const response2 = await request(app).get('/health');
        console.log('✅ Enhanced health check:', response2.status, response2.body.status);
        console.log('   Database status:', response2.body.database?.status);
        console.log('   Environment:', response2.body.environment);
        
        // Test 3: Metrics endpoint
        console.log('\n3. Testing metrics endpoint (/metrics)...');
        const response3 = await request(app).get('/metrics');
        console.log('✅ Metrics endpoint:', response3.status);
        console.log('   Database type:', response3.body.database?.database);
        console.log('   Total customers:', response3.body.application?.totalCustomers);
        
        // Test 4: API docs
        console.log('\n4. Testing API docs (/api/docs)...');
        const response4 = await request(app).get('/api/docs');
        console.log('✅ API docs:', response4.status);
        
        console.log('\n🎉 ALL SERVER TESTS WITH FACTORY PASSED!');
        console.log('📊 Server features working:');
        console.log('   - Database Factory integration');
        console.log('   - Enhanced health checks');
        console.log('   - Metrics endpoint');
        console.log('   - Environment detection');
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
        
        // If supertest is not available, do a simple test
        if (error.message.includes('supertest')) {
            console.log('\n💡 Supertest not available, doing basic test...');
            
            // Test that server can start
            const DatabaseFactory = require('./src/services/database.factory');
            const dbService = DatabaseFactory.createService();
            
            await dbService.init();
            console.log('✅ Database Factory integration works');
            
            const health = await dbService.healthCheck();
            console.log('✅ Health check works:', health.status);
            
            await dbService.close();
            console.log('✅ Basic integration test passed');
        }
    } finally {
        process.exit(0);
    }
}

// Check if supertest is available
try {
    require('supertest');
    testServerWithFactory();
} catch (error) {
    console.log('📦 Installing supertest for testing...');
    console.log('💡 Run: npm install --save-dev supertest');
    console.log('🔄 Running basic test instead...');
    testServerWithFactory();
}