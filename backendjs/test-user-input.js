/**
 * Test lưu thông tin người dùng vào SQLite
 */
const dbService = require('./src/services/database.service');

async function testUserInput() {
    try {
        console.log('🔄 Khởi tạo database...');
        await dbService.init();
        
        // Test với thông tin người dùng thực tế
        const userData = {
            name: 'Nguyễn Văn A',
            year: 1990,
            month: 5,
            day: 15,
            hour: 14,
            minute: 30,
            gender: 'Nam',
            calendar: 'solar'
        };
        
        console.log('🔄 Lưu thông tin người dùng:', userData);
        const customerId = await dbService.findOrCreateCustomer(userData);
        console.log(`✅ Lưu thành công! Customer ID: ${customerId}`);
        
        // Đọc lại thông tin để xác nhận
        const savedCustomer = await dbService.getCustomer(customerId);
        console.log('✅ Thông tin đã lưu:', savedCustomer);
        
        // Test với nhiều người dùng khác nhau
        const users = [
            { name: 'Trần Thị B', year: 1985, month: 12, day: 25, hour: 8, minute: 0, gender: 'Nữ' },
            { name: 'Lê Văn C', year: 1992, month: 3, day: 10, hour: 22, minute: 45, gender: 'Nam' },
            { name: 'Phạm Thị D', year: 1988, month: 7, day: 20, hour: 6, minute: 15, gender: 'Nữ' }
        ];
        
        console.log('🔄 Test với nhiều người dùng...');
        for (const user of users) {
            const id = await dbService.findOrCreateCustomer(user);
            console.log(`✅ Lưu ${user.name} - ID: ${id}`);
        }
        
        // Xem tất cả customers
        const allCustomers = await dbService.getAllCustomers(10);
        console.log('✅ Tất cả customers:', allCustomers.length);
        allCustomers.forEach(customer => {
            console.log(`   - ${customer.name} (${customer.year}/${customer.month}/${customer.day} ${customer.hour}:${customer.minute})`);
        });
        
        console.log('🎉 TẤT CẢ THÔNG TIN NGƯỜI DÙNG ĐÃ ĐƯỢC LƯU THÀNH CÔNG!');
        
    } catch (error) {
        console.error('❌ Lỗi:', error.message);
    } finally {
        dbService.close && dbService.close();
        process.exit(0);
    }
}

testUserInput();