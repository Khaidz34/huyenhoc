# Hướng Dẫn Deploy Trên Render (Tiếng Việt)

## Bước 1: Chuẩn Bị

### 1.1 Kiểm Tra Mã Nguồn
- Đảm bảo tất cả code đã được commit lên GitHub
- Repository của bạn: `https://github.com/Khaidz34/huyenhoc`

### 1.2 Kiểm Tra File Cấu Hình
- ✅ `render.yaml` - Đã có trong thư mục gốc
- ✅ `.env.production` - Đã có trong `backendjs/`
- ✅ `package.json` - Đã cấu hình sẵn

### 1.3 Thông Tin Supabase
- Project ID: `fufsritvsgrqkxgfoswr`
- Database URL: `postgresql://postgres:787878fjfgjfgj@fufsritvsgrqkxgfoswr.supabase.co:5432/postgres`
- Anon Key: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ1ZnNyaXR2c2dycWt4Z2Zvc3dyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ5NDIwNzQsImV4cCI6MjA5MDUxODA3NH0.9CgVwcfj-uQEPhP3vpdHzl0NEVtVt4XvDD_XctrJOrQ`

---

## Bước 2: Đăng Nhập Render

1. Truy cập: https://render.com
2. Nhấp "Sign up" hoặc "Sign in"
3. Chọn "Continue with GitHub"
4. Cho phép Render truy cập GitHub của bạn

---

## Bước 3: Deploy Backend

### 3.1 Tạo Web Service Mới

1. Vào Dashboard: https://render.com/dashboard
2. Nhấp "New +" → "Web Service"
3. Chọn "Build and deploy from a Git repository"
4. Nhấp "Connect account" (nếu chưa kết nối GitHub)
5. Tìm và chọn repository `huyenhoc`
6. Nhấp "Connect"

### 3.2 Cấu Hình Backend

**Thông tin cơ bản:**
- **Name**: `huyenhoc` (tên bạn đã tạo)
- **Environment**: `Node`
- **Build Command**: `cd backendjs && npm install`
- **Start Command**: `cd backendjs && npm start`
- **Plan**: `Standard` (hoặc cao hơn)

**URL sau khi deploy**: `https://huyenhoc.onrender.com`

### 3.3 Thêm Environment Variables

Nhấp "Advanced" → "Add Environment Variable" và thêm:

```
NODE_ENV = production
TZ = Asia/Ho_Chi_Minh
PORT = 8888
DATABASE_URL = postgresql://postgres:787878fjfgjfgj@fufsritvsgrqkxgfoswr.supabase.co:5432/postgres
SUPABASE_URL = https://fufsritvsgrqkxgfoswr.supabase.co
SUPABASE_ANON_KEY = eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ1ZnNyaXR2c2dycWt4Z2Zvc3dyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ5NDIwNzQsImV4cCI6MjA5MDUxODA3NH0.9CgVwcfj-uQEPhP3vpdHzl0NEVtVt4XvDD_XctrJOrQ
OPENROUTER_API_KEY = [Nhập API key của bạn nếu có]
CORS_ORIGIN = https://thuatso.onrender.com,http://localhost:3005
LOG_LEVEL = info
```

### 3.4 Cấu Hình Health Check

- **Path**: `/`
- **Interval**: `30` giây
- **Timeout**: `5` giây

### 3.5 Deploy

1. Nhấp "Create Web Service"
2. Chờ deployment hoàn thành (5-10 phút)
3. Ghi lại URL backend (ví dụ: `https://bazi-backend.render.com`)

---

## Bước 4: Deploy Frontend

### 4.1 Tạo Static Site Mới

1. Vào Dashboard: https://render.com/dashboard
2. Nhấp "New +" → "Static Site"
3. Chọn repository `huyenhoc`
4. Nhấp "Connect"

### 4.2 Cấu Hình Frontend

**Thông tin cơ bản:**
- **Name**: `thuatso` (tên bạn đã tạo)
- **Build Command**: `cd frontend && npm install && npm run build`
- **Publish Directory**: `frontend/dist`

