# Checklist Debug: Không Có Kết Quả Lá Số Trên Web

## Vấn Đề
Web đã chạy trên cloud (Render), có thể truy cập được, nhưng khi điền thông tin và bấm "Xem lá số" thì không có kết quả trả về.

## Các Bước Kiểm Tra

### 1. Kiểm Tra Render Đã Deploy Code Mới Chưa

**Cách kiểm tra:**
1. Vào https://dashboard.render.com
2. Chọn service `huyenhoc` (backend)
3. Xem tab "Events" hoặc "Logs"
4. Kiểm tra thời gian deploy gần nhất có khớp với thời gian push code lên GitHub không

**Nếu chưa deploy:**
- Vào service `huyenhoc`
- Bấm "Manual Deploy" → "Deploy latest commit"
- Chờ deploy xong (khoảng 2-5 phút)

### 2. Kiểm Tra Backend Có Chạy Không

**Test API backend:**

Mở trình duyệt và truy cập:
```
https://huyenhoc.onrender.com/
```

**Kết quả mong đợi:**
```json
{
  "name": "BaZi Mega-Evolution API",
  "version": "2.1",
  "status": "running"
}
```

**Nếu không truy cập được:**
- Backend đang sleep (Render free tier)
- Đợi 30-60 giây để backend wake up
- Refresh lại trang

### 3. Kiểm Tra API /api/analyze

**Test trực tiếp API:**

Mở trình duyệt và truy cập:
```
https://huyenhoc.onrender.com/api/analyze?year=1990&month=5&day=15&hour=10&gender=Nam
```

**Kết quả mong đợi:**
- Trả về JSON với dữ liệu lá số (thong_tin_co_ban, tu_tru, ngu_hanh, etc.)
- Có field `customerId` (có thể null nếu database fail)
- Có field `databaseSaveSuccess` (true/false)

**Nếu lỗi:**
- Xem message lỗi trong response
- Kiểm tra logs trong Render dashboard

### 4. Kiểm Tra Frontend Config

**Kiểm tra VITE_API_URL:**

1. Vào https://dashboard.render.com
2. Chọn service `thuatso` (frontend)
3. Vào tab "Environment"
4. Kiểm tra `VITE_API_URL` = `https://huyenhoc.onrender.com`

**Nếu sai:**
- Sửa lại đúng URL backend
- Redeploy frontend

### 5. Kiểm Tra CORS

**Kiểm tra CORS_ORIGIN trong backend:**

1. Vào service `huyenhoc` (backend)
2. Vào tab "Environment"
3. Kiểm tra `CORS_ORIGIN` có chứa `https://thuatso.onrender.com`

**Giá trị đúng:**
```
https://thuatso.onrender.com,http://localhost:3005
```

**Nếu sai:**
- Thêm URL frontend vào CORS_ORIGIN
- Redeploy backend

### 6. Kiểm Tra Browser Console

**Mở Developer Tools:**
1. Mở web https://thuatso.onrender.com
2. Nhấn F12 (hoặc Ctrl+Shift+I)
3. Vào tab "Console"
4. Điền thông tin và bấm "Xem lá số"
5. Xem có lỗi gì không

**Các lỗi thường gặp:**

**Lỗi CORS:**
```
Access to fetch at 'https://huyenhoc.onrender.com/api/analyze' 
from origin 'https://thuatso.onrender.com' has been blocked by CORS policy
```
→ Sửa CORS_ORIGIN trong backend

**Lỗi Network:**
```
Failed to fetch
net::ERR_CONNECTION_REFUSED
```
→ Backend đang sleep hoặc down, đợi wake up

**Lỗi 500:**
```
500 Internal Server Error
```
→ Kiểm tra logs backend trong Render

### 7. Kiểm Tra Network Tab

**Xem request/response:**
1. Mở Developer Tools (F12)
2. Vào tab "Network"
3. Điền thông tin và bấm "Xem lá số"
4. Tìm request đến `/api/analyze`
5. Click vào request đó
6. Xem "Response" tab

**Kiểm tra:**
- Status code: Phải là 200
- Response body: Phải có dữ liệu JSON
- Response time: Không quá 30 giây

### 8. Kiểm Tra Logs Backend

**Xem logs trong Render:**
1. Vào https://dashboard.render.com
2. Chọn service `huyenhoc`
3. Vào tab "Logs"
4. Tìm dòng log khi bấm "Xem lá số"

**Logs mong đợi:**
```
[DB] New customer #123 created
hoặc
[DB] Failed to save customer: <error message>
```

**Nếu thấy lỗi:**
- Copy error message
- Tìm giải pháp trong phần Troubleshooting bên dưới

## Troubleshooting

### Lỗi: Backend Sleep (Render Free Tier)

**Triệu chứng:**
- Request đầu tiên mất 30-60 giây
- Sau đó các request tiếp theo nhanh

**Giải pháp:**
- Đây là hành vi bình thường của Render free tier
- Backend sẽ sleep sau 15 phút không hoạt động
- Đợi backend wake up (30-60 giây)
- Hoặc upgrade lên paid plan

### Lỗi: Database Connection Timeout

**Triệu chứng:**
- Request mất > 10 giây
- Logs hiện: "Database save timeout after 5 seconds"

**Giải pháp:**
- Fix đã xử lý vấn đề này
- Kết quả vẫn trả về dù database timeout
- Kiểm tra `databaseSaveSuccess: false` trong response

### Lỗi: Frontend Không Gọi API

**Triệu chứng:**
- Không thấy request trong Network tab
- Console không có lỗi

**Giải pháp:**
1. Kiểm tra frontend code có gọi API đúng không
2. Kiểm tra VITE_API_URL trong environment
3. Clear cache browser (Ctrl+Shift+Delete)
4. Hard refresh (Ctrl+F5)

### Lỗi: Response Rỗng

**Triệu chứng:**
- Status 200 nhưng response body rỗng
- Hoặc response không có dữ liệu mong đợi

**Giải pháp:**
1. Kiểm tra backend logs xem có lỗi không
2. Test API trực tiếp bằng browser
3. Kiểm tra code backend có return result không

## Script Kiểm Tra Nhanh

Chạy script này để test toàn bộ:

```bash
# Test backend health
curl https://huyenhoc.onrender.com/

# Test API analyze
curl "https://huyenhoc.onrender.com/api/analyze?year=1990&month=5&day=15&hour=10&gender=Nam"

# Nếu thành công, sẽ thấy JSON với dữ liệu lá số
```

## Kết Luận

Sau khi kiểm tra các bước trên, bạn sẽ biết được:

1. ✅ Backend có chạy không
2. ✅ API có trả về dữ liệu không
3. ✅ Frontend có gọi đúng API không
4. ✅ CORS có được cấu hình đúng không
5. ✅ Code mới đã được deploy chưa

Nếu vẫn không được, hãy cung cấp:
- Screenshot console errors
- Screenshot network tab
- Backend logs từ Render
