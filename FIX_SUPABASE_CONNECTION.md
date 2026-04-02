# Fix Supabase Connection - Các Bước Cụ Thể

## Vấn Đề: Connection Timeout

Render không kết nối được Supabase. Có thể do:
1. Connection string sai format
2. Supabase project pause
3. Cần dùng pooler connection

---

## Giải Pháp: Lấy Connection String Đúng

### Bước 1: Vào Supabase Dashboard

1. Truy cập: https://supabase.com/dashboard
2. Chọn project **thansohoc**
3. Nhấp **Settings** (icon ⚙️ bên trái)
4. Nhấp **Database**

### Bước 2: Copy Connection String

Kéo xuống phần **"Connection string"**, bạn sẽ thấy 2 tabs:

**Tab "URI"** - Direct connection (port 5432):
```
postgresql://postgres.[PROJECT-REF]:[YOUR-PASSWORD]@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres
```

**Tab "Connection pooling"** - Pooler (port 6543) - DÙNG CÁI NÀY:
```
postgresql://postgres.[PROJECT-REF]:[YOUR-PASSWORD]@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres
```

### Bước 3: Thay Password

Trong connection string, thay `[YOUR-PASSWORD]` bằng: `787878fjfgjfgj`

Ví dụ kết quả:
```
postgresql://postgres.fufsritvsgrqkxgfoswr:787878fjfgjfgj@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres
```

### Bước 4: Update Trong Render

1. Vào Render Dashboard
2. Chọn service **huyenhoc**
3. Nhấp **Settings** → **Environment**
4. Tìm biến `DATABASE_URL`
5. Sửa thành connection string mới (từ bước 3)
6. Nhấp **Save Changes**

### Bước 5: Verify Project Active

Trong Supabase Dashboard:
1. Kiểm tra project status (góc trên bên phải)
2. Nếu "Paused", nhấp "Restore"
3. Chờ 1-2 phút

---

## Alternative: Dùng Supabase Connection Pooler

Nếu vẫn timeout, thử thêm `?pgbouncer=true` vào cuối connection string:

```
postgresql://postgres:787878fjfgjfgj@fufsritvsgrqkxgfoswr.supabase.co:6543/postgres?pgbouncer=true
```

---

## Alternative 2: Dùng Railway PostgreSQL

Nếu Supabase vẫn không được, dùng Railway PostgreSQL (miễn phí):

### Bước 1: Tạo PostgreSQL Database

1. Vào https://railway.app
2. New Project → Provision PostgreSQL
3. Copy DATABASE_URL

### Bước 2: Update Render

1. Thay DATABASE_URL trong Render bằng Railway DATABASE_URL
2. Save → Redeploy

### Bước 3: Chạy Schema

1. Vào Railway → PostgreSQL → Data tab
2. Nhấp "Query"
3. Copy/paste `schema.sql`
4. Run

---

## Test Connection String

Để test connection string có đúng không, thử trong Supabase SQL Editor:

```sql
SELECT NOW();
```

Nếu chạy được = Connection string đúng
Nếu lỗi = Có vấn đề với project

---

## Checklist

- [ ] Supabase project status = Active (không phải Paused)
- [ ] Connection string copy từ Supabase Dashboard (không tự gõ)
- [ ] Password đúng: 787878fjfgjfgj
- [ ] Port 6543 (pooler) hoặc 5432 (direct)
- [ ] DATABASE_URL đã set trong Render Environment
- [ ] Đã Save Changes và chờ redeploy