**URL sau khi deploy**: `https://thuatso.onrender.com`

### 4.3 Thêm Environment Variables

```
VITE_API_URL = https://huyenhoc.onrender.com
VITE_APP_VERSION = 2.1
VITE_ENABLE_AI_CONSULTANT = true
VITE_ENABLE_MATCHING = true
VITE_ENABLE_ARTICLES = true
VITE_ENABLE_ADMIN_PANEL = true
```

### 4.4 Cấu Hình Routes (Quan Trọng!)

**⚠️ LƯU Ý: Bước này phải làm SAU KHI đã tạo Static Site xong!**

**Tại sao cần cấu hình Routes?**

Ứng dụng của bạn là React Single Page Application (SPA) sử dụng React Router. Khi người dùng truy cập các URL như:
- `https://bazi-frontend.render.com/consultant`
- `https://bazi-frontend.render.com/matching`
- `https://bazi-frontend.render.com/admin`

Render cần biết rằng TẤT CẢ các URL này đều phải trả về file `index.html`, sau đó React Router sẽ xử lý routing phía client.

**Nếu không cấu hình**: Người dùng truy cập `/consultant` sẽ gặp lỗi 404.

---

**CÁCH 1: Sử dụng render.yaml (Tự Động - Khuyên Dùng)**

File `render.yaml` trong code của bạn đã có cấu hình sẵn:

```yaml
routes:
  - path: /*
    destination: /index.html
    type: rewrite
```

Render sẽ TỰ ĐỘNG đọc file này khi deploy. Bạn KHÔNG CẦN làm gì thêm!

---

**CÁCH 2: Cấu hình thủ công (Nếu render.yaml không hoạt động)**

**Bước 1**: Deploy Static Site trước (làm theo bước 4.5)

**Bước 2**: SAU KHI deploy xong, vào Settings:

1. Vào Dashboard → Chọn service `bazi-frontend`
2. Nhấp tab "Settings" (bên trái)
3. Kéo xuống phần "Redirects/Rewrites"
4. Nhấp "Add Rule"
5. Điền thông tin:
   - **Source**: `/*`
   - **Destination**: `/index.html`
   - **Action**: `Rewrite`
6. Nhấp "Save Changes"

**Bước 3**: Render sẽ tự động redeploy với cấu hình mới

---

**Giải thích chi tiết:**

- `/*` = Bất kỳ đường dẫn nào (ví dụ: `/consultant`, `/admin`, `/matching/123`)
- `/index.html` = Trả về file index.html chứa React app
- `rewrite` = Giữ nguyên URL trên trình duyệt, không redirect (quan trọng cho SEO và UX)

**Ví dụ hoạt động:**
1. Người dùng truy cập: `https://bazi-frontend.render.com/consultant`
2. Render nhận request → Kiểm tra rules → Match với `/*`
3. Render trả về nội dung của `/index.html` (nhưng URL vẫn là `/consultant`)
4. React app load → React Router đọc URL `/consultant` → Hiển thị trang Consultant

**Không có rewrite rule:**
1. Người dùng truy cập: `https://bazi-frontend.render.com/consultant`
2. Render tìm file `consultant.html` → Không tìm thấy → 404 Error

### 4.5 Deploy

1. Nhấp "Create Static Site"
2. Chờ deployment hoàn thành (3-5 phút)
3. Ghi lại URL frontend (ví dụ: `https://bazi-frontend.render.com`)

---

## Bước 5: Kiểm Tra Deployment

### 5.1 Kiểm Tra Backend

Mở terminal và chạy:

```bash
curl https://huyenhoc.onrender.com/
```

Kết quả mong đợi:
```json
{
  "name": "BaZi Mega-Evolution API",
  "version": "2.1",
  "status": "running",
  "docs": "/api/docs"
}
```

### 5.2 Kiểm Tra Frontend

1. Mở trình duyệt
2. Truy cập: `https://thuatso.onrender.com`
3. Kiểm tra console (F12) không có lỗi
4. Thử các chức năng chính

### 5.3 Kiểm Tra Kết Nối Database

