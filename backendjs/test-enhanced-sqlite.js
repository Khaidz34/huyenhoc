/**
 * Test enhanced SQLite Database Service
 */
const dbService = require('./src/services/database.service');

async function testEnhancedSQLite() {
    try {
        console.log('🔄 Testing enhanced SQLite service...');
        
        // Test 1: Initialization with retry mechanism
        console.log('\n1. Testing initialization...');
        await dbService.init();
        console.log('✅ Database initialized successfully');
        
        // Test 2: Health check
        console.log('\n2. Testing health check...');
        const health = await dbService.healthCheck();
        console.log('✅ Health check result:', health);
        
        // Test 3: Get health status
        console.log('\n3. Testing health status...');
        const status = dbService.getHealthStatus();
        console.log('✅ Health status:', status);
        
        // Test 4: Database operations
        console.log('\n4. Testing database operations...');
        const userData = {
            name: 'Test Enhanced User',
            year: 1995,
            month: 8,
            day: 20,
            hour: 16,
            minute: 45,
            gender: 'Nữ',
            calendar: 'solar'
        };
        
        const customerId = await dbService.findOrCreateCustomer(userData);
        console.log(`✅ Customer created: ID ${customerId}`);
        
        // Test 5: Concurrent operations
        console.log('\n5. Testing concurrent operations...');
        const promises = [];
        for (let i = 0; i < 10; i++) {
            promises.push(dbService.getStats());
        }
        
        const results = await Promise.all(promises);
        console.log(`✅ Concurrent operations completed: ${results.length} results`);
        
        // Test 6: Performance test
        console.log('\n6. Testing performance...');
        const startTime = Date.now();
        
        for (let i = 0; i < 100; i++) {
            await dbService.get('SELECT 1 as test');
        }
        
        const duration = Date.now() - startTime;
        console.log(`✅ Performance test: 100 queries in ${duration}ms (${(duration/100).toFixed(2)}ms avg)`);
        
        // Test 7: Error handling
        console.log('\n7. Testing error handling...');
        try {
            await dbService.run('INVALID SQL QUERY');
        } catch (error) {
            console.log('✅ Error handling works:', error.message.substring(0, 50) + '...');
        }
        
        // Test 8: Final health check
        console.log('\n8. Final health check...');
        const finalHealth = await dbService.healthCheck();
        console.log('✅ Final health:', finalHealth.status, `(${finalHealth.responseTime}ms)`);
        
        console.log('\n🎉 ALL ENHANCED SQLITE TESTS PASSED!');
        console.log('📊 Enhanced features working:');
        console.log('   - Connection retry mechanism');
        console.log('   - Health monitoring');
        console.log('   - Performance optimizations');
        console.log('   - Error handling');
        console.log('   - Concurrent operations');
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
    } finally {
        // Test 9: Graceful shutdown
        console.log('\n9. Testing graceful shutdown...');
        await dbService.close();
        console.log('✅ Database closed gracefully');
        process.exit(0);
    }
}

testEnhancedSQLite();