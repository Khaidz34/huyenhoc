/**
 * PostgreSQL Database Service using pg driver
 * Optimized for Render PostgreSQL deployment
 * Implements DatabaseServiceInterface
 */

const { Pool } = require('pg');
const DatabaseServiceInterface = require('./database.interface');

class PostgreSQLAdapter extends DatabaseServiceInterface {
    constructor() {
        super(); // Call parent constructor
        this.pool = null;
        this.isInitialized = false;
        this.connectionRetries = 0;
        this.maxRetries = 3;
        this.retryDelay = 2000; // 2 seconds
        this.healthStatus = 'unknown';
        this.lastHealthCheck = null;
    }

    /**
     * Initialize database connection pool with retry mechanism
     */
    async init() {
        if (this.isInitialized && this.pool) {
            return Promise.resolve();
        }

        return this._initWithRetry();
    }

    /**
     * Initialize with retry mechanism
     */
    async _initWithRetry() {
        try {
            const DATABASE_URL = process.env.DATABASE_URL;
            
            if (!DATABASE_URL) {
                throw new Error('DATABASE_URL environment variable is required for PostgreSQL');
            }

            console.log('[DB] Initializing PostgreSQL connection...');

            // Parse connection details from DATABASE_URL for logging
            const url = new URL(DATABASE_URL.replace('postgresql://', 'postgres://'));
            
            console.log('[DB] Connecting to:', {
                hostname: url.hostname,
                port: url.port || '5432',
                database: url.pathname.slice(1),
                username: url.username
            });
            
            // Create connection pool
            this.pool = new Pool({
                connectionString: DATABASE_URL,
                ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
                max: 20,                    // Maximum connections
                idleTimeoutMillis: 30000,   // Close idle connections after 30s
                connectionTimeoutMillis: 15000, // Connection timeout
                statement_timeout: 30000,   // Query timeout
                query_timeout: 30000,       // Query timeout
            });

            // Test connection with retry logic
            let connected = false;
            
            while (this.connectionRetries < this.maxRetries && !connected) {
                try {
                    console.log(`[DB] Testing connection (attempt ${this.connectionRetries + 1}/${this.maxRetries})...`);
                    const client = await this.pool.connect();
                    const result = await client.query('SELECT NOW() as current_time, version() as pg_version');
                    client.release();
                    
                    console.log('[DB] ✅ Connected to PostgreSQL database successfully!');
                    console.log('[DB] Current time:', result.rows[0].current_time);
                    console.log('[DB] PostgreSQL version:', result.rows[0].pg_version.split(' ')[0]);
                    
                    connected = true;
                    this.connectionRetries = 0;
                    this.healthStatus = 'healthy';
                    this.lastHealthCheck = new Date();
                    
                    // Create tables if they don't exist
                    await this.createTables();
                    
                    this.isInitialized = true;
                    
                } catch (error) {
                    this.connectionRetries++;
                    console.log(`[DB] Connection attempt failed: ${error.message}`);
                    
                    if (error.code === 'ETIMEDOUT' || error.message.includes('timeout')) {
                        console.log('[DB] ⚠️  Connection timeout - Database might be starting up');
                    } else if (error.code === 'ENETUNREACH' || error.message.includes('ENETUNREACH')) {
                        console.log('[DB] ⚠️  Network unreachable - Check database availability');
                    }
                    
                    if (this.connectionRetries < this.maxRetries) {
                        console.log(`[DB] Retrying in ${this.retryDelay}ms... (${this.maxRetries - this.connectionRetries} attempts left)`);
                        await new Promise(resolve => setTimeout(resolve, this.retryDelay * this.connectionRetries)); // Exponential backoff
                    }
                }
            }
            
            if (!connected) {
                this.healthStatus = 'error';
                throw new Error(`Failed to connect to PostgreSQL after ${this.maxRetries} attempts`);
            }

            console.log('[DB] PostgreSQL database initialized successfully.');
            
        } catch (error) {
            console.error('[DB] Failed to initialize PostgreSQL database:', error.message);
            this.healthStatus = 'error';
            throw error;
        }
    }

