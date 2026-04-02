# Khắc Phục Lỗi Kết Nối Supabase

## Lỗi: Connection Timeout (ETIMEDOUT)

### Nguyên nhân có thể:

1. **Supabase project bị pause** (free tier tự động pause sau 1 tuần không dùng)
2. **Connection string sai**
3. **Firewall/network issue**

---

## Giải Pháp 1: Wake Up Supabase Project

### Bước 1: Kiểm tra trạng thái project

1. Vào https://supabase.com/dashboard
2. Chọn project `thansohoc`
3. Kiểm tra status:
   - **Active** (màu xanh) = Đang chạy
   - **Paused** (màu xám) = Đang pause

### Bước 2: Wake up project (nếu bị pause)

1. Nhấp vào project `thansohoc`
2. Nếu thấy nút "Restore", nhấp vào
3. Chờ 1-2 phút để project khởi động
4. Thử kết nối lại

---

## Giải Pháp 2: Verify Connection String

### Bước 1: Lấy connection string mới

1. Vào Supabase Dashboard
2. Chọn project `thansohoc`
3. Nhấp Settings → Database
4. Kéo xuống "Connection string"
5. Chọn tab "URI"
6. Copy connection string (dạng: `postgresql://postgres:[YOUR-PASSWORD]@...`)

### Bước 2: Cập nhật .env.production

Thay `[YOUR-PASSWORD]` bằng password thực tế: `787878fjfgjfgj`

```
DATABASE_URL=postgresql://postgres:787878fjfgjfgj@fufsritvsgrqkxgfoswr.supabase.co:5432/postgres
```

---

## Giải Pháp 3: Sử dụng Supabase SQL Editor (Khuyên Dùng!)

Nếu không kết nối được từ local, bạn có thể chạy SQL trực tiếp trong Supabase:

### Bước 1: Tạo Schema

1. Vào Supabase Dashboard
2. Chọn project `thansohoc`
3. Nhấp "SQL Editor"
4. Copy nội dung file `backendjs/scripts/schema.sql`
5. Paste vào SQL Editor
6. Nhấp "Run"

### Bước 2: Import Data Thủ Công

**Option A: Export từ SQLite → Import vào Supabase**

1. Export SQLite data:
```bash
cd tinix-bazi/backendjs
sqlite3 data/bazi_consultant.db .dump > data/sqlite_dump.sql
```

2. Chỉnh sửa file `sqlite_dump.sql`:
   - Xóa các dòng SQLite-specific syntax
   - Chuyển đổi sang PostgreSQL syntax

3. Import vào Supabase SQL Editor

**Option B: Sử dụng Supabase Studio**

1. Vào Table Editor
2. Chọn table
3. Nhấp "Insert row"
4. Nhập data thủ công (phù hợp cho data ít)

---

## Giải Pháp 4: Chạy Migration Từ Render

Nếu local không kết nối được, có thể chạy migration từ Render sau khi deploy:

### Bước 1: Tạo migration endpoint

Thêm vào `backendjs/server.js`:

```javascript
// Migration endpoint (chỉ dùng 1 lần)
app.get('/admin/migrate', async (req, res) => {
    try {
        // Run migration logic here
        res.json({ success: true, message: 'Migration completed' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});
```

### Bước 2: Deploy lên Render

### Bước 3: Gọi endpoint

```bash
curl https://huyenhoc.onrender.com/admin/migrate
```

### Bước 4: Xóa endpoint sau khi xong

---

## Kiểm Tra Nhanh

### Test 1: Ping Supabase

```bash
ping fufsritvsgrqkxgfoswr.supabase.co
```

### Test 2: Telnet

```bash
telnet fufsritvsgrqkxgfoswr.supabase.co 5432
```

Nếu không kết nối được = firewall hoặc project pause

### Test 3: Supabase API

```bash
curl https://fufsritvsgrqkxgfoswr.supabase.co/rest/v1/
```

Nếu trả về response = project đang chạy

---

## Khuyến Nghị

**Cách dễ nhất**: Sử dụng Supabase SQL Editor để:

1. Chạy `schema.sql` để tạo tables
2. Seed data mẫu trực tiếp trong SQL Editor
3. Hoặc để backend tự tạo data khi có user sử dụng

**Lý do**: 
- Không cần lo về connection timeout
- Không cần cài đặt gì thêm
- Chạy trực tiếp trên Supabase infrastructure

---

## Nếu Vẫn Không Được

Hãy cho tôi biết:
1. Supabase project status (Active/Paused)?
2. Bạn có thể truy cập Supabase Dashboard không?
3. Có thể chạy query trong SQL Editor không?

