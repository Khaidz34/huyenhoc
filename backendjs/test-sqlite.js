/**
 * Test script để kiểm tra SQLite database có lưu được dữ liệu không
 */
const dbService = require('./src/services/database.service');

async function testDatabase() {
    try {
        console.log('🔄 Khởi tạo database...');
        await dbService.init();
        
        console.log('✅ Database khởi tạo thành công!');
        
        // Test tạo customer mới
        console.log('🔄 Test tạo customer...');
        const customerId = await dbService.findOrCreateCustomer({
            name: 'Test User',
            year: 1990,
            month: 5,
            day: 15,
            hour: 10,
            minute: 30,
            gender: 'Nam',
            calendar: 'solar'
        });
        console.log(`✅ Customer tạo thành công! ID: ${customerId}`);
        
        // Test lưu consultation
        console.log('🔄 Test lưu consultation...');
        const consultationId = await dbService.saveConsultation(
            customerId,
            'test',
            'test_question',
            'Câu hỏi test',
            'Câu trả lời test',
            true,
            1
        );
        console.log(`✅ Consultation lưu thành công! ID: ${consultationId}`);
        
        // Test đọc dữ liệu
        console.log('🔄 Test đọc dữ liệu...');
        const customer = await dbService.getCustomer(customerId);
        console.log('✅ Dữ liệu customer:', customer);
        
        const history = await dbService.getCustomerHistory(customerId);
        console.log('✅ Lịch sử consultation:', history);
        
        // Test thống kê
        const stats = await dbService.getStats();
        console.log('✅ Thống kê:', stats);
        
        console.log('🎉 TẤT CẢ TEST THÀNH CÔNG! SQLite có thể lưu dữ liệu!');
        
    } catch (error) {
        console.error('❌ Lỗi test:', error.message);
    } finally {
        dbService.close && dbService.close();
        process.exit(0);
    }
}

testDatabase();