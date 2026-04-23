# 🆓 Hướng dẫn Deploy MIỄN PHÍ với SQLite

## 🎯 Tổng quan

Hướng dẫn này sẽ giúp bạn deploy ứng dụng tinix-bazi **HOÀN TOÀN MIỄN PHÍ** sử dụng SQLite với persistent storage trên Render.

## ✅ Lợi ích

- 🆓 **Hoàn toàn miễn phí** - không mất phí hàng tháng
- 💾 **Dữ liệu persistent** - không bị mất khi restart
- 🚀 **Deploy nhanh** - không cần setup database riêng
- 🔧 **Dễ maintain** - SQLite đơn giản, ít phức tạp

## ⚠️ Hạn chế

- 😴 **Sleep sau 15 phút** - free tier tự động sleep
- 🐌 **Cold start** - mất 10-30s để wake up
- 👥 **Concurrent users hạn chế** - SQLite không tối ưu cho nhiều users cùng lúc
- 📊 **Performance** - chậm hơn PostgreSQL cho queries phức tạp

## 🚀 Bước 1: Chuẩn bị Code

### 1.1 Kiểm tra render.yaml

File đã được cấu hình cho free tier:

```yaml
services:
  - type: web
    name: huyenhoc
    runtime: node
    plan: free  # FREE TIER
    
    envVars:
      - key: USE_SQLITE
        value: "true"  # Force SQLite usage
      - key: NODE_ENV
        value: production
    
    # Persistent disk for SQLite (FREE)
    disk:
      name: bazi-sqlite-data
      mountPath: /opt/render/project/src/backendjs/data
      sizeGB: 1  # 1GB free storage
```

### 1.2 Test local trước khi deploy

```bash
cd tinix-bazi/backendjs

# Test với SQLite forced
set USE_SQLITE=true
set NODE_ENV=production
npm start

# Kiểm tra health
curl http://localhost:8888/health
```

Expected response:
```json
{
  "status": "ok",
  "database": {
    "status": "healthy",
    "database": "SQLite"
  }
}
```

## 🌐 Bước 2: Deploy lên Render

### 2.1 Push code lên GitHub

```bash
git add .
git commit -m "Configure for free SQLite deployment on Render"
git push origin main
```

### 2.2 Tạo Render service

1. Đăng nhập https://render.com
2. Click **"New +"** → **"Web Service"**
3. Connect GitHub repository `tinix-bazi`
4. Render sẽ tự động đọc `render.yaml`

### 2.3 Cấu hình tự động

Render sẽ tự động:
- Tạo persistent disk 1GB (free)
- Mount disk vào `/opt/render/project/src/backendjs/data`
- Set `USE_SQLITE=true`
- Deploy với free plan

## 📊 Bước 3: Kiểm tra Deploy

### 3.1 Theo dõi logs

Trong Render dashboard:
1. Vào service `huyenhoc`
2. Click tab **"Logs"**
3. Xem deployment progress

Expected logs:
```
[DatabaseFactory] USE_SQLITE flag detected, using SQLite for all environments
[DB] Connected to SQLite database.
[DB] Applied: journal_mode
🚀 BaZi Mega-Evolution API running on port 10000
💾 Database: SQLite (Development)
```

### 3.2 Test endpoints

```bash
# Health check
curl https://huyenhoc.onrender.com/health

# Metrics
curl https://huyenhoc.onrender.com/metrics

# API docs
curl https://huyenhoc.onrender.com/api/docs
```

## 🔧 Bước 4: Tối ưu cho Free Tier

### 4.1 Keep-alive service (Optional)

Tạo simple cron job để ping service mỗi 10 phút:

```bash
# Sử dụng cron-job.org (free)
# URL: https://huyenhoc.onrender.com/health
# Interval: */10 * * * * (every 10 minutes)
```

### 4.2 Optimize cold start

Thêm vào `server.js`:

```javascript
// Optimize for cold start
if (process.env.NODE_ENV === 'production') {
    // Preload critical modules
    require('./src/services/database.factory');
    
    // Warm up database connection
    setTimeout(async () => {
        try {
            await dbService.healthCheck();
            console.log('[WARMUP] Database warmed up');
        } catch (error) {
            console.log('[WARMUP] Database warmup failed:', error.message);
        }
    }, 1000);
}
```

