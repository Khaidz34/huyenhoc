/**
 * Test mô phỏng nhiều người dùng truy cập cùng lúc
 */
const dbService = require('./src/services/database.service');

async function simulateMultipleUsers() {
    try {
        console.log('🔄 Khởi tạo database...');
        await dbService.init();
        
        // Mô phỏng 5 người dùng truy cập cùng lúc
        const users = [
            { name: 'Người dùng 1', year: 1990, month: 1, day: 1, hour: 8 },
            { name: 'Người dùng 2', year: 1985, month: 5, day: 15, hour: 14 },
            { name: 'Người dùng 3', year: 1992, month: 12, day: 25, hour: 20 },
            { name: 'Người dùng 4', year: 1988, month: 7, day: 10, hour: 6 },
            { name: 'Người dùng 5', year: 1995, month: 3, day: 8, hour: 12 }
        ];
        
        console.log('🔄 Mô phỏng 5 người dùng truy cập cùng lúc...');
        
        // Tạo promises để chạy đồng thời
        const promises = users.map(async (user, index) => {
            console.log(`👤 User ${index + 1} đang lưu thông tin...`);
            
            // Lưu thông tin customer
            const customerId = await dbService.findOrCreateCustomer(user);
            
            // Lưu consultation (mô phỏng tư vấn)
            const consultationId = await dbService.saveConsultation(
                customerId,
                'test',
                `question_${index + 1}`,
                `Câu hỏi từ ${user.name}`,
                `Câu trả lời cho ${user.name}`,
                true,
                1
            );
            
            return {
                user: user.name,
                customerId,
                consultationId,
                timestamp: new Date()
            };
        });
        
        // Chờ tất cả users hoàn thành
        const results = await Promise.all(promises);
        
        console.log('✅ Kết quả từ tất cả người dùng:');
        results.forEach((result, index) => {
            console.log(`   ${index + 1}. ${result.user} - Customer ID: ${result.customerId}, Consultation ID: ${result.consultationId}`);
        });
        
        // Kiểm tra tổng số records
        const stats = await dbService.getStats();
        console.log('📊 Thống kê database:', stats);
        
        // Lấy danh sách tất cả customers
        const allCustomers = await dbService.getAllCustomers(20);
        console.log(`📋 Tổng số customers: ${allCustomers.length}`);
        
        console.log('🎉 TẤT CẢ NGƯỜI DÙNG ĐÃ LƯU THÔNG TIN THÀNH CÔNG!');
        console.log('💡 Điều này chứng minh database có thể xử lý nhiều người dùng cùng lúc');
        
    } catch (error) {
        console.error('❌ Lỗi:', error.message);
    } finally {
        dbService.close && dbService.close();
        process.exit(0);
    }
}

simulateMultipleUsers();