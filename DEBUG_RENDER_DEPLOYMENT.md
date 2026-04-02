# Debug: "Xem Lá Số" Không Hiển Thị Kết Quả

## Kiểm Tra 1: Backend Environment Variables

Vào Render Dashboard → Service `huyenhoc` → Settings → Environment

**Cần có các biến này:**

```
NODE_ENV=production
TZ=Asia/Ho_Chi_Minh
PORT=8888
DATABASE_URL=postgresql://postgres:787878fjfgjfgj@fufsritvsgrqkxgfoswr.supabase.co:5432/postgres
SUPABASE_URL=https://fufsritvsgrqkxgfoswr.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ1ZnNyaXR2c2dycWt4Z2Zvc3dyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ5NDIwNzQsImV4cCI6MjA5MDUxODA3NH0.9CgVwcfj-uQEPhP3vpdHzl0NEVtVt4XvDD_XctrJOrQ
CORS_ORIGIN=https://thuatso.onrender.com,http://localhost:3005
LOG_LEVEL=info
```

**Nếu thiếu hoặc sai**: Thêm/sửa → Save Changes → Render sẽ redeploy

---

## Kiểm Tra 2: Frontend Environment Variables

Vào Render Dashboard → Service `thuatso` → Settings → Environment

**Cần có các biến này:**

```
VITE_API_URL=https://huyenhoc.onrender.com
VITE_APP_VERSION=2.1
VITE_ENABLE_AI_CONSULTANT=true
VITE_ENABLE_MATCHING=true
VITE_ENABLE_ARTICLES=true
VITE_ENABLE_ADMIN_PANEL=true
```

**Nếu thiếu hoặc sai**: Thêm/sửa → Save Changes → Render sẽ redeploy

---

## Kiểm Tra 3: Test Backend API

Mở terminal và test:

```bash
# Test 1: Health check
curl https://huyenhoc.onrender.com/

# Test 2: Analyze endpoint
curl "https://huyenhoc.onrender.com/api/analyze?year=1990&month=1&day=1&hour=12&minute=0&gender=Nam"
```

**Kết quả mong đợi Test 1:**
```json
{
  "name": "BaZi Mega-Evolution API",
  "version": "2.1",
  "status": "running"
}
```

**Kết quả mong đợi Test 2:**
```json
{
  "success": true,
  "data": {
    "bazi": { ... },
    "analysis": { ... }
  }
}
```

**Nếu lỗi**: Xem logs trong Render Dashboard → Service `huyenhoc` → Logs

---

## Kiểm Tra 4: Browser Console

1. Mở https://thuatso.onrender.com
2. Nhấn F12 (mở Developer Tools)
3. Nhấp tab "Console"
4. Nhập thông tin và bấm "Xem lá số"
5. Xem có lỗi gì trong Console không

**Các lỗi thường gặp:**

### Lỗi: CORS Error
```
Access to fetch at 'https://huyenhoc.onrender.com' from origin 'https://thuatso.onrender.com' has been blocked by CORS policy
```

**Giải pháp**: 
- Vào backend `huyenhoc` → Settings → Environment
- Kiểm tra `CORS_ORIGIN` có `https://thuatso.onrender.com`
- Nếu không có, thêm vào
- Save → Redeploy

### Lỗi: Network Error / Failed to fetch
```
Failed to fetch
```

**Giải pháp**:
- Kiểm tra `VITE_API_URL` trong frontend
- Vào `thuatso` → Settings → Environment
- Verify `VITE_API_URL=https://huyenhoc.onrender.com`
- Save → Redeploy

### Lỗi: 404 Not Found
```
GET https://huyenhoc.onrender.com/api/analyze 404
```

**Giải pháp**:
- Backend chưa deploy đúng
- Kiểm tra logs backend
- Verify start command: `cd backendjs && npm start`

### Lỗi: 500 Internal Server Error
```
GET https://huyenhoc.onrender.com/api/analyze 500
```

**Giải pháp**:
- Lỗi trong backend code
- Xem logs: Render Dashboard → `huyenhoc` → Logs
- Có thể do database connection failed

---

## Kiểm Tra 5: Backend Logs

1. Vào Render Dashboard
2. Chọn service `huyenhoc`
3. Nhấp tab "Logs"
4. Xem có lỗi gì không

**Lỗi thường gặp:**

```
Error: connect ETIMEDOUT
```
→ Database connection failed → Kiểm tra DATABASE_URL

```
Error: listen EADDRINUSE
```
→ Port đã được dùng → Không xảy ra trên Render

```
TypeError: Cannot read property 'xxx' of undefined
```
→ Lỗi code → Cần fix bug

---

## Kiểm Tra 6: Network Tab

1. Mở https://thuatso.onrender.com
2. Nhấn F12
3. Nhấp tab "Network"
4. Nhập thông tin và bấm "Xem lá số"
5. Xem request nào failed

**Kiểm tra:**
- Request URL có đúng không? (phải là `https://huyenhoc.onrender.com/api/...`)
- Status code là gì? (200 = OK, 404 = Not Found, 500 = Server Error, 0 = CORS/Network)
- Response có data không?

---

## Giải Pháp Nhanh

### Option 1: Redeploy Cả 2 Services

1. Backend: Render Dashboard → `huyenhoc` → Manual Deploy → Deploy
2. Frontend: Render Dashboard → `thuatso` → Manual Deploy → Deploy
3. Chờ deploy xong (5-10 phút)
4. Test lại

### Option 2: Kiểm Tra Environment Variables

**Backend `huyenhoc`:**
- ✅ CORS_ORIGIN có `https://thuatso.onrender.com`
- ✅ DATABASE_URL đúng
- ✅ PORT=8888

**Frontend `thuatso`:**
- ✅ VITE_API_URL=`https://huyenhoc.onrender.com`

### Option 3: Test API Trực Tiếp

Mở browser và truy cập:
```
https://huyenhoc.onrender.com/api/analyze?year=1990&month=1&day=1&hour=12&minute=0&gender=Nam
```

Nếu thấy JSON response = Backend OK
Nếu không thấy gì = Backend có vấn đề

---

## Cần Giúp Thêm?

Hãy cho tôi biết:
1. Có lỗi gì trong Browser Console (F12)?
2. Backend logs có lỗi gì không?
3. Test API trực tiếp có hoạt động không?