## 📈 Monitoring Free Tier

### 4.3 Uptime monitoring

Sử dụng free services:
- **UptimeRobot** (free): 50 monitors
- **Pingdom** (free): 1 monitor
- **StatusCake** (free): 10 monitors

### 4.4 Performance monitoring

```javascript
// Thêm vào server.js
app.get('/stats', async (req, res) => {
    const stats = await dbService.getStats();
    res.json({
        ...stats,
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        timestamp: new Date()
    });
});
```

## 🎯 Bước 5: Backup Strategy (Free)

### 5.1 GitHub backup

Tạo script backup SQLite to GitHub:

```javascript
// backup-to-github.js
const fs = require('fs');
const path = require('path');

async function backupToGitHub() {
    const dbPath = path.join(__dirname, 'data/bazi_consultant.db');
    const backupPath = path.join(__dirname, 'backups');
    
    if (!fs.existsSync(backupPath)) {
        fs.mkdirSync(backupPath, { recursive: true });
    }
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFile = path.join(backupPath, `backup_${timestamp}.db`);
    
    fs.copyFileSync(dbPath, backupFile);
    console.log(`Backup created: ${backupFile}`);
}

// Run backup
if (require.main === module) {
    backupToGitHub();
}
```

### 5.2 Scheduled backup

Thêm vào `package.json`:

```json
{
  "scripts": {
    "backup": "node backup-to-github.js",
    "start": "node server.js"
  }
}
```

## 🚨 Troubleshooting

### Lỗi thường gặp

**1. Service sleep quá nhanh**
```bash
# Solution: Setup keep-alive ping
# Hoặc upgrade lên paid plan ($7/month)
```

**2. Database file không persistent**
```bash
# Kiểm tra disk mount
ls -la /opt/render/project/src/backendjs/data/

# Kiểm tra logs
tail -f /var/log/render.log
```

**3. Cold start chậm**
```bash
# Optimize: Preload modules
# Reduce dependencies
# Use keep-alive service
```

**4. SQLite locked**
```bash
# Restart service trong Render dashboard
# Hoặc wait 30 seconds cho lock timeout
```

## 📊 Performance Expectations

### Free Tier Limits

- **RAM**: 512MB
- **CPU**: Shared
- **Storage**: 1GB persistent disk
- **Bandwidth**: 100GB/month
- **Sleep**: After 15 minutes inactive
- **Cold start**: 10-30 seconds

### Concurrent Users

- **Optimal**: 1-5 users
- **Acceptable**: 5-20 users
- **Limit**: 50+ users (sẽ chậm)

## 💡 Tips để tối ưu

### Performance Tips

1. **Enable SQLite optimizations**:
   ```sql
   PRAGMA journal_mode = WAL;
   PRAGMA synchronous = NORMAL;
   PRAGMA cache_size = -64000;
   ```

2. **Add database indexes**:
   ```sql
   CREATE INDEX IF NOT EXISTS idx_customers_birth ON customers(year, month, day);
   CREATE INDEX IF NOT EXISTS idx_consultations_customer ON consultations(customer_id);
   ```

3. **Connection pooling**:
   ```javascript
   // SQLite không cần connection pool
   // Nhưng có thể cache queries
   ```

### Cost Optimization

- **Free tier**: $0/month
- **Keep-alive service**: $0 (sử dụng free cron services)
- **Monitoring**: $0 (sử dụng free uptime monitors)
- **Backup**: $0 (GitHub storage)

**Total cost: $0/month** 🎉

## 🎯 Khi nào nên upgrade?

Upgrade lên paid plan khi:
- Traffic > 1000 requests/day
- Cần uptime > 95%
- Concurrent users > 20
- Database size > 500MB
- Cần performance tốt hơn

## 🚀 Next Steps

Sau khi deploy free thành công:

1. **Setup monitoring**: UptimeRobot, Pingdom
2. **Configure backup**: GitHub, Google Drive
3. **Optimize performance**: Indexes, caching
4. **Monitor usage**: Traffic, database size
5. **Plan scaling**: Khi nào cần upgrade

---

**🎉 Chúc mừng! Bạn đã có website hoàn toàn miễn phí với SQLite!**

**URL của bạn**: https://huyenhoc.onrender.com