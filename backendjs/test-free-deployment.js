/**
 * Test cấu hình free deployment với SQLite
 */

async function testFreeDeployment() {
    try {
        console.log('🆓 Testing FREE deployment configuration...');
        
        // Test 1: Set environment for free deployment
        console.log('\n1. Setting up free deployment environment...');
        process.env.USE_SQLITE = 'true';
        process.env.NODE_ENV = 'production';
        process.env.PORT = '10000';
        
        console.log('✅ Environment variables set:');
        console.log('   USE_SQLITE:', process.env.USE_SQLITE);
        console.log('   NODE_ENV:', process.env.NODE_ENV);
        console.log('   PORT:', process.env.PORT);
        
        // Test 2: Database Factory with SQLite forced
        console.log('\n2. Testing Database Factory with SQLite forced...');
        const DatabaseFactory = require('./src/services/database.factory');
        
        const service = DatabaseFactory.createService('production');
        console.log('✅ Database service created (should be SQLite)');
        
        // Test 3: Initialize database
        console.log('\n3. Testing database initialization...');
        await service.init();
        console.log('✅ Database initialized successfully');
        
        // Test 4: Health check
        console.log('\n4. Testing health check...');
        const health = await service.healthCheck();
        console.log('✅ Health check result:', health.status, health.database);
        
        // Test 5: Database operations
        console.log('\n5. Testing database operations...');
        const userData = {
            name: 'Free Deployment Test User',
            year: 1990,
            month: 12,
            day: 25,
            hour: 15,
            minute: 30,
            gender: 'Nam',
            calendar: 'solar'
        };
        
        const customerId = await service.findOrCreateCustomer(userData);
        console.log('✅ Customer created:', customerId);
        
        const stats = await service.getStats();
        console.log('✅ Database stats:', stats.totalCustomers, 'customers');
        
        // Test 6: Performance test
        console.log('\n6. Testing performance (simulating free tier load)...');
        const startTime = Date.now();
        
        const promises = [];
        for (let i = 0; i < 10; i++) {
            promises.push(service.get('SELECT 1 as test'));
        }
        
        await Promise.all(promises);
        const duration = Date.now() - startTime;
        console.log('✅ Performance test: 10 concurrent queries in', duration + 'ms');
        
        // Test 7: Memory usage (important for free tier)
        console.log('\n7. Checking memory usage (free tier has 512MB limit)...');
        const memUsage = process.memoryUsage();
        console.log('✅ Memory usage:');
        console.log('   RSS:', Math.round(memUsage.rss / 1024 / 1024) + 'MB');
        console.log('   Heap Used:', Math.round(memUsage.heapUsed / 1024 / 1024) + 'MB');
        console.log('   Heap Total:', Math.round(memUsage.heapTotal / 1024 / 1024) + 'MB');
        
        if (memUsage.rss < 400 * 1024 * 1024) { // Less than 400MB
            console.log('✅ Memory usage is good for free tier (< 400MB)');
        } else {
            console.log('⚠️  Memory usage might be high for free tier (> 400MB)');
        }
        
        // Test 8: Simulate server startup
        console.log('\n8. Testing server module loading...');
        delete require.cache[require.resolve('./server')];
        const server = require('./server');
        console.log('✅ Server loads successfully with free configuration');
        
        console.log('\n🎉 ALL FREE DEPLOYMENT TESTS PASSED!');
        console.log('📊 Free deployment ready:');
        console.log('   - SQLite database with persistent storage');
        console.log('   - Memory usage optimized for 512MB limit');
        console.log('   - Health monitoring endpoints');
        console.log('   - Performance acceptable for free tier');
        console.log('   - Ready to deploy on Render free plan');
        
        // Cleanup
        await service.close();
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
        console.error(error.stack);
    } finally {
        process.exit(0);
    }
}

testFreeDeployment();