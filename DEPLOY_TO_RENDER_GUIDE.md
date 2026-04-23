# 🚀 Hướng dẫn Deploy lên Render với PostgreSQL

## Tổng quan

Hướng dẫn này sẽ giúp bạn deploy ứng dụng tinix-bazi lên Render với PostgreSQL database, thay thế Supabase để tránh vấn đề auto-pause.

## 📋 Yêu cầu

- Tài khoản Render (miễn phí hoặc trả phí)
- Code đã được push lên GitHub repository
- Database Factory đã được implement (✅ Đã có)

## 🔧 Bước 1: Chuẩn bị Repository

### 1.1 Kiểm tra render.yaml

File `render.yaml` đã được cấu hình với PostgreSQL:

```yaml
services:
  - type: web
    name: huyenhoc
    runtime: node
    plan: standard
    buildCommand: cd backendjs && npm install
    startCommand: cd backendjs && npm start
    envVars:
      - key: NODE_ENV
        value: production
      - key: DATABASE_URL
        fromDatabase:
          name: bazi-database
          property: connectionString
    healthCheckPath: /health

databases:
  - name: bazi-database
    databaseName: tinix_bazi
    user: bazi_user
    plan: starter  # $7/month
```

### 1.2 Commit và push code

```bash
git add .
git commit -m "Add Database Factory and PostgreSQL support for Render"
git push origin main
```

## 🌐 Bước 2: Tạo Render Services

### 2.1 Đăng nhập Render

1. Truy cập https://render.com
2. Đăng nhập hoặc tạo tài khoản mới
3. Connect với GitHub repository

### 2.2 Deploy từ render.yaml

1. Trong Render Dashboard, click **"New +"**
2. Chọn **"Blueprint"**
3. Connect repository `tinix-bazi`
4. Render sẽ tự động đọc `render.yaml` và tạo:
   - PostgreSQL Database (`bazi-database`)
   - Web Service (`huyenhoc`)
   - Static Site (`thuatso`) - nếu có frontend

### 2.3 Cấu hình Database

Database sẽ được tạo tự động với:
- **Name**: `bazi-database`
- **Database**: `tinix_bazi`
- **User**: `bazi_user`
- **Plan**: Starter ($7/month)

## ⚙️ Bước 3: Cấu hình Environment Variables

### 3.1 Variables tự động

Render sẽ tự động set:
- `DATABASE_URL` - từ PostgreSQL database
- `NODE_ENV=production`
- `PORT=8888`

### 3.2 Variables cần set thủ công

Trong Web Service settings, thêm:

```bash
OPENROUTER_API_KEY=your-openrouter-api-key
CORS_ORIGIN=https://thuatso.onrender.com
LOG_LEVEL=info
```

## 🚀 Bước 4: Deploy và Kiểm tra

### 4.1 Theo dõi deployment

1. Render sẽ build và deploy tự động
2. Kiểm tra logs trong **"Logs"** tab
3. Chờ deployment hoàn thành (thường 2-5 phút)

### 4.2 Kiểm tra health

Sau khi deploy thành công:

```bash
# Health check cơ bản
curl https://huyenhoc.onrender.com/

# Health check chi tiết
curl https://huyenhoc.onrender.com/health

# Metrics
curl https://huyenhoc.onrender.com/metrics
```

Expected response:
```json
{
  "status": "ok",
  "database": {
    "status": "healthy",
    "database": "PostgreSQL"
  },
  "environment": "production"
}
```

## 📊 Bước 5: Kiểm tra Database

### 5.1 Kết nối database

Render cung cấp connection details trong Database dashboard:
- **Host**: `dpg-xxx.oregon-postgres.render.com`
- **Port**: `5432`
- **Database**: `tinix_bazi`
- **Username**: `bazi_user`
- **Password**: `[auto-generated]`

### 5.2 Kiểm tra tables

Database Factory sẽ tự động tạo tables khi khởi động:
- `customers`
- `consultations`
- `users`
- `sessions`
- `access_logs`

## 💰 Chi phí

### Render Pricing (tháng 4/2026)

**Database (PostgreSQL)**:
- Starter: $7/month (1GB storage, 100 connections)
- Standard: $20/month (10GB storage, 500 connections)

**Web Service**:
- Free: $0 (512MB RAM, sleeps after 15min inactive)
- Starter: $7/month (512MB RAM, always on)
- Standard: $25/month (2GB RAM)

**Static Site** (Frontend):
- Free: $0 (100GB bandwidth)

**Tổng chi phí tối thiểu**: $7/month (chỉ database)
**Khuyến nghị**: $14/month (database + web service starter)

## 🔧 Troubleshooting

### Lỗi thường gặp

**1. Database connection failed**
```bash
# Kiểm tra DATABASE_URL
echo $DATABASE_URL

# Kiểm tra logs
tail -f /var/log/render.log
```

**2. Tables không được tạo**
```bash
# Database Factory sẽ tự động tạo tables
# Kiểm tra logs để xem có lỗi không
```

**3. Health check failed**
```bash
# Kiểm tra endpoint
curl https://your-app.onrender.com/health

# Kiểm tra database status
curl https://your-app.onrender.com/metrics
```

### Debug commands

```bash
# Xem environment variables
printenv | grep DATABASE

# Test database connection
node -e "
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
pool.query('SELECT NOW()').then(r => console.log(r.rows[0]));
"
```

## 🎯 Lợi ích so với Supabase

### ✅ Ưu điểm

1. **Không bị pause**: Database luôn hoạt động
2. **Tích hợp tốt**: Native integration với Render
3. **Performance**: Cùng data center với web service
4. **Backup tự động**: Render tự động backup
5. **Monitoring**: Built-in monitoring và alerts

### ⚠️ Lưu ý

1. **Chi phí**: $7/month thay vì free
2. **Migration**: Cần migrate dữ liệu từ Supabase (nếu có)
3. **Scaling**: Cần upgrade plan khi traffic tăng

## 📈 Monitoring và Maintenance

### Health Monitoring

Render cung cấp:
- Uptime monitoring
- Performance metrics
- Error tracking
- Automatic restarts

### Backup Strategy

- **Automatic**: Render tự động backup daily
- **Manual**: Có thể tạo backup thủ công
- **Retention**: 7 days (starter), 30 days (standard)

### Scaling

Khi cần scale:
1. Upgrade database plan (more storage/connections)
2. Upgrade web service plan (more RAM/CPU)
3. Add multiple instances (load balancing)

## 🚀 Next Steps

Sau khi deploy thành công:

1. **Setup monitoring**: Configure alerts
2. **Backup strategy**: Setup additional backups
3. **Performance tuning**: Optimize queries
4. **Security**: Review security settings
5. **Documentation**: Update API documentation

## 📞 Support

Nếu gặp vấn đề:
1. Kiểm tra Render documentation
2. Xem logs trong Render dashboard
3. Test local với PostgreSQL
4. Contact Render support (nếu cần)

---

**🎉 Chúc mừng! Bạn đã deploy thành công ứng dụng với PostgreSQL trên Render!**