# Render Deployment - Cấu Hình Nhanh

## URLs Của Bạn

- **Backend**: `https://huyenhoc.onrender.com`
- **Frontend**: `https://thuatso.onrender.com`

---

## Backend Environment Variables (Render Dashboard)

Vào service `huyenhoc` → Settings → Environment → Add:

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

---

## Frontend Environment Variables (Render Dashboard)

Vào service `thuatso` → Settings → Environment → Add:

```
VITE_API_URL=https://huyenhoc.onrender.com
VITE_APP_VERSION=2.1
VITE_ENABLE_AI_CONSULTANT=true
VITE_ENABLE_MATCHING=true
VITE_ENABLE_ARTICLES=true
VITE_ENABLE_ADMIN_PANEL=true
```

---

## Frontend Routes Configuration

**SAU KHI deploy frontend xong:**

1. Vào service `thuatso`
2. Nhấp tab "Settings"
3. Kéo xuống "Redirects/Rewrites"
4. Nhấp "Add Rule":
   - **Source**: `/*`
   - **Destination**: `/index.html`
   - **Action**: `Rewrite`
5. Save

**Hoặc** Render sẽ tự động đọc từ `render.yaml` (đã cấu hình sẵn).

---

## Kiểm Tra Nhanh

**Backend:**
```bash
curl https://huyenhoc.onrender.com/
```

**Frontend:**
Mở browser: `https://thuatso.onrender.com`

**Database:**
```bash
curl https://huyenhoc.onrender.com/api/consultant/stats
```

---

## Cần Thay Đổi Gì?

✅ **Đã cập nhật:**
- `render.yaml` - Tên services và URLs
- `backendjs/.env.production` - CORS_ORIGIN
- `frontend/.env.production` - VITE_API_URL

✅ **Cần làm trong Render Dashboard:**
- Thêm Environment Variables cho backend `huyenhoc`
- Thêm Environment Variables cho frontend `thuatso`
- (Tùy chọn) Cấu hình Routes nếu render.yaml không tự động áp dụng

---

## Push Code Lên GitHub

Sau khi cập nhật xong, push code:

```bash
cd tinix-bazi
git add .
git commit -m "Update Render configuration with actual service names"
git push origin main
```

Render sẽ tự động redeploy nếu bạn đã bật Auto-Deploy.

