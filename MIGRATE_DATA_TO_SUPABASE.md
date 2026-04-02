# Hướng Dẫn Migrate Data Sang Supabase

## Bước 1: Chuẩn Bị

Đảm bảo bạn có:
- ✅ SQLite database: `backendjs/data/bazi_consultant.db`
- ✅ Supabase credentials trong `.env.production`

## Bước 2: Chạy Migration Script

Mở terminal và chạy:

```bash
cd tinix-bazi/backendjs
node scripts/migrate-sqlite-to-postgres.js
```

Script sẽ:
1. Kết nối SQLite database
2. Kết nối Supabase PostgreSQL
3. Tạo schema (tables, indexes)
4. Copy tất cả data từ SQLite → PostgreSQL
5. Verify data đã migrate đúng

## Bước 3: Kiểm Tra Kết Quả

Script sẽ hiển thị:

```
[MIGRATION] Connected to SQLite: data/bazi_consultant.db
[MIGRATION] Connected to PostgreSQL
[MIGRATION] Creating PostgreSQL schema...
[MIGRATION] Migrating table: users
[MIGRATION] Inserted 5/5 rows into users
[MIGRATION] Migrating table: customers
[MIGRATION] Inserted 100/100 rows into customers
...
[MIGRATION] Verifying migration...
✓ users: SQLite=5, PostgreSQL=5
✓ customers: SQLite=100, PostgreSQL=100
...
[MIGRATION] Migration completed! Total rows inserted: 500
```

## Bước 4: Verify Trong Supabase Dashboard

1. Vào https://supabase.com/dashboard
2. Chọn project `thansohoc`
3. Nhấp "Table Editor"
4. Kiểm tra các tables:
   - users
   - customers
   - consultations
   - question_categories
   - custom_questions
   - sessions
   - credit_transactions
   - credit_requests
   - article_categories
   - articles
   - que_history
   - access_logs

## Nếu Gặp Lỗi

### Lỗi: DATABASE_URL not found

**Giải pháp**: Đảm bảo file `.env.production` có DATABASE_URL:

```bash
cd backendjs
cat .env.production | grep DATABASE_URL
```

Nếu không có, thêm vào:
```
DATABASE_URL=postgresql://postgres:787878fjfgjfgj@fufsritvsgrqkxgfoswr.supabase.co:5432/postgres
```

### Lỗi: SQLite database not found

**Giải pháp**: Kiểm tra file SQLite tồn tại:

```bash
ls -la backendjs/data/bazi_consultant.db
```

### Lỗi: Connection refused

**Giải pháp**: 
1. Kiểm tra Supabase project đang chạy
2. Verify DATABASE_URL đúng
3. Kiểm tra internet connection

### Lỗi: Permission denied

**Giải pháp**: Kiểm tra password trong DATABASE_URL đúng

## Sau Khi Migration Xong

1. ✅ Data đã có trong Supabase
2. ✅ Backend sẽ tự động dùng PostgreSQL khi deploy
3. ✅ Có thể deploy lên Render