    /**
     * Create tables if they don't exist (PostgreSQL version)
     */
    async createTables() {
        console.log('[DB] Creating tables if they don\'t exist...');
        
        // Customers table
        await this.run(`
            CREATE TABLE IF NOT EXISTS customers (
                id SERIAL PRIMARY KEY,
                name TEXT,
                year INTEGER NOT NULL,
                month INTEGER NOT NULL,
                day INTEGER NOT NULL,
                hour INTEGER DEFAULT 12,
                minute INTEGER DEFAULT 0,
                gender TEXT DEFAULT 'Nam',
                calendar TEXT DEFAULT 'solar',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Consultations table
        await this.run(`
            CREATE TABLE IF NOT EXISTS consultations (
                id SERIAL PRIMARY KEY,
                customer_id INTEGER,
                theme_id TEXT,
                question_id TEXT NOT NULL,
                question_text TEXT,
                answer TEXT,
                use_ai BOOLEAN DEFAULT true,
                credits_used INTEGER DEFAULT 0,
                user_id INTEGER,
                persona TEXT DEFAULT 'huyen_co',
                follow_ups TEXT,
                person1_data TEXT,
                person2_data TEXT,
                metadata TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (customer_id) REFERENCES customers(id)
            )
        `);

        // Users table
        await this.run(`
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                email TEXT UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                name TEXT,
                credits INTEGER DEFAULT 100,
                is_admin BOOLEAN DEFAULT false,
                bazi_data TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                last_login TIMESTAMP
            )
        `);

        // Sessions table
        await this.run(`
            CREATE TABLE IF NOT EXISTS sessions (
                token TEXT PRIMARY KEY,
                user_id INTEGER NOT NULL,
                user_data TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                expires_at TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id)
            )
        `);

        // Credit transactions table
        await this.run(`
            CREATE TABLE IF NOT EXISTS credit_transactions (
                id SERIAL PRIMARY KEY,
                user_id INTEGER NOT NULL,
                amount INTEGER NOT NULL,
                type TEXT NOT NULL,
                description TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id)
            )
        `);

        // Credit requests table
        await this.run(`
            CREATE TABLE IF NOT EXISTS credit_requests (
                id SERIAL PRIMARY KEY,
                user_id INTEGER NOT NULL,
                amount INTEGER DEFAULT 100,
                status TEXT DEFAULT 'pending',
                admin_note TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                processed_at TIMESTAMP,
                processed_by INTEGER,
                FOREIGN KEY (user_id) REFERENCES users(id)
            )
        `);

        // Question categories table
        await this.run(`
            CREATE TABLE IF NOT EXISTS question_categories (
                id SERIAL PRIMARY KEY,
                name TEXT NOT NULL,
                icon TEXT DEFAULT '📋',
                order_index INTEGER DEFAULT 0,
                is_active BOOLEAN DEFAULT true,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Custom questions table
        await this.run(`
            CREATE TABLE IF NOT EXISTS custom_questions (
                id SERIAL PRIMARY KEY,
                category_id INTEGER,
                text TEXT NOT NULL,
                is_active BOOLEAN DEFAULT true,
                order_index INTEGER DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (category_id) REFERENCES question_categories(id)
            )
        `);

        // Article categories table
        await this.run(`
            CREATE TABLE IF NOT EXISTS article_categories (
                id SERIAL PRIMARY KEY,
                name TEXT NOT NULL,
                slug TEXT UNIQUE NOT NULL,
                description TEXT,
                order_index INTEGER DEFAULT 0,
                is_active BOOLEAN DEFAULT true,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Articles table
        await this.run(`
            CREATE TABLE IF NOT EXISTS articles (
                id SERIAL PRIMARY KEY,
                title TEXT NOT NULL,
                slug TEXT UNIQUE NOT NULL,
                excerpt TEXT,
                content TEXT NOT NULL,
                thumbnail TEXT,
                category_id INTEGER,
                author TEXT DEFAULT 'Huyền Cơ Bát Tự',
                views INTEGER DEFAULT 0,
                is_published BOOLEAN DEFAULT true,
                is_featured BOOLEAN DEFAULT false,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (category_id) REFERENCES article_categories(id)
            )
        `);

        // Que history table
        await this.run(`
            CREATE TABLE IF NOT EXISTS que_history (
                id SERIAL PRIMARY KEY,
                user_id INTEGER,
                customer_id INTEGER,
                context_id TEXT,
                bazi_params TEXT,
                que_type TEXT NOT NULL,
                period_key TEXT NOT NULL,
                gua_number INTEGER,
                gua_name TEXT,
                gua_data TEXT,
                user_note TEXT,
                is_verified BOOLEAN DEFAULT false,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Access logs table
        await this.run(`
            CREATE TABLE IF NOT EXISTS access_logs (
                id SERIAL PRIMARY KEY,
                ip TEXT,
                method TEXT,
                path TEXT,
                status_code INTEGER,
                user_agent TEXT,
                user_id INTEGER,
                user_email TEXT,
                response_time INTEGER,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Create indexes
        await this.run(`CREATE INDEX IF NOT EXISTS idx_consultations_customer ON consultations(customer_id)`);
        await this.run(`CREATE INDEX IF NOT EXISTS idx_consultations_user ON consultations(user_id)`);
        await this.run(`CREATE INDEX IF NOT EXISTS idx_customers_birth ON customers(year, month, day)`);
        await this.run(`CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)`);
        await this.run(`CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token)`);
        await this.run(`CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id)`);
        await this.run(`CREATE INDEX IF NOT EXISTS idx_access_logs_created ON access_logs(created_at)`);
        await this.run(`CREATE INDEX IF NOT EXISTS idx_access_logs_ip ON access_logs(ip)`);
        await this.run(`CREATE INDEX IF NOT EXISTS idx_questions_category ON custom_questions(category_id)`);
        await this.run(`CREATE INDEX IF NOT EXISTS idx_credit_trans_user ON credit_transactions(user_id)`);
        await this.run(`CREATE INDEX IF NOT EXISTS idx_credit_requests_status ON credit_requests(status)`);
        await this.run(`CREATE INDEX IF NOT EXISTS idx_articles_slug ON articles(slug)`);
        await this.run(`CREATE INDEX IF NOT EXISTS idx_articles_category ON articles(category_id)`);
        await this.run(`CREATE INDEX IF NOT EXISTS idx_articles_published ON articles(is_published)`);
        await this.run(`CREATE INDEX IF NOT EXISTS idx_article_categories_slug ON article_categories(slug)`);
        await this.run(`CREATE INDEX IF NOT EXISTS idx_que_history_lookup ON que_history(user_id, que_type, period_key, context_id)`);

        console.log('[DB] All tables and indexes created/verified.');

        // Seed default data
        await this.initDefaultAdmins();
        await this.initDefaultCategories();
        await this.initDefaultArticleCategories();
    }

    async initDefaultAdmins() {
        const admins = [
            { email: 'admin@huyencobattu.vn', hash: '8c6976e5b5410415bde908bd4dee15dfb167a9c873fc4bb8a81f6f2ab448a918', name: 'Administrator' },
            { email: 'admin@admin.com', hash: '8c6976e5b5410415bde908bd4dee15dfb167a9c873fc4bb8a81f6f2ab448a918', name: 'System Admin' }
        ];
        for (const admin of admins) {
            const email = admin.email.toLowerCase().trim();
            const exists = await this.get(`SELECT id FROM users WHERE LOWER(email) = $1`, [email]);
            if (!exists) {
                console.log(`[DB] Creating admin: ${email}`);
                await this.run(`
                    INSERT INTO users (email, password_hash, name, credits, is_admin)
                    VALUES ($1, $2, $3, 9999, true)
                `, [email, admin.hash, admin.name]);
            }
        }
    }

    async initDefaultCategories() {
        const row = await this.get(`SELECT COUNT(*) as count FROM question_categories`);
        if (parseInt(row?.count || 0) > 0) return;

        console.log('[DB] Initializing default question categories...');
        const defaultCategories = [
            { name: 'Công danh', icon: '🏛️', order_index: 1, mapKey: 'career' },
            { name: 'Tình duyên', icon: '❤️', order_index: 2, mapKey: 'love' },
            { name: 'Tài lộc', icon: '💰', order_index: 3, mapKey: 'wealth' },
            { name: 'Sức khỏe', icon: '🏥', order_index: 4, mapKey: 'health' },
            { name: 'Con cái', icon: '👶', order_index: 5, mapKey: 'children' },
            { name: 'Đồng nghiệp', icon: '👥', order_index: 6, mapKey: 'colleagues' },
            { name: 'Hợp tác', icon: '🤝', order_index: 7, mapKey: 'partnership' },
            { name: 'Tai họa', icon: '🌪️', order_index: 8, mapKey: 'misfortune' }
        ];
        const categoryIds = {};
        for (const cat of defaultCategories) {
            const result = await this.run(`
                INSERT INTO question_categories (name, icon, order_index, is_active)
                VALUES ($1, $2, $3, true) RETURNING id
            `, [cat.name, cat.icon, cat.order_index]);
            categoryIds[cat.mapKey] = result.id;
        }
        console.log('[DB] Default categories initialized');
        await this.initDefaultQuestions(categoryIds);
    }

    async initDefaultQuestions(categoryIds) {
        const row = await this.get(`SELECT COUNT(*) as count FROM custom_questions`);
        if (parseInt(row?.count || 0) > 0) return;
        console.log('[DB] Initializing default questions...');
        try {
            const { QUESTIONS } = require('../bazi/questions/data');
            let totalQuestions = 0;
            for (const [themeKey, questions] of Object.entries(QUESTIONS)) {
                const categoryId = categoryIds[themeKey];
                if (!categoryId) continue;
                let orderIndex = 1;
                for (const q of questions) {
                    await this.run(`
                        INSERT INTO custom_questions (category_id, text, order_index, is_active)
                        VALUES ($1, $2, $3, true)
                    `, [categoryId, q.text || '', orderIndex]);
                    orderIndex++;
                    totalQuestions++;
                }
            }
            console.log(`[DB] Initialized ${totalQuestions} default questions`);
        } catch (error) {
            console.error('[DB] Error initializing questions:', error.message);
        }
    }

    async initDefaultArticleCategories() {
        const row = await this.get(`SELECT COUNT(*) as count FROM article_categories`);
        if (parseInt(row?.count || 0) > 0) return;
        console.log('[DB] Initializing default article categories...');
        const categories = [
            { name: 'Kiến Thức Bát Tự', slug: 'kien-thuc-bat-tu', description: 'Tổng hợp kiến thức về Bát Tự', order_index: 1 },
            { name: 'Ngũ Hành', slug: 'ngu-hanh', description: 'Phân tích Ngũ Hành', order_index: 2 },
            { name: 'Can Chi', slug: 'can-chi', description: 'Thiên Can Địa Chi', order_index: 3 },
            { name: 'Vận Hạn', slug: 'van-han', description: 'Đại Vận Lưu Niên', order_index: 4 },
            { name: 'Phong Thủy', slug: 'phong-thuy', description: 'Phong thủy ứng dụng', order_index: 5 }
        ];
        for (const cat of categories) {
            await this.run(`
                INSERT INTO article_categories (name, slug, description, order_index, is_active)
                VALUES ($1, $2, $3, $4, true)
                ON CONFLICT (slug) DO NOTHING
            `, [cat.name, cat.slug, cat.description, cat.order_index]);
        }
        console.log('[DB] Default article categories initialized');
    }

    /**
     * Health check method
     */
    async healthCheck() {
        try {
            const startTime = Date.now();
            const result = await this.get('SELECT 1 as test, NOW() as current_time');
            const responseTime = Date.now() - startTime;
            
            this.healthStatus = 'healthy';
            this.lastHealthCheck = new Date();
            
            return {
                status: 'healthy',
                responseTime,
                lastCheck: this.lastHealthCheck,
                database: 'PostgreSQL',
                currentTime: result.current_time
            };
        } catch (error) {
            this.healthStatus = 'error';
            this.lastHealthCheck = new Date();
            
            console.error('[DB] Health check failed:', error.message);
            
            // Attempt reconnection
            try {
                await this.init();
                return await this.healthCheck(); // Retry health check
            } catch (reconnectError) {
                return {
                    status: 'error',
                    error: error.message,
                    lastCheck: this.lastHealthCheck,
                    database: 'PostgreSQL'
                };
            }
        }
    }

    /**
     * Get current health status
     */
    getHealthStatus() {
        return {
            status: this.healthStatus,
            lastCheck: this.lastHealthCheck,
            isInitialized: this.isInitialized,
            database: 'PostgreSQL'
        };
    }

    /**
     * Run a query that doesn't return data (CREATE, INSERT, UPDATE, DELETE)
     */
    async run(sql, params = []) {
        const client = await this.pool.connect();
        try {
            const result = await client.query(sql, params);
            return { id: result.rows[0]?.id, changes: result.rowCount };
        } catch (error) {
            console.error('[DB] Error running sql:', sql);
            console.error(error);
            throw error;
        } finally {
            client.release();
        }
    }

    /**
     * Get first row result
     */
    async get(sql, params = []) {
        const client = await this.pool.connect();
        try {
            const result = await client.query(sql, params);
            return result.rows[0] || null;
        } catch (error) {
            console.error('[DB] Error running sql:', sql);
            throw error;
        } finally {
            client.release();
        }
    }

    /**
     * Get all rows
     */
    async all(sql, params = []) {
        const client = await this.pool.connect();
        try {
            const result = await client.query(sql, params);
            return result.rows || [];
        } catch (error) {
            console.error('[DB] Error running sql:', sql);
            throw error;
        } finally {
            client.release();
        }
    }

    /**
     * Close database connection pool
     */
    async close() {
        if (this.pool) {
            await this.pool.end();
            console.log('[DB] Database connection pool closed.');
        }
    }

    // ========== CUSTOMERS ==========

    async findOrCreateCustomer(userData) {
        const { name, year, month, day, hour, minute, gender, calendar } = userData;

        const existing = await this.get(`
            SELECT id FROM customers 
            WHERE year = $1 AND month = $2 AND day = $3 AND hour = $4 AND minute = $5
            LIMIT 1
        `, [year, month, day, hour || 12, minute || 0]);

        if (existing) {
            if (name) {
                await this.run(`UPDATE customers SET name = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`, [name, existing.id]);
            }
            return existing.id;
        }

        const safeName = name || 'Mệnh chủ';
        const result = await this.run(`
            INSERT INTO customers (name, year, month, day, hour, minute, gender, calendar)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            RETURNING id
        `, [safeName, year, month, day, hour || 12, minute || 0, gender || 'Nam', calendar || 'solar']);

        console.log(`[DB] Customer #${result.id} created`);
        return result.id;
    }

    async createNewCustomer(userData) {
        const { name, year, month, day, hour, minute, gender, calendar } = userData;
        const safeName = name || 'Mệnh chủ';

        const result = await this.run(`
            INSERT INTO customers (name, year, month, day, hour, minute, gender, calendar)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            RETURNING id
        `, [safeName, year, month, day, hour || 12, minute || 0, gender || 'Nam', calendar || 'solar']);

        return result.id;
    }

    async getCustomer(customerId) {
        return this.get(`SELECT * FROM customers WHERE id = $1`, [customerId]);
    }

    async getAllCustomers(limit = 100) {
        return this.all(`
            SELECT c.*, COUNT(con.id) as consultation_count
            FROM customers c
            LEFT JOIN consultations con ON c.id = con.customer_id
            GROUP BY c.id
            ORDER BY c.updated_at DESC
            LIMIT $1
        `, [limit]);
    }

    async getRecentCustomersWithQuestions(limit = 10) {
        return this.all(`
            SELECT 
                c.id, c.name, c.year, c.month, c.day, c.hour, c.minute, c.gender,
                MAX(con.created_at) as last_activity,
                (SELECT question_text FROM consultations WHERE customer_id = c.id ORDER BY created_at DESC LIMIT 1) as last_question,
                (SELECT created_at FROM consultations WHERE customer_id = c.id ORDER BY created_at DESC LIMIT 1) as consultation_time
            FROM customers c
            JOIN consultations con ON c.id = con.customer_id
            GROUP BY c.id
            ORDER BY last_activity DESC
            LIMIT $1
        `, [limit]);
    }

    // ========== CONSULTATIONS ==========

    async saveConsultation(customerId, themeId, questionId, questionText, answer, useAI = true, creditsUsed = 0, userId = null, persona = 'huyen_co', followUps = [], extraData = {}) {
        const answerJson = (typeof answer === 'object' && answer !== null) ? JSON.stringify(answer) : answer;
        const followUpsJson = JSON.stringify(followUps);
        const person1Data = extraData.person1 ? JSON.stringify(extraData.person1) : null;
        const person2Data = extraData.person2 ? JSON.stringify(extraData.person2) : null;
        const metadata = extraData.metadata ? JSON.stringify(extraData.metadata) : null;

        const result = await this.run(`
            INSERT INTO consultations (
                customer_id, theme_id, question_id, question_text, answer, 
                use_ai, credits_used, user_id, persona, follow_ups,
                person1_data, person2_data, metadata
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
            RETURNING id
        `, [
            customerId, themeId || '', questionId, questionText || '', answerJson || '',
            useAI ? 1 : 0, creditsUsed, userId, persona, followUpsJson,
            person1Data, person2Data, metadata
        ]);

        console.log(`[DB] Consultation #${result.id} saved`);
        return result.id;
    }

    async getUserHistory(userId, limit = 20) {
        const rows = await this.all(`
            SELECT id, question_id, question_text, answer, use_ai, credits_used, created_at, persona, follow_ups, person1_data, person2_data, metadata
            FROM consultations
            WHERE user_id = $1
            ORDER BY created_at DESC
            LIMIT $2
        `, [userId, limit]);

        return rows.map(row => {
            try { row.answer = JSON.parse(row.answer || '[]'); } catch { }
            try { row.follow_ups = JSON.parse(row.follow_ups || '[]'); } catch { }
            try { row.person1_data = JSON.parse(row.person1_data || 'null'); } catch { }
            try { row.person2_data = JSON.parse(row.person2_data || 'null'); } catch { }
            try { row.metadata = JSON.parse(row.metadata || 'null'); } catch { }
            return row;
        });
    }

    async getCustomerHistory(customerId, limit = 50) {
        const rows = await this.all(`
            SELECT id, question_id, question_text, answer, use_ai, created_at, persona, follow_ups
            FROM consultations
            WHERE customer_id = $1
            ORDER BY created_at DESC
            LIMIT $2
        `, [customerId, limit]);

        return rows.map(row => {
            try { row.answer = JSON.parse(row.answer || '[]'); } catch { row.answer = []; }
            return row;
        });
    }

    // ========== STATISTICS ==========

    async getStats() {
        const totalCustomers = await this.get(`SELECT COUNT(*) as count FROM customers`);
        const totalConsultations = await this.get(`SELECT COUNT(*) as count FROM consultations`);
        const aiConsultations = await this.get(`SELECT COUNT(*) as count FROM consultations WHERE use_ai = 1`);
        const todayConsultations = await this.get(`SELECT COUNT(*) as count FROM consultations WHERE DATE(created_at) = CURRENT_DATE`);

        return {
            totalCustomers: totalCustomers?.count || 0,
            totalConsultations: totalConsultations?.count || 0,
            aiConsultations: aiConsultations?.count || 0,
            todayConsultations: todayConsultations?.count || 0
        };
    }

    async getDailyConsultationStats() {
        try {
            return this.all(`
                WITH RECURSIVE days(date) AS (
                    SELECT CURRENT_DATE - INTERVAL '6 days'
                    UNION ALL
                    SELECT date + INTERVAL '1 day' FROM days WHERE date < CURRENT_DATE
                )
                SELECT 
                    d.date::text,
                    COUNT(c.id) as count
                FROM days d
                LEFT JOIN consultations c ON DATE(c.created_at) = d.date
                GROUP BY d.date
                ORDER BY d.date ASC
            `);
        } catch (e) {
            console.error('[DB] Error fetching daily stats:', e.message);
            return [];
        }
    }

    async getConsultationByCategoryStats() {
        try {
            return this.all(`
                SELECT 
                    qc.name as label,
                    qc.icon,
                    COUNT(c.id) as value
                FROM question_categories qc
                LEFT JOIN consultations c ON c.theme_id = CAST(qc.id AS TEXT)
                GROUP BY qc.id, qc.name, qc.icon
                ORDER BY value DESC
            `);
        } catch (e) {
            console.error('[DB] Error fetching category stats:', e.message);
            return [];
        }
    }

    // ========== CATEGORIES & QUESTIONS ==========

    async getAllCategories() {
        return this.all(`SELECT * FROM question_categories ORDER BY order_index ASC`);
    }

    async getAllQuestions(categoryId = null) {
        let sql = `SELECT q.*, c.name as category_name FROM custom_questions q LEFT JOIN question_categories c ON q.category_id = c.id`;
        let params = [];
        if (categoryId) {
            sql += ` WHERE q.category_id = $1`;
            params.push(categoryId);
        }
        sql += ` ORDER BY q.order_index ASC`;
        return this.all(sql, params);
    }

    // ========== USERS & AUTHENTICATION ==========

    async createUser(email, passwordHash, name = '') {
        console.log(`[DB] Creating user: ${email}`);
        const existing = await this.getUserByEmail(email);
        if (existing) throw new Error('Email đã được sử dụng');

        try {
            const result = await this.run(`
                INSERT INTO users (email, password_hash, name, credits)
                VALUES ($1, $2, $3, 100)
                RETURNING id
            `, [email, passwordHash, name]);

            console.log(`[DB] User created: ${email} (ID: ${result.id})`);
            await this.logCreditTransaction(result.id, 100, 'INITIAL', 'Linh thạch khởi tạo');
            return result.id;
        } catch (error) {
            console.error(`[DB] Error creating user: ${error.message}`);
            throw error;
        }
    }

    async getUserByEmail(email) {
        return this.get(`SELECT * FROM users WHERE email = $1`, [email]);
    }

    async getUserById(id) {
        return this.get(`SELECT * FROM users WHERE id = $1`, [id]);
    }

    async deductCredits(userId, amount, description) {
        const user = await this.getUserById(userId);
        if (!user) throw new Error('User not found');
        if (user.credits < amount) throw new Error('Không đủ linh thạch');

        await this.run(`UPDATE users SET credits = credits - $1 WHERE id = $2`, [amount, userId]);
        await this.logCreditTransaction(userId, -amount, 'SPEND', description);
    }

    async updateUserBaziData(userId, data) {
        const dataJson = JSON.stringify(data);
        await this.run(`UPDATE users SET bazi_data = $1 WHERE id = $2`, [dataJson, userId]);
    }

    async updateUserProfile(userId, data) {
        const { name } = data;
        if (name) {
            await this.run(`UPDATE users SET name = $1 WHERE id = $2`, [name, userId]);
        }
    }

    async updateLastLogin(userId) {
        await this.run(`UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = $1`, [userId]);
    }

    // ========== SESSIONS ==========

    async getSession(token) {
        const session = await this.get(`SELECT * FROM sessions WHERE token = $1`, [token]);
        if (!session) return null;
        try { session.user = JSON.parse(session.user_data); } catch { session.user = null; }
        return session;
    }

    async createSession(token, userData) {
        const userDataJson = JSON.stringify(userData);
        await this.run(`
            INSERT INTO sessions (token, user_id, user_data, expires_at)
            VALUES ($1, $2, $3, CURRENT_TIMESTAMP + INTERVAL '7 days')
            ON CONFLICT (token) DO UPDATE SET user_data = $3
        `, [token, userData.id, userDataJson]);
    }

    async deleteSession(token) {
        await this.run(`DELETE FROM sessions WHERE token = $1`, [token]);
    }

    // ========== CREDIT MANAGEMENT ==========

    async logCreditTransaction(userId, amount, type, description) {
        await this.run(`
            INSERT INTO credit_transactions (user_id, amount, type, description)
            VALUES ($1, $2, $3, $4)
        `, [userId, amount, type, description]);
    }

    async createCreditRequest(userId, amount) {
        const result = await this.run(`
            INSERT INTO credit_requests (user_id, amount, status)
            VALUES ($1, $2, 'pending')
            RETURNING id
        `, [userId, amount]);
        return result.id;
    }

    async getUserPendingRequest(userId) {
        return this.get(`SELECT * FROM credit_requests WHERE user_id = $1 AND status = 'pending'`, [userId]);
    }

    async getLatestSuggestions(userId, limit = 5) {
        const rows = await this.all(`
            SELECT follow_ups FROM consultations 
            WHERE user_id = $1 
            ORDER BY created_at DESC LIMIT 5
        `, [userId]);

        let suggestions = [];
        for (const row of rows) {
            try {
                const questions = JSON.parse(row.follow_ups || '[]');
                if (Array.isArray(questions)) suggestions.push(...questions);
            } catch (e) { }
        }
        return [...new Set(suggestions)].slice(0, limit);
    }

    // ========== ACCESS LOGS ==========

    saveAccessLog(data) {
        const { ip, method, path, statusCode, userAgent, userId, userEmail, responseTime } = data;
        this.run(`
            INSERT INTO access_logs (ip, method, path, status_code, user_agent, user_id, user_email, response_time)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        `, [ip, method, path, statusCode, userAgent || '', userId || null, userEmail || null, responseTime || 0])
            .catch(err => console.error('[DB] Failed to save access log:', err.message));
    }

    async cleanOldAccessLogs(days = 30) {
        const result = await this.run(
            `DELETE FROM access_logs WHERE created_at < CURRENT_TIMESTAMP - INTERVAL '1 day' * $1`,
            [days]
        );
        if (result.changes > 0) {
            console.log(`[DB] Cleaned ${result.changes} access logs older than ${days} days.`);
        }
        return result.changes;
    }

    /**
     * Close database connection pool gracefully
     */
    async close() {
        return new Promise((resolve) => {
            if (this.pool) {
                this.pool.end(() => {
                    console.log('[DB] PostgreSQL connection pool closed.');
                    this.pool = null;
                    this.isInitialized = false;
                    this.healthStatus = 'closed';
                    resolve();
                });
            } else {
                resolve();
            }
        });
    }

    // ==========================================
    // MISSING METHODS ADDED AUTOMATICALLY
    // ==========================================



    async saveQue(data) {
        console.warn('[DB] saveQue is deprecated. Please use saveConsultation with metadata.');
    }



    async getQue(user_id, customer_id, context_id, que_type, period_key) {
        // Search in consultations using metadata
        // context_id is unique enough
        let sql = `
            SELECT * FROM consultations 
            WHERE theme_id = 'xin_que' 
            AND metadata LIKE ? 
            AND metadata LIKE ? 
            AND metadata LIKE ?
        `;

        // Ensure we match specific context, type, and period
        const params = [
            `%"contextId":"${context_id}"%`,
            `%"queType":"${que_type}"%`,
            `%"periodKey":"${period_key}"%`
        ];

        if (user_id) {
            sql += ' AND user_id = ?';
            params.push(user_id);
        }

        const result = await this.get(sql, params);

        if (result) {
            try {
                const meta = JSON.parse(result.metadata || '{}');
                // Reconstruct legacy format for que.service compatibility
                const guaData = meta.gua_data || {};

                // Reconstruct ai_analysis from answer if missing
                if (!guaData.ai_analysis && result.answer) {
                    try {
                        const answers = JSON.parse(result.answer);
                        if (Array.isArray(answers)) {
                            guaData.ai_analysis = answers.join('\n\n');
                        } else {
                            guaData.ai_analysis = result.answer;
                        }
                    } catch (e) {
                        guaData.ai_analysis = result.answer;
                    }
                }

                return {
                    gua_data: guaData,
                    user_note: meta.user_note || '',
                    is_verified: meta.is_verified || false
                };
            } catch (e) {
                console.error('[DB] Failed to parse metadata for getQue:', e.message);
                return null;
            }
        }
        return null;
    }



    async getQueHistory(userId, page = 1, limit = 10) {
        const offset = (page - 1) * limit;

        const countResult = await this.get(`
            SELECT COUNT(*) as total FROM consultations 
            WHERE user_id = $1 AND theme_id = 'xin_que'
        `, [userId]);
        const total = countResult ? countResult.total : 0;

        const results = await this.all(`
            SELECT * FROM consultations 
            WHERE user_id = $1 AND theme_id = 'xin_que'
            ORDER BY created_at DESC 
            LIMIT $2 OFFSET $3
        `, [userId, limit, offset]);

        const items = results.map(r => {
            let meta = {};
            try { meta = JSON.parse(r.metadata || '{}'); } catch (e) { }

            // Map consultation fields to legacy que_history fields for API compatibility if needed
            return {
                id: r.id,
                que_type: meta.queType || r.question_id,
                period_key: meta.periodKey,
                gua_name: meta.guaName,
                gua_number: meta.guaNumber,
                gua_data: meta.gua_data || {},
                created_at: r.created_at,
                is_verified: meta.is_verified || false,
                user_note: meta.user_note || ''
            };
        });

        return {
            items,
            meta: {
                total,
                page: parseInt(page),
                limit: parseInt(limit),
                totalPages: Math.ceil(total / limit)
            }
        };
    }



    async updateQueNote(id, note, isVerified) {
        // ID here is consultation ID (assuming the frontend passes appropriate ID)
        // If frontend passes legacy ID (from que_history), this will fail. 
        // But since we are switching the write path, new IDs are consultation IDs.

        const row = await this.get(`SELECT metadata FROM consultations WHERE id = $1`, [id]);
        if (!row) return;

        try {
            const meta = JSON.parse(row.metadata || '{}');
            meta.user_note = note;
            meta.is_verified = isVerified;

            await this.run(`UPDATE consultations SET metadata = $1 WHERE id = $2`, [JSON.stringify(meta), id]);
        } catch (e) {
            console.error('[DB] Error updating que note:', e.message);
        }
    }



    async createCategory(data) {
        const { name, icon, order_index } = data;
        const result = await this.run(`INSERT INTO question_categories (name, icon, order_index) VALUES ($1, $2, $3)`, [name, icon || '📋', order_index || 0]);
        return result.id;
    }



    async updateCategory(id, data) {
        const { name, icon, order_index, is_active } = data;
        await this.run(`UPDATE question_categories SET name=$1, icon=$2, order_index=$3, is_active=$4 WHERE id=$5`,
            [name, icon || '📋', order_index || 0, is_active ? 1 : 0, id]);
    }



    async deleteCategory(id) {
        await this.run(`DELETE FROM custom_questions WHERE category_id=$1`, [id]);
        await this.run(`DELETE FROM question_categories WHERE id=$1`, [id]);
    }



    async createQuestion(data) {
        const { category_id, text, order_index } = data;
        const result = await this.run(`INSERT INTO custom_questions (category_id, text, order_index) VALUES ($1, $2, $3)`,
            [category_id, text, order_index || 0]);
        return result.id;
    }



    async updateQuestion(id, data) {
        const { category_id, text, order_index, is_active } = data;
        await this.run(`UPDATE custom_questions SET category_id=$1, text=$2, order_index=$3, is_active=$4 WHERE id=$5`,
            [category_id, text, order_index || 0, is_active ? 1 : 0, id]);
    }



    async deleteQuestion(id) {
        await this.run(`DELETE FROM custom_questions WHERE id=$1`, [id]);
    }

    async getCustomersWithPagination(page = 1, limit = 20, search = '') {
        const offset = (page - 1) * limit;
        let whereClause = '';
        let params = [];
        if (search) {
            whereClause = `WHERE c.name ILIKE $1 OR CAST(c.year AS TEXT) ILIKE $2`;
            params = [`%${search}%`, `%${search}%`];
        }

        const countRow = await this.get(`SELECT COUNT(*) as total FROM customers c ${whereClause}`, params);
        const total = countRow ? parseInt(countRow.total) : 0;

        params.push(limit);
        params.push(offset);
        const customers = await this.all(`
            SELECT c.*, COUNT(con.id) as consultation_count
            FROM customers c
            LEFT JOIN consultations con ON c.id = con.customer_id
            ${whereClause}
            GROUP BY c.id
            ORDER BY c.created_at DESC
            LIMIT $${params.length - 1} OFFSET $${params.length}
        `, params);

        return { customers, total, page, limit };
    }



    async getCustomerWithConsultations(customerId) {
        const customer = await this.getCustomer(customerId);
        if (!customer) return null;

        const rows = await this.all(`
            SELECT id, question_id, question_text, answer, use_ai, created_at, persona, follow_ups
            FROM consultations
            WHERE customer_id = $1
            ORDER BY created_at DESC
        `, [customerId]);

        const consultations = rows.map(row => {
            try { row.answer = JSON.parse(row.answer || '[]'); } catch { row.answer = []; }
            return row;
        });

        return { ...customer, consultations };
    }

    async getAllUsers(page = 1, limit = 20, search = '') {
        const offset = (page - 1) * limit;
        let whereClause = '';
        let params = [];
        if (search) {
            whereClause = `WHERE email ILIKE $1 OR name ILIKE $2`;
            params = [`%${search}%`, `%${search}%`];
        }

        const countRow = await this.get(`SELECT COUNT(*) as total FROM users ${whereClause}`, params);
        const total = countRow ? parseInt(countRow.total) : 0;

        params.push(limit, offset);
        const users = await this.all(`SELECT id, email, name, credits, is_admin, created_at, last_login FROM users ${whereClause} ORDER BY created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`, params);

        return { users, total, page, limit };
    }



    async getUserCreditHistory(userId) {
        return this.all(`SELECT * FROM credit_transactions WHERE user_id = $1 ORDER BY created_at DESC`, [userId]);
    }



    async setUserCredits(userId, credits, description) {
        // Calculate difference for transaction log
        const user = await this.getUserById(userId);
        if (!user) throw new Error('User not found');

        const diff = credits - user.credits;

        await this.run(`UPDATE users SET credits = $1 WHERE id = $2`, [credits, userId]);

        if (diff !== 0) {
            await this.logCreditTransaction(userId, diff, 'ADMIN_ADJUST', description);
        }
    }



    async getPendingRequests() {
        return this.all(`
            SELECT r.*, u.email, u.name 
            FROM credit_requests r
            JOIN users u ON r.user_id = u.id
            WHERE r.status = 'pending'
            ORDER BY r.created_at ASC
        `);
    }



    async approveCreditRequest(requestId, adminId) {
        const request = await this.get(`SELECT * FROM credit_requests WHERE id = $1`, [requestId]);
        if (!request || request.status !== 'pending') throw new Error('Request invalid or already processed');

        // Approve: Add credits to user
        await this.run(`UPDATE users SET credits = credits + $1 WHERE id = $2`, [request.amount, request.user_id]);

        // Log transaction
        await this.logCreditTransaction(request.user_id, request.amount, 'DEPOSIT', 'Admin approved request');

        // Update request status
        await this.run(`
            UPDATE credit_requests 
            SET status = 'approved', processed_at = CURRENT_TIMESTAMP, processed_by = $1 
            WHERE id = $2
        `, [adminId, requestId]);
    }



    async rejectCreditRequest(requestId, adminId, note) {
        const request = await this.get(`SELECT * FROM credit_requests WHERE id = $1`, [requestId]);
        if (!request || request.status !== 'pending') throw new Error('Request invalid or already processed');

        await this.run(`
            UPDATE credit_requests 
            SET status = 'rejected', admin_note = $1, processed_at = CURRENT_TIMESTAMP, processed_by = $2 
            WHERE id = $3
        `, [note, adminId, requestId]);
    }



    async getCreditStats() {
        const totalGiven = await this.get(`SELECT SUM(amount) as sum FROM credit_requests WHERE status = 'approved'`);
        const pendingCount = await this.get(`SELECT COUNT(*) as count FROM credit_requests WHERE status = 'pending'`);

        // Get total credits in system
        const systemicCredits = await this.get(`SELECT SUM(credits) as sum FROM users`);

        return {
            total_credits_distributed: totalGiven?.sum || 0,
            pending_requests: pendingCount?.count || 0,
            system_total_credits: systemicCredits?.sum || 0
        };
    }



    async getArticleCategories() {
        return this.all(`SELECT * FROM article_categories WHERE is_active = 1 ORDER BY order_index ASC`);
    }



    async createArticleCategory(data) {
        const result = await this.run(`
            INSERT INTO article_categories (name, slug, description, order_index)
            VALUES ($1, $2, $3, $4)
        `, [data.name, data.slug, data.description || '', data.order_index || 0]);
        return result.lastID;
    }

    async getArticles(options = {}) {
        const { categoryId, limit = 10, offset = 0, published = true, featured = null } = options;
        let sql = `
            SELECT a.*, c.name as category_name, c.slug as category_slug
            FROM articles a
            LEFT JOIN article_categories c ON a.category_id = c.id
            WHERE 1=1
        `;
        const params = [];

        if (published) {
            sql += ` AND a.is_published = true`;
        }
        if (categoryId) {
            params.push(categoryId);
            sql += ` AND a.category_id = $${params.length}`;
        }
        if (featured !== null) {
            params.push(featured ? true : false);
            sql += ` AND a.is_featured = $${params.length}`;
        }

        params.push(limit, offset);
        sql += ` ORDER BY a.is_featured DESC, a.created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`;

        return this.all(sql, params);
    }

    async getArticlesCount(options = {}) {
        const { categoryId, published = true } = options;
        let sql = `SELECT COUNT(*) as count FROM articles WHERE 1=1`;
        const params = [];

        if (published) {
            sql += ` AND is_published = true`;
        }
        if (categoryId) {
            params.push(categoryId);
            sql += ` AND category_id = $${params.length}`;
        }

        const result = await this.get(sql, params);
        return parseInt(result?.count || 0);
    }



    async getArticleBySlug(slug) {
        return this.get(`
            SELECT a.*, c.name as category_name, c.slug as category_slug
            FROM articles a
            LEFT JOIN article_categories c ON a.category_id = c.id
            WHERE a.slug = $1
        `, [slug]);
    }



    async getArticleById(id) {
        return this.get(`
            SELECT a.*, c.name as category_name, c.slug as category_slug
            FROM articles a
            LEFT JOIN article_categories c ON a.category_id = c.id
            WHERE a.id = $1
        `, [id]);
    }



    async createArticle(data) {
        const result = await this.run(`
            INSERT INTO articles (title, slug, excerpt, content, thumbnail, category_id, author, is_published, is_featured)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        `, [
            data.title,
            data.slug,
            data.excerpt || '',
            data.content,
            data.thumbnail || '',
            data.category_id || null,
            data.author || 'Huyền Cơ Bát Tự',
            data.is_published !== undefined ? (data.is_published ? 1 : 0) : 1,
            data.is_featured ? 1 : 0
        ]);
        return result.lastID;
    }



    async updateArticle(id, data) {
        const fields = [];
        const params = [];

        if (data.title !== undefined) { fields.push('title = ?'); params.push(data.title); }
        if (data.slug !== undefined) { fields.push('slug = ?'); params.push(data.slug); }
        if (data.excerpt !== undefined) { fields.push('excerpt = ?'); params.push(data.excerpt); }
        if (data.content !== undefined) { fields.push('content = ?'); params.push(data.content); }
        if (data.thumbnail !== undefined) { fields.push('thumbnail = ?'); params.push(data.thumbnail); }
        if (data.category_id !== undefined) { fields.push('category_id = ?'); params.push(data.category_id); }
        if (data.author !== undefined) { fields.push('author = ?'); params.push(data.author); }
        if (data.is_published !== undefined) { fields.push('is_published = ?'); params.push(data.is_published ? 1 : 0); }
        if (data.is_featured !== undefined) { fields.push('is_featured = ?'); params.push(data.is_featured ? 1 : 0); }

        fields.push('updated_at = CURRENT_TIMESTAMP');
        params.push(id);

        await this.run(`UPDATE articles SET ${fields.join(', ')} WHERE id = $1`, params);
    }



    async deleteArticle(id) {
        await this.run(`DELETE FROM articles WHERE id = $1`, [id]);
    }



    async incrementArticleViews(id) {
        await this.run(`UPDATE articles SET views = views + 1 WHERE id = $1`, [id]);
    }


    async autoSeedArticles() {
        const row = await this.get(`SELECT COUNT(*) as count FROM articles`);
        if (row?.count > 0) return;

        console.log('[DB] Auto-seeding articles from seed-articles.js...');
        try {
            const seedArticles = require('../utils/seed-articles');
            const categories = await this.getArticleCategories();
            const catMap = {};
            categories.forEach(c => { catMap[c.slug] = c.id; });

            let count = 0;
            for (const article of seedArticles) {
                try {
                    await this.createArticle({
                        ...article,
                        category_id: catMap[article.category_slug] || catMap['khai-niem']
                    });
                    count++;
                } catch (err) {
                    console.error(`[DB] Failed to seed article "${article.title}":`, err.message);
                }
            }
            console.log(`[DB] Auto-seeded ${count} articles.`);
        } catch (error) {
            console.error('[DB] Error auto-seeding articles:', error.message);
        }
    }

    async getAccessLogs(page = 1, limit = 50, filters = {}) {
        const offset = (page - 1) * limit;
        let where = [];
        let params = [];

        if (filters.ip) {
            params.push(`%${filters.ip}%`);
            where.push(`ip ILIKE $${params.length}`);
        }
        if (filters.path) {
            params.push(`%${filters.path}%`);
            where.push(`path ILIKE $${params.length}`);
        }
        if (filters.method) {
            params.push(filters.method);
            where.push(`method = $${params.length}`);
        }
        if (filters.userId) {
            params.push(filters.userId);
            where.push(`user_id = $${params.length}`);
        }
        if (filters.date) {
            params.push(filters.date);
            where.push(`DATE(created_at) = $${params.length}`);
        }

        const whereClause = where.length > 0 ? 'WHERE ' + where.join(' AND ') : '';

        const countResult = await this.get(`SELECT COUNT(*) as total FROM access_logs ${whereClause}`, params);
        const total = countResult ? parseInt(countResult.total) : 0;

        params.push(limit, offset);
        const rows = await this.all(
            `SELECT * FROM access_logs ${whereClause} ORDER BY created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
            params
        );

        return {
            items: rows,
            meta: { total, page, limit, totalPages: Math.ceil(total / limit) }
        };
    }

    async getAccessStats() {
        const today = await this.get(`
            SELECT COUNT(*) as totalRequests, COUNT(DISTINCT ip) as uniqueIPs
            FROM access_logs WHERE DATE(created_at) = CURRENT_DATE
        `);

        const total = await this.get(`SELECT COUNT(*) as count FROM access_logs`);

        const topPaths = await this.all(`
            SELECT path, COUNT(*) as count
            FROM access_logs
            WHERE DATE(created_at) = CURRENT_DATE
            GROUP BY path
            ORDER BY count DESC
            LIMIT 10
        `);

        const topIPs = await this.all(`
            SELECT ip, COUNT(*) as count, MAX(user_email) as last_user
            FROM access_logs
            WHERE DATE(created_at) = CURRENT_DATE
            GROUP BY ip
            ORDER BY count DESC
            LIMIT 10
        `);

        const hourly = await this.all(`
            SELECT EXTRACT(HOUR FROM created_at) as hour, COUNT(*) as count
            FROM access_logs
            WHERE DATE(created_at) = CURRENT_DATE
            GROUP BY hour
            ORDER BY hour ASC
        `);

        return {
            today: { totalRequests: parseInt(today?.totalrequests || 0), uniqueIPs: parseInt(today?.uniqueips || 0) },
            totalLogs: parseInt(total?.count || 0),
            topPaths: topPaths.map(r => ({ path: r.path, count: parseInt(r.count) })),
            topIPs: topIPs.map(r => ({ ip: r.ip, count: parseInt(r.count), last_user: r.last_user })),
            hourly: hourly.map(r => ({ hour: parseInt(r.hour), count: parseInt(r.count) }))
        };
    }

}

module.exports = new PostgreSQLAdapter();
