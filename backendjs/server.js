require('dotenv').config();
process.env.TZ = 'Asia/Ho_Chi_Minh';
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const compression = require('compression');

const baziRoutes = require('./src/routes/bazi.routes');
const consultantRoutes = require('./src/routes/consultant.routes');
const adminRoutes = require('./src/routes/admin.routes');
const authRoutes = require('./src/routes/auth.routes');
const articlesRoutes = require('./src/routes/articles.routes');
const queRoutes = require('./src/routes/que.routes');
// const dailyRoutes = require('./src/routes/daily.routes');

// Use PostgreSQL in production, SQLite in development
const dbService = process.env.NODE_ENV === 'production'
    ? require('./src/services/database.service.postgres')
    : require('./src/services/database.service');

const app = express();
const PORT = process.env.PORT || 8888;

// Rate limiting configurations
const generalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 500, // 500 requests per 15 minutes (increased for dev)
    message: { error: 'Quá nhiều request, vui lòng thử lại sau 15 phút' },
    standardHeaders: true,
    legacyHeaders: false,
});

const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 50, // Increased to 50 login/register/auth attempts
    message: { error: 'Quá nhiều lần thử đăng nhập, vui lòng thử lại sau 15 phút' },
    standardHeaders: true,
    legacyHeaders: false,
});

const aiLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 15, // 15 AI requests per minute (increased from 5)
    message: { error: 'Quá nhiều request AI, vui lòng chờ 1 phút' },
    standardHeaders: true,
    legacyHeaders: false,
});

// Middleware
app.use(helmet());
app.use(compression());
app.use(cors());
app.use(express.json({ limit: '5mb' })); // Increased limit for large chart data
app.use(generalLimiter); // Apply general rate limit to all routes

// Trust proxy for real IP behind Nginx/Cloudflare
app.set('trust proxy', true);


// Access logging middleware
app.use((req, res, next) => {
    const startTime = Date.now();

    // Extract real IP (handles X-Forwarded-For from reverse proxy)
    const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim()
        || req.headers['x-real-ip']
        || req.ip
        || req.socket?.remoteAddress
        || 'unknown';

    // Console log for dev
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url} - IP: ${ip}`);

    // Hook into response finish to capture status code + response time
    res.on('finish', () => {
        // Skip static assets and health checks to reduce noise
        if (req.url === '/' || req.url === '/api/docs' || req.url.startsWith('/assets')) return;

        const responseTime = Date.now() - startTime;
        dbService.saveAccessLog({
            ip,
            method: req.method,
            path: req.url,
            statusCode: res.statusCode,
            userAgent: req.headers['user-agent'] || '',
            userId: req.user?.id || null,
            userEmail: req.user?.email || null,
            responseTime
        });
    });

    next();
});

// Routes
app.use('/api', baziRoutes);
app.use('/api/consultant', consultantRoutes);  // Removed global aiLimiter, will apply per-route
app.use('/api/admin', adminRoutes);
app.use('/api/auth', authLimiter, authRoutes);  // Strict auth rate limit
app.use('/api/articles', articlesRoutes);  // Articles routes
app.use('/api/que', queRoutes);
// app.use('/api/daily', dailyRoutes);


// Health check
app.get('/', (req, res) => {
    res.json({
        name: 'BaZi Mega-Evolution API',
        version: '2.1',
        status: 'running',
        docs: '/api/docs'
    });
});

// API Documentation
app.get('/api/docs', (req, res) => {
    res.json({
        endpoints: [
            { method: 'GET', path: '/api/analyze', description: 'Full BaZi analysis' },
            { method: 'GET', path: '/api/chart', description: 'Basic chart info' },
            { method: 'GET', path: '/api/elements', description: 'Ngũ hành analysis' },
            { method: 'GET', path: '/api/stars', description: 'Thần sát analysis' },
            { method: 'GET', path: '/api/luck-cycles', description: 'Đại vận analysis' },
            { method: 'GET', path: '/api/year-analysis', description: 'Lưu niên analysis' },
            { method: 'GET', path: '/api/auspicious-dates', description: 'Ngày tốt xấu' },
            { method: 'POST', path: '/api/consultant/ask', description: 'AI Consultant Q&A' },
            { method: 'GET', path: '/api/consultant/stats', description: 'Thống kê tư vấn' },
            { method: 'GET', path: '/api/consultant/customers', description: 'Danh sách khách hàng' },
            { method: 'GET', path: '/api/consultant/history/:id', description: 'Lịch sử tư vấn khách hàng' },
        ],
        parameters: {
            year: 'number (required)',
            month: 'number (required)',
            day: 'number (required)',
            hour: 'number (default: 12)',
            minute: 'number (default: 0)',
            gender: 'string: "Nam" | "Nữ" (default: "Nam")',
            calendar: 'string: "solar" | "lunar" (default: "solar")'
        }
    });
});

// Error handler
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ error: 'Internal server error', message: err.message });
});

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\n[SHUTDOWN] Closing database connection...');
    dbService.close();
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log('\n[SHUTDOWN] Closing database connection...');
    dbService.close();
    process.exit(0);
});

process.once('SIGUSR2', () => {
    console.log('\n[RESTART] Closing database connection before nodemon restart...');
    dbService.close();
    // Allow a small delay for OS to sync file
    setTimeout(() => {
        process.kill(process.pid, 'SIGUSR2');
    }, 100);
});

// Initialize database and start server
(async () => {
    try {
        await dbService.init();
        console.log('[STARTUP] Database initialized successfully.');

        app.listen(PORT, () => {
            console.log(`🚀 BaZi Mega-Evolution API running on port ${PORT}`);
            console.log(`📚 API Docs: http://localhost:${PORT}/api/docs`);
            console.log(`💾 Database: ${process.env.NODE_ENV === 'production' ? 'PostgreSQL (Supabase)' : 'SQLite (Development)'}`);

            // Auto-cleanup old access logs (>30 days)
            dbService.cleanOldAccessLogs(30).catch(() => { });
        });
    } catch (error) {
        console.error('[STARTUP] Critical Error: Failed to initialize database:', error.message);
        process.exit(1);
    }
})();

module.exports = app;