```bash
curl https://huyenhoc.onrender.com/api/consultant/stats
```

Nếu thành công, sẽ trả về thống kê tư vấn.

---

## Bước 6: Cấu Hình Auto-Deploy (Tùy Chọn)

### 6.1 Tự Động Deploy Khi Push Code

1. Vào service settings
2. Tìm "Auto-Deploy"
3. Chọn branch `main`
4. Bật "Auto-deploy"

Từ giờ, mỗi khi bạn push code lên GitHub, Render sẽ tự động deploy.

### 6.2 Deploy Thủ Công

Nếu cần deploy ngay:

1. Vào service dashboard
2. Nhấp "Manual Deploy"
3. Chọn branch
4. Nhấp "Deploy"

---

## Bước 7: Giám Sát Ứng Dụng

### 7.1 Xem Logs

1. Vào service dashboard
2. Nhấp tab "Logs"
3. Xem logs real-time

### 7.2 Kiểm Tra Trạng Thái

1. Vào service dashboard
2. Kiểm tra "Health" status
3. Xem các deployment gần đây

### 7.3 Giám Sát Hiệu Năng

1. Vào service dashboard
2. Nhấp tab "Metrics"
3. Giám sát:
   - CPU usage
   - Memory usage
   - Request count
   - Response time
   - Error rate

---

## Khắc Phục Sự Cố

### Lỗi: Build Fails

**Nguyên nhân**: npm install thất bại

**Giải pháp**:
1. Kiểm tra `package.json` syntax
2. Xác minh tất cả dependencies có sẵn
3. Kiểm tra Node.js version (18+)
4. Xóa build cache và deploy lại

### Lỗi: Service Failed to Start

**Nguyên nhân**: Lỗi khi khởi động service

**Giải pháp**:
1. Kiểm tra logs để tìm lỗi
2. Xác minh environment variables đã set
3. Kiểm tra kết nối database
4. Xác minh start command đúng

### Lỗi: Cannot Connect to Backend

**Nguyên nhân**: Frontend không kết nối được backend

**Giải pháp**:
1. Xác minh backend service đang chạy
2. Kiểm tra CORS configuration
3. Xác minh API URL trong frontend
4. Kiểm tra browser console

### Lỗi: Database Connection Failed

**Nguyên nhân**: Không kết nối được database

**Giải pháp**:
1. Xác minh DATABASE_URL đúng
2. Kiểm tra Supabase project đang chạy
3. Xác minh database credentials
4. Kiểm tra kết nối mạng

---

## Thông Tin Hữu Ích

### URLs Sau Deploy

- **Backend API**: `https://bazi-backend.render.com`
- **Frontend**: `https://bazi-frontend.render.com`
- **API Docs**: `https://bazi-backend.render.com/api/docs`

### Environment Variables Quan Trọng

| Biến | Mô Tả | Ví Dụ |
|------|-------|-------|
| NODE_ENV | Môi trường | production |
| DATABASE_URL | PostgreSQL connection | postgresql://... |
| SUPABASE_URL | Supabase URL | https://xxx.supabase.co |
| VITE_API_URL | Backend URL | https://backend.com |

### Tài Liệu Tham Khảo

- Render Docs: https://render.com/docs
- Supabase Docs: https://supabase.com/docs
- GitHub: https://github.com/Khaidz34/huyenhoc

---

## Tóm Tắt Quy Trình

1. ✅ Chuẩn bị (code, config, Supabase)
2. ✅ Đăng nhập Render
3. ✅ Deploy Backend (Web Service)
4. ✅ Deploy Frontend (Static Site)
5. ✅ Kiểm tra kết nối
6. ✅ Cấu hình auto-deploy (tùy chọn)
7. ✅ Giám sát ứng dụng

**Thời gian ước tính**: 20-30 phút

---

## Cần Giúp?

Nếu gặp vấn đề:

1. Kiểm tra logs trong Render dashboard
2. Xem phần "Khắc Phục Sự Cố" ở trên
3. Kiểm tra GitHub repository
4. Liên hệ Render support: https://render.com/support

