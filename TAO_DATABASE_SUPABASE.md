# Hướng Dẫn Tạo Database Trong Supabase

## Bước 1: Mở Supabase SQL Editor

1. Vào https://supabase.com/dashboard
2. Đăng nhập
3. Chọn project **thansohoc**
4. Nhấp **"SQL Editor"** (menu bên trái, icon ⚡)

## Bước 2: Kiểm Tra Project Status

Nếu thấy thông báo "Project is paused":
1. Nhấp "Restore project"
2. Chờ 1-2 phút
3. Refresh trang

## Bước 3: Chạy Schema SQL

### 3.1 Copy SQL Script

Mở file `tinix-bazi/backendjs/scripts/schema.sql` và copy TOÀN BỘ nội dung.

### 3.2 Paste Vào SQL Editor

1. Trong SQL Editor, nhấp "New query"
2. Paste toàn bộ SQL script vào
3. Nhấp **"Run"** (hoặc Ctrl+Enter)

### 3.3 Kiểm Tra Kết Quả

Bạn sẽ thấy:
```
Success. No rows returned
```

Hoặc:
```
12 tables created
```

## Bước 4: Verify Tables Đã Tạo

1. Nhấp **"Table Editor"** (menu bên trái)
2. Kiểm tra các tables đã xuất hiện:
   - ✅ users
   - ✅ customers
   - ✅ consultations
   - ✅ question_categories
   - ✅ custom_questions
   - ✅ sessions
   - ✅ credit_transactions
   - ✅ credit_requests
   - ✅ article_categories
   - ✅ articles
   - ✅ que_history
   - ✅ access_logs

## Bước 5: Kiểm Tra Default Data

### 5.1 Kiểm Tra Users

1. Trong Table Editor, chọn table **users**
2. Sẽ thấy 2 admin users:
   - admin@huyencobattu.vn
   - admin@admin.com
3. Password mặc định: `admin` (hash: 8c6976e5b5410415bde908bd4dee15dfb167a9c873fc4bb8a81f6f2ab448a918)

### 5.2 Kiểm Tra Question Categories

1. Chọn table **question_categories**
2. Sẽ thấy 8 categories:
   - Công danh 🏛️
   - Tình duyên ❤️
   - Tài lộc 💰
   - Sức khỏe 🏥
   - Con cái 👶
   - Đồng nghiệp 👥
   - Hợp tác 🤝
   - Tai họa 🌪️

### 5.3 Kiểm Tra Article Categories

1. Chọn table **article_categories**
2. Sẽ thấy 4 categories:
   - Kiến thức Bát Tự
   - Hướng dẫn sử dụng
   - Tin tức
   - Tư vấn

## Bước 6: Test Kết Nối Từ Backend

Sau khi tạo tables xong, test kết nối:

```bash
cd tinix-bazi/backendjs
node scripts/test-supabase-connection.js
```

Kết quả mong đợi:
```
✓ Connection successful!
Existing tables: 12
  - users
  - customers
  - consultations
  ...
```

## Nếu Cần Migrate Data Từ SQLite

Sau khi có tables, chạy migration:

```bash
cd tinix-bazi/backendjs
node scripts/migrate-sqlite-to-postgres.js
```

## Hoặc Bắt Đầu Với Database Trống

Nếu muốn bắt đầu mới (không migrate data cũ):
- ✅ Tables đã có
- ✅ Default admin users đã có
- ✅ Default categories đã có
- ✅ Sẵn sàng deploy!

Backend sẽ tự động tạo data mới khi có users sử dụng.

---

## Tóm Tắt

1. Vào Supabase Dashboard → SQL Editor
2. Copy nội dung file `backendjs/scripts/schema.sql`
3. Paste vào SQL Editor và Run
4. Verify tables trong Table Editor
5. Xong! Sẵn sàng deploy.

