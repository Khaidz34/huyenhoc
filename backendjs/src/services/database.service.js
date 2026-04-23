/**
 * SQLite Database Service using native sqlite3 driver
 * Optimized for performance with WAL mode and async operations
 * Enhanced with connection pooling, error handling, and health monitoring
 * Implements DatabaseServiceInterface
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const DatabaseServiceInterface = require('./database.interface');

// Database file path
const DB_PATH = path.join(__dirname, '../../data/bazi_consultant.db');
const DATA_DIR = path.dirname(DB_PATH);

class SQLiteAdapter extends DatabaseServiceInterface {
    constructor() {
        super(); // Call parent constructor
        this.db = null;
        this.isInitialized = false;
        this.connectionRetries = 0;
        this.maxRetries = 3;
        this.retryDelay = 1000; // 1 second
        this.healthStatus = 'unknown';
        this.lastHealthCheck = null;
    }

    /**
     * Initialize database connection with retry mechanism
     */
    async init() {
        if (this.isInitialized && this.db) {
            return Promise.resolve();
        }

        return new Promise((resolve, reject) => {
            this._initWithRetry(resolve, reject);
        });
    }

    /**
     * Initialize with retry mechanism
     */
    _initWithRetry(resolve, reject) {
        // Ensure directory exists
        if (!fs.existsSync(DATA_DIR)) {
            fs.mkdirSync(DATA_DIR, { recursive: true });
        }

        this.db = new sqlite3.Database(DB_PATH, (err) => {
            if (err) {
                console.error(`[DB] Failed to connect to database (attempt ${this.connectionRetries + 1}):`, err.message);
                
                if (this.connectionRetries < this.maxRetries) {
                    this.connectionRetries++;
                    console.log(`[DB] Retrying connection in ${this.retryDelay}ms...`);
                    setTimeout(() => {
                        this._initWithRetry(resolve, reject);
                    }, this.retryDelay * this.connectionRetries); // Exponential backoff
                } else {
                    this.healthStatus = 'error';
                    reject(new Error(`Failed to connect to database after ${this.maxRetries} attempts: ${err.message}`));
                }
            } else {
                console.log('[DB] Connected to SQLite database.');
                this.connectionRetries = 0;
                this.healthStatus = 'healthy';
                this.lastHealthCheck = new Date();

                // Enable optimizations
                this._enableOptimizations()
                    .then(() => this.createTables())
                    .then(() => {
                        this.isInitialized = true;
                        resolve();
                    })
                    .catch(reject);
            }
        });
    }

    /**
     * Enable SQLite optimizations
     */
    async _enableOptimizations() {
        const optimizations = [
            'PRAGMA journal_mode = WAL;',           // Write-Ahead Logging for better concurrency
            'PRAGMA synchronous = NORMAL;',         // Balance between safety and performance
            'PRAGMA cache_size = -64000;',          // 64MB cache
            'PRAGMA temp_store = MEMORY;',          // Store temp tables in memory
            'PRAGMA mmap_size = 268435456;',        // 256MB memory-mapped I/O
            'PRAGMA optimize;'                      // Optimize query planner
        ];

        for (const pragma of optimizations) {
            try {
                await this.run(pragma);
                console.log(`[DB] Applied: ${pragma.split(' ')[1]}`);
            } catch (err) {
                console.warn(`[DB] Failed to apply optimization ${pragma}:`, err.message);
            }
        }
    }

    /**
     * Health check method
     */
    async healthCheck() {
        try {
            const startTime = Date.now();
            await this.get('SELECT 1 as test');
            const responseTime = Date.now() - startTime;
            
            this.healthStatus = 'healthy';
            this.lastHealthCheck = new Date();
            
            return {
                status: 'healthy',
                responseTime,
                lastCheck: this.lastHealthCheck,
                database: 'SQLite',
                file: DB_PATH
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
                    database: 'SQLite',
                    file: DB_PATH
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
            database: 'SQLite',
            file: DB_PATH
        };
    }

    /**
     * Run a query that doesn't return data (CREATE, INSERT, UPDATE, DELETE)
     */
    run(sql, params = []) {
        return new Promise((resolve, reject) => {
            this.db.run(sql, params, function (err) {
                if (err) {
                    console.error('[DB] Error running sql:', sql);
                    console.error(err);
                    reject(err);
                } else {
                    resolve({ id: this.lastID, changes: this.changes });
                }
            });
        });
    }

    /**
     * Get first row result
     */
    get(sql, params = []) {
        return new Promise((resolve, reject) => {
            this.db.get(sql, params, (err, row) => {
                if (err) {
                    console.error('[DB] Error running sql:', sql);
                    reject(err);
                } else {
                    resolve(row);
                }
            });
        });
    }

    /**
     * Get all rows
     */
    all(sql, params = []) {
        return new Promise((resolve, reject) => {
            this.db.all(sql, params, (err, rows) => {
                if (err) {
                    console.error('[DB] Error running sql:', sql);
                    reject(err);
                } else {
                    resolve(rows);
                }
            });
        });
    }

    /**
     * Create tables if they don't exist
     */
    async createTables() {
        // Customers table
        await this.run(`
            CREATE TABLE IF NOT EXISTS customers (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT,
                year INTEGER NOT NULL,
                month INTEGER NOT NULL,
                day INTEGER NOT NULL,
                hour INTEGER DEFAULT 12,
                minute INTEGER DEFAULT 0,
                gender TEXT DEFAULT 'Nam',
                calendar TEXT DEFAULT 'solar',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Consultations table - Expanded with detailed context
        await this.run(`
            CREATE TABLE IF NOT EXISTS consultations (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                customer_id INTEGER,
                theme_id TEXT,
                question_id TEXT NOT NULL,
                question_text TEXT,
                answer TEXT,
                use_ai INTEGER DEFAULT 1,
                credits_used INTEGER DEFAULT 0,
                user_id INTEGER,
                persona TEXT DEFAULT 'huyen_co',
                follow_ups TEXT, 
                person1_data TEXT,
                person2_data TEXT,
                metadata TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (customer_id) REFERENCES customers(id)
            )
        `);

        // Migration for existing tables - add new columns if they don't exist
        const tableInfo = await this.all(`PRAGMA table_info(consultations)`);
        const columns = tableInfo.map(c => c.name);

        if (!columns.includes('person1_data')) {
            console.log('[DB] Migrating consultations: adding person1_data');
            await this.run(`ALTER TABLE consultations ADD COLUMN person1_data TEXT`);
        }
        if (!columns.includes('person2_data')) {
            console.log('[DB] Migrating consultations: adding person2_data');
            await this.run(`ALTER TABLE consultations ADD COLUMN person2_data TEXT`);
        }
        if (!columns.includes('metadata')) {
            console.log('[DB] Migrating consultations: adding metadata');
            await this.run(`ALTER TABLE consultations ADD COLUMN metadata TEXT`);
        }

        // Question categories table (admin)
        await this.run(`
            CREATE TABLE IF NOT EXISTS question_categories (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                icon TEXT DEFAULT '📋',
                order_index INTEGER DEFAULT 0,
                is_active INTEGER DEFAULT 1,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Custom questions table (admin)
        await this.run(`
            CREATE TABLE IF NOT EXISTS custom_questions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                category_id INTEGER,
                text TEXT NOT NULL,
                is_active INTEGER DEFAULT 1,
                order_index INTEGER DEFAULT 0,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (category_id) REFERENCES question_categories(id)
            )
        `);

        // Users table (authentication & credits)
        await this.run(`
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                email TEXT UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                name TEXT,
                credits INTEGER DEFAULT 100,
                is_admin INTEGER DEFAULT 0,
                bazi_data TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                last_login DATETIME
            )
        `);

        // Credit transactions table
        await this.run(`
            CREATE TABLE IF NOT EXISTS credit_transactions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                amount INTEGER NOT NULL,
                type TEXT NOT NULL,
                description TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id)
            )
        `);

        // Sessions table (persistent sessions)
        await this.run(`
            CREATE TABLE IF NOT EXISTS sessions (
                token TEXT PRIMARY KEY,
                user_id INTEGER NOT NULL,
                user_data TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                expires_at DATETIME,
                FOREIGN KEY (user_id) REFERENCES users(id)
            )
        `);

        // Credit requests table
        await this.run(`
            CREATE TABLE IF NOT EXISTS credit_requests (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                amount INTEGER DEFAULT 100,
                status TEXT DEFAULT 'pending',
                admin_note TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                processed_at DATETIME,
                processed_by INTEGER,
                FOREIGN KEY (user_id) REFERENCES users(id)
            )
        `);

        // Article categories table
        await this.run(`
            CREATE TABLE IF NOT EXISTS article_categories (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                slug TEXT UNIQUE NOT NULL,
                description TEXT,
                order_index INTEGER DEFAULT 0,
                is_active INTEGER DEFAULT 1,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Articles table
        await this.run(`
            CREATE TABLE IF NOT EXISTS articles (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title TEXT NOT NULL,
                slug TEXT UNIQUE NOT NULL,
                excerpt TEXT,
                content TEXT NOT NULL,
                thumbnail TEXT,
                category_id INTEGER,
                author TEXT DEFAULT 'Huyền Cơ Bát Tự',
                views INTEGER DEFAULT 0,
                is_published INTEGER DEFAULT 1,
                is_featured INTEGER DEFAULT 0,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (category_id) REFERENCES article_categories(id)
            )
        `);



        // Que History table (Xin Quẻ)
        await this.run(`
            CREATE TABLE IF NOT EXISTS que_history (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
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
                is_verified INTEGER DEFAULT 0,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Migration: add context_id if missing
        const queColumns = await this.all(`PRAGMA table_info(que_history)`);
        const queColumnNames = queColumns.map(c => c.name);

        if (!queColumnNames.includes('context_id')) {
            console.log('[DB] Migrating que_history: adding context_id');
            await this.run(`ALTER TABLE que_history ADD COLUMN context_id TEXT`);
        }

        if (!queColumnNames.includes('bazi_params')) {
            console.log('[DB] Migrating que_history: adding bazi_params');
            await this.run(`ALTER TABLE que_history ADD COLUMN bazi_params TEXT`);
        }

        // Index for faster lookup
        await this.run(`CREATE INDEX IF NOT EXISTS idx_que_history_lookup ON que_history(user_id, que_type, period_key, context_id)`);

        // Indexes
        await this.run(`CREATE INDEX IF NOT EXISTS idx_consultations_customer ON consultations(customer_id)`);
        await this.run(`CREATE INDEX IF NOT EXISTS idx_consultations_user ON consultations(user_id)`);
        await this.run(`CREATE INDEX IF NOT EXISTS idx_customers_birth ON customers(year, month, day)`);
        await this.run(`CREATE INDEX IF NOT EXISTS idx_questions_category ON custom_questions(category_id)`);
        await this.run(`CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)`);
        await this.run(`CREATE INDEX IF NOT EXISTS idx_credit_trans_user ON credit_transactions(user_id)`);
        await this.run(`CREATE INDEX IF NOT EXISTS idx_credit_requests_status ON credit_requests(status)`);
        await this.run(`CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token)`);
        await this.run(`CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id)`);
        await this.run(`CREATE INDEX IF NOT EXISTS idx_articles_slug ON articles(slug)`);
        await this.run(`CREATE INDEX IF NOT EXISTS idx_articles_category ON articles(category_id)`);
        await this.run(`CREATE INDEX IF NOT EXISTS idx_articles_published ON articles(is_published)`);
        await this.run(`CREATE INDEX IF NOT EXISTS idx_article_categories_slug ON article_categories(slug)`);

        // Access logs table
        await this.run(`
            CREATE TABLE IF NOT EXISTS access_logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                ip TEXT,
                method TEXT,
                path TEXT,
                status_code INTEGER,
                user_agent TEXT,
                user_id INTEGER,
                user_email TEXT,
                response_time INTEGER,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);
        await this.run(`CREATE INDEX IF NOT EXISTS idx_access_logs_created ON access_logs(created_at)`);
        await this.run(`CREATE INDEX IF NOT EXISTS idx_access_logs_ip ON access_logs(ip)`);
        await this.run(`CREATE INDEX IF NOT EXISTS idx_access_logs_path ON access_logs(path)`);

        // Create Default Admins
        const admins = [
            { email: 'admin@huyencobattu.vn', hash: '8c6976e5b5410415bde908bd4dee15dfb167a9c873fc4bb8a81f6f2ab448a918', name: 'Administrator' },
            { email: 'admin@admin.com', hash: '8c6976e5b5410415bde908bd4dee15dfb167a9c873fc4bb8a81f6f2ab448a918', name: 'System Admin' }
        ];

        for (const admin of admins) {
            const email = admin.email.toLowerCase().trim();
            const exists = await this.get(`SELECT id FROM users WHERE LOWER(TRIM(email)) = ?`, [email]);

            if (!exists) {
                console.log(`[DB] Admin ${email} not found. Creating...`);
                await this.run(`
                    INSERT INTO users (email, password_hash, name, credits, is_admin)
                    VALUES (?, ?, ?, 9999, 1)
                `, [email, admin.hash, admin.name]);
                console.log(`[DB] Admin ${email} created.`);
            }
        }

        console.log('[DB] Tables and indexes checked/created.');
        await this.initDefaultCategories();
        await this.initDefaultArticleCategories();
        await this.autoSeedArticles();
    }

    /**
     * Initialize default question categories if empty
     */
    async initDefaultCategories() {
        const row = await this.get(`SELECT COUNT(*) as count FROM question_categories`);
        const count = row ? row.count : 0;

        if (count === 0) {
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
                    VALUES (?, ?, ?, 1)
                `, [cat.name, cat.icon, cat.order_index]);
                categoryIds[cat.mapKey] = result.id;
            }
            console.log('[DB] Default categories initialized');
            await this.initDefaultQuestions(categoryIds);
        }
    }

    /**
     * Initialize default questions from data.js if empty
     */
    async initDefaultQuestions(categoryIds) {
        const row = await this.get(`SELECT COUNT(*) as count FROM custom_questions`);
        const count = row ? row.count : 0;
        if (count > 0) return;

        console.log('[DB] Initializing default questions from data.js...');
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
                        VALUES (?, ?, ?, 1)
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

    /**
     * Find or create a customer based on birth info
     */
    async findOrCreateCustomer(userData) {
        const { name, year, month, day, hour, minute, gender, calendar } = userData;

        const existing = await this.get(`
            SELECT id FROM customers 
            WHERE year = ? AND month = ? AND day = ? AND hour = ? AND minute = ?
            LIMIT 1
        `, [year, month, day, hour || 12, minute || 0]);

        if (existing) {
            if (name) {
                await this.run(`UPDATE customers SET name = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`, [name, existing.id]);
            }
            return existing.id;
        }

        const safeName = name || 'Mệnh chủ';
        const result = await this.run(`
            INSERT INTO customers (name, year, month, day, hour, minute, gender, calendar)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `, [safeName, year, month, day, hour || 12, minute || 0, gender || 'Nam', calendar || 'solar']);

        console.log(`[DB] Customer #${result.id} created`);
        return result.id;
    }

    /**
     * Always create a new customer record
     */
    async createNewCustomer(userData) {
        const { name, year, month, day, hour, minute, gender, calendar } = userData;
        const safeName = name || 'Mệnh chủ';

        const result = await this.run(`
            INSERT INTO customers (name, year, month, day, hour, minute, gender, calendar)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `, [safeName, year, month, day, hour || 12, minute || 0, gender || 'Nam', calendar || 'solar']);

        return result.id;
    }

    /**
     * Save a consultation record with detailed context
     */
    async saveConsultation(customerId, themeId, questionId, questionText, answer, useAI = true, creditsUsed = 0, userId = null, persona = 'huyen_co', followUps = [], extraData = {}) {
        // Stringify answer if it's an array or object, leave strings as-is
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
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            customerId, themeId || '', questionId, questionText || '', answerJson || '',
            useAI ? 1 : 0, creditsUsed, userId, persona, followUpsJson,
            person1Data, person2Data, metadata
        ]);

        console.log(`[DB] Consultation #${result.id} saved with detailed context`);
        return result.id;
    }

    /**
     * Get consultation history for a user
     */
    async getUserHistory(userId, limit = 20) {
        const rows = await this.all(`
            SELECT id, question_id, question_text, answer, use_ai, credits_used, created_at, persona, follow_ups, person1_data, person2_data, metadata
            FROM consultations
            WHERE user_id = ?
            ORDER BY created_at DESC
            LIMIT ?
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

    /**
     * Get consultation history for a customer
     */
    async getCustomerHistory(customerId, limit = 50) {
        const rows = await this.all(`
            SELECT id, question_id, question_text, answer, use_ai, created_at, persona, follow_ups
            FROM consultations
            WHERE customer_id = ?
            ORDER BY created_at DESC
            LIMIT ?
        `, [customerId, limit]);

        return rows.map(row => {
            try { row.answer = JSON.parse(row.answer || '[]'); } catch { row.answer = []; }
            return row;
        });
    }

    /**
     * Get customer by ID
     */
    async getCustomer(customerId) {
        return this.get(`SELECT * FROM customers WHERE id = ?`, [customerId]);
    }

    /**
     * Get all customers
     */
    async getAllCustomers(limit = 100) {
        return this.all(`
            SELECT c.*, COUNT(con.id) as consultation_count
            FROM customers c
            LEFT JOIN consultations con ON c.id = con.customer_id
            GROUP BY c.id
            ORDER BY c.updated_at DESC
            LIMIT ?
        `, [limit]);
    }

    /**
     * Get recent customers with their last question
     */
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
            LIMIT ?
        `, [limit]);
    }

    /**
     * Get statistics
     */
    async getStats() {
        const totalCustomers = (await this.get(`SELECT COUNT(*) as count FROM customers`)).count;
        const totalConsultations = (await this.get(`SELECT COUNT(*) as count FROM consultations`)).count;
        const aiConsultations = (await this.get(`SELECT COUNT(*) as count FROM consultations WHERE use_ai = 1`)).count;
        const todayConsultations = (await this.get(`SELECT COUNT(*) as count FROM consultations WHERE DATE(created_at) = DATE('now')`)).count;

        return { totalCustomers, totalConsultations, aiConsultations, todayConsultations };
    }

    /**
     * Get daily consultation counts for the last 7 days
     */
    async getDailyConsultationStats() {
        try {
            return this.all(`
                WITH RECURSIVE days(date) AS (
                    SELECT DATE('now', '-6 days')
                    UNION ALL
                    SELECT DATE(date, '+1 day') FROM days WHERE date < DATE('now')
                )
                SELECT 
                    d.date,
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

    /**
     * Get consultation counts by category
     */
    async getConsultationByCategoryStats() {
        try {
            const rows = await this.all(`
                SELECT 
                    qc.name as label,
                    qc.icon,
                    COUNT(c.id) as value
                FROM question_categories qc
                LEFT JOIN consultations c ON c.theme_id = CAST(qc.id AS TEXT)
                GROUP BY qc.id
                ORDER BY value DESC
            `);
            return rows;
        } catch (e) {
            console.error('[DB] Error fetching category stats:', e.message);
            return [];
        }
    }

    // ========== QUE HISTORY METHODS (UNIFIED via CONSULTATIONS) ==========

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
            WHERE user_id = ? AND theme_id = 'xin_que'
        `, [userId]);
        const total = countResult ? countResult.total : 0;

        const results = await this.all(`
            SELECT * FROM consultations 
            WHERE user_id = ? AND theme_id = 'xin_que'
            ORDER BY created_at DESC 
            LIMIT ? OFFSET ?
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

        const row = await this.get(`SELECT metadata FROM consultations WHERE id = ?`, [id]);
        if (!row) return;

        try {
            const meta = JSON.parse(row.metadata || '{}');
            meta.user_note = note;
            meta.is_verified = isVerified;

            await this.run(`UPDATE consultations SET metadata = ? WHERE id = ?`, [JSON.stringify(meta), id]);
        } catch (e) {
            console.error('[DB] Error updating que note:', e.message);
        }
    }

    // ========== ADMIN: CATEGORIES & QUESTIONS ==========

    async getAllCategories() {
        return this.all(`SELECT * FROM question_categories ORDER BY order_index ASC`);
    }

    async createCategory(data) {
        const { name, icon, order_index } = data;
        const result = await this.run(`INSERT INTO question_categories (name, icon, order_index) VALUES (?, ?, ?)`, [name, icon || '📋', order_index || 0]);
        return result.id;
    }

    async updateCategory(id, data) {
        const { name, icon, order_index, is_active } = data;
        await this.run(`UPDATE question_categories SET name=?, icon=?, order_index=?, is_active=? WHERE id=?`,
            [name, icon || '📋', order_index || 0, is_active ? 1 : 0, id]);
    }

    async deleteCategory(id) {
        await this.run(`DELETE FROM custom_questions WHERE category_id=?`, [id]);
        await this.run(`DELETE FROM question_categories WHERE id=?`, [id]);
    }

    async getAllQuestions(categoryId = null) {
        let sql = `SELECT q.*, c.name as category_name FROM custom_questions q LEFT JOIN question_categories c ON q.category_id = c.id`;
        let params = [];
        if (categoryId) {
            sql += ` WHERE q.category_id = ?`;
            params.push(categoryId);
        }
        sql += ` ORDER BY q.order_index ASC`;
        return this.all(sql, params);
    }

    async createQuestion(data) {
        const { category_id, text, order_index } = data;
        const result = await this.run(`INSERT INTO custom_questions (category_id, text, order_index) VALUES (?, ?, ?)`,
            [category_id, text, order_index || 0]);
        return result.id;
    }

    async updateQuestion(id, data) {
        const { category_id, text, order_index, is_active } = data;
        await this.run(`UPDATE custom_questions SET category_id=?, text=?, order_index=?, is_active=? WHERE id=?`,
            [category_id, text, order_index || 0, is_active ? 1 : 0, id]);
    }

    async deleteQuestion(id) {
        await this.run(`DELETE FROM custom_questions WHERE id=?`, [id]);
    }

    // ========== ADMIN: CUSTOMERS with Pagination ==========

    async getCustomersWithPagination(page = 1, limit = 20, search = '') {
        const offset = (page - 1) * limit;
        let whereClause = '';
        let params = [];
        if (search) {
            whereClause = `WHERE c.name LIKE ? OR c.year LIKE ?`;
            params = [`%${search}%`, `%${search}%`];
        }

        const countRow = await this.get(`SELECT COUNT(*) as total FROM customers c ${whereClause}`, params);
        const total = countRow ? countRow.total : 0;

        params.push(limit);
        params.push(offset);
        const customers = await this.all(`
            SELECT c.*, COUNT(con.id) as consultation_count
            FROM customers c
            LEFT JOIN consultations con ON c.id = con.customer_id
            ${whereClause}
            GROUP BY c.id
            ORDER BY c.created_at DESC
            LIMIT ? OFFSET ?
        `, params);

        return { customers, total, page, limit };
    }

    async getCustomerWithConsultations(customerId) {
        const customer = await this.getCustomer(customerId);
        if (!customer) return null;

        const rows = await this.all(`
            SELECT id, question_id, question_text, answer, use_ai, created_at, persona, follow_ups
            FROM consultations
            WHERE customer_id = ?
            ORDER BY created_at DESC
        `, [customerId]);

        const consultations = rows.map(row => {
            try { row.answer = JSON.parse(row.answer || '[]'); } catch { row.answer = []; }
            return row;
        });

        return { ...customer, consultations };
    }

    // ========== ACCOUNTS & AUTH ==========

    async createUser(email, passwordHash, name = '') {
        console.log(`[DB] Creating user: ${email}`);
        const existing = await this.getUserByEmail(email);
        if (existing) throw new Error('Email đã được sử dụng');

        try {
            const result = await this.run(`
                INSERT INTO users (email, password_hash, name, credits)
                VALUES (?, ?, ?, 100)
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
        return this.get(`SELECT * FROM users WHERE email = ?`, [email]);
    }

    async getUserById(id) {
        return this.get(`SELECT * FROM users WHERE id = ?`, [id]);
    }

    async deductCredits(userId, amount, description) {
        const user = await this.getUserById(userId);
        if (!user) throw new Error('User not found');
        if (user.credits < amount) throw new Error('Không đủ linh thạch');

        await this.run(`UPDATE users SET credits = credits - ? WHERE id = ?`, [amount, userId]);
        await this.logCreditTransaction(userId, -amount, 'SPEND', description);
    }

    async updateUserBaziData(userId, data) {
        const dataJson = JSON.stringify(data);
        await this.run(`UPDATE users SET bazi_data = ? WHERE id = ?`, [dataJson, userId]);
    }

    // Add missing method that was likely in original file or usually needed
    async logCreditTransaction(userId, amount, type, description) {
        await this.run(`
            INSERT INTO credit_transactions (user_id, amount, type, description)
            VALUES (?, ?, ?, ?)
        `, [userId, amount, type, description]);
    }
    async updateLastLogin(userId) {
        await this.run(`UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?`, [userId]);
    }

    async getSession(token) {
        const session = await this.get(`SELECT * FROM sessions WHERE token = ?`, [token]);
        if (!session) return null;
        try { session.user = JSON.parse(session.user_data); } catch { session.user = null; }
        return session;
    }

    async createSession(token, userData) {
        const userDataJson = JSON.stringify(userData);
        await this.run(`INSERT OR REPLACE INTO sessions (token, user_id, user_data) VALUES (?, ?, ?)`,
            [token, userData.id, userDataJson]);
    }

    async deleteSession(token) {
        await this.run(`DELETE FROM sessions WHERE token = ?`, [token]);
    }

    async getLatestSuggestions(userId, limit = 5) {
        // This relies on tracking follow-up questions from consultations
        // Simple implementation: extract follow_ups from recent consultations
        const rows = await this.all(`
            SELECT follow_ups FROM consultations 
            WHERE user_id = ? 
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

    async updateUserProfile(userId, data) {
        const { name } = data;
        if (name) {
            await this.run(`UPDATE users SET name = ? WHERE id = ?`, [name, userId]);
        }
    }

    async createCreditRequest(userId, amount) {
        const result = await this.run(`
            INSERT INTO credit_requests (user_id, amount, status) VALUES (?, ?, 'pending')
        `, [userId, amount]);
        return result.id;
    }

    async getUserPendingRequest(userId) {
        return this.get(`SELECT * FROM credit_requests WHERE user_id = ? AND status = 'pending'`, [userId]);
    }

    // ========== ADMIN: USER MANAGEMENT ==========

    async getAllUsers(page = 1, limit = 20, search = '') {
        const offset = (page - 1) * limit;
        let whereClause = '';
        let params = [];
        if (search) {
            whereClause = `WHERE email LIKE ? OR name LIKE ?`;
            params = [`%${search}%`, `%${search}%`];
        }

        const countRow = await this.get(`SELECT COUNT(*) as total FROM users ${whereClause}`, params);
        const total = countRow ? countRow.total : 0;

        params.push(limit, offset);
        const users = await this.all(`SELECT id, email, name, credits, is_admin, created_at, last_login FROM users ${whereClause} ORDER BY created_at DESC LIMIT ? OFFSET ?`, params);

        return { users, total, page, limit };
    }

    async getUserCreditHistory(userId) {
        return this.all(`SELECT * FROM credit_transactions WHERE user_id = ? ORDER BY created_at DESC`, [userId]);
    }

    async setUserCredits(userId, credits, description) {
        // Calculate difference for transaction log
        const user = await this.getUserById(userId);
        if (!user) throw new Error('User not found');

        const diff = credits - user.credits;

        await this.run(`UPDATE users SET credits = ? WHERE id = ?`, [credits, userId]);

        if (diff !== 0) {
            await this.logCreditTransaction(userId, diff, 'ADMIN_ADJUST', description);
        }
    }

    // ========== ADMIN: CREDIT REQUESTS ==========

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
        const request = await this.get(`SELECT * FROM credit_requests WHERE id = ?`, [requestId]);
        if (!request || request.status !== 'pending') throw new Error('Request invalid or already processed');

        // Approve: Add credits to user
        await this.run(`UPDATE users SET credits = credits + ? WHERE id = ?`, [request.amount, request.user_id]);

        // Log transaction
        await this.logCreditTransaction(request.user_id, request.amount, 'DEPOSIT', 'Admin approved request');

        // Update request status
        await this.run(`
            UPDATE credit_requests 
            SET status = 'approved', processed_at = CURRENT_TIMESTAMP, processed_by = ? 
            WHERE id = ?
        `, [adminId, requestId]);
    }

    async rejectCreditRequest(requestId, adminId, note) {
        const request = await this.get(`SELECT * FROM credit_requests WHERE id = ?`, [requestId]);
        if (!request || request.status !== 'pending') throw new Error('Request invalid or already processed');

        await this.run(`
            UPDATE credit_requests 
            SET status = 'rejected', admin_note = ?, processed_at = CURRENT_TIMESTAMP, processed_by = ? 
            WHERE id = ?
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

    // ========== ARTICLES MANAGEMENT ==========

    async getArticleCategories() {
        return this.all(`SELECT * FROM article_categories WHERE is_active = 1 ORDER BY order_index ASC`);
    }

    async createArticleCategory(data) {
        const result = await this.run(`
            INSERT INTO article_categories (name, slug, description, order_index)
            VALUES (?, ?, ?, ?)
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
            sql += ` AND a.is_published = 1`;
        }
        if (categoryId) {
            sql += ` AND a.category_id = ?`;
            params.push(categoryId);
        }
        if (featured !== null) {
            sql += ` AND a.is_featured = ?`;
            params.push(featured ? 1 : 0);
        }

        sql += ` ORDER BY a.is_featured DESC, a.created_at DESC LIMIT ? OFFSET ?`;
        params.push(limit, offset);

        return this.all(sql, params);
    }

    async getArticlesCount(options = {}) {
        const { categoryId, published = true } = options;
        let sql = `SELECT COUNT(*) as count FROM articles WHERE 1=1`;
        const params = [];

        if (published) {
            sql += ` AND is_published = 1`;
        }
        if (categoryId) {
            sql += ` AND category_id = ?`;
            params.push(categoryId);
        }

        const result = await this.get(sql, params);
        return result?.count || 0;
    }

    async getArticleBySlug(slug) {
        return this.get(`
            SELECT a.*, c.name as category_name, c.slug as category_slug
            FROM articles a
            LEFT JOIN article_categories c ON a.category_id = c.id
            WHERE a.slug = ?
        `, [slug]);
    }

    async getArticleById(id) {
        return this.get(`
            SELECT a.*, c.name as category_name, c.slug as category_slug
            FROM articles a
            LEFT JOIN article_categories c ON a.category_id = c.id
            WHERE a.id = ?
        `, [id]);
    }

    async createArticle(data) {
        const result = await this.run(`
            INSERT INTO articles (title, slug, excerpt, content, thumbnail, category_id, author, is_published, is_featured)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
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

        await this.run(`UPDATE articles SET ${fields.join(', ')} WHERE id = ?`, params);
    }

    async deleteArticle(id) {
        await this.run(`DELETE FROM articles WHERE id = ?`, [id]);
    }

    async incrementArticleViews(id) {
        await this.run(`UPDATE articles SET views = views + 1 WHERE id = ?`, [id]);
    }

    async initDefaultArticleCategories() {
        const count = await this.get(`SELECT COUNT(*) as count FROM article_categories`);
        if (count?.count > 0) return;

        const categories = [
            { name: 'Tất cả', slug: 'all', order_index: 0 },
            { name: 'Khái niệm cơ bản', slug: 'khai-niem', order_index: 1 },
            { name: 'Cách luận giải', slug: 'cach-luan', order_index: 2 },
            { name: 'Ngũ Hành', slug: 'ngu-hanh', order_index: 3 },
            { name: 'Thiên Can - Địa Chi', slug: 'can-chi', order_index: 4 },
            { name: 'Ứng dụng thực tế', slug: 'ung-dung', order_index: 5 }
        ];

        for (const cat of categories) {
            await this.createArticleCategory(cat);
        }
        console.log('[DB] Default article categories created.');
    }

    /**
     * Auto-seed articles from seed-articles.js if articles table is empty
     */
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

    // ========== ACCESS LOGS ==========

    /**
     * Save an access log record (fire-and-forget)
     */
    saveAccessLog(data) {
        const { ip, method, path, statusCode, userAgent, userId, userEmail, responseTime } = data;
        this.run(`
            INSERT INTO access_logs (ip, method, path, status_code, user_agent, user_id, user_email, response_time)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `, [ip, method, path, statusCode, userAgent || '', userId || null, userEmail || null, responseTime || 0])
            .catch(err => console.error('[DB] Failed to save access log:', err.message));
    }

    /**
     * Get access logs with pagination and filters
     */
    async getAccessLogs(page = 1, limit = 50, filters = {}) {
        const offset = (page - 1) * limit;
        let where = [];
        let params = [];

        if (filters.ip) {
            where.push('ip LIKE ?');
            params.push(`%${filters.ip}%`);
        }
        if (filters.path) {
            where.push('path LIKE ?');
            params.push(`%${filters.path}%`);
        }
        if (filters.method) {
            where.push('method = ?');
            params.push(filters.method);
        }
        if (filters.userId) {
            where.push('user_id = ?');
            params.push(filters.userId);
        }
        if (filters.date) {
            where.push('DATE(created_at) = ?');
            params.push(filters.date);
        }

        const whereClause = where.length > 0 ? 'WHERE ' + where.join(' AND ') : '';

        const countResult = await this.get(`SELECT COUNT(*) as total FROM access_logs ${whereClause}`, params);
        const total = countResult ? countResult.total : 0;

        const rows = await this.all(
            `SELECT * FROM access_logs ${whereClause} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
            [...params, limit, offset]
        );

        return {
            items: rows,
            meta: { total, page, limit, totalPages: Math.ceil(total / limit) }
        };
    }

    /**
     * Get access log statistics
     */
    async getAccessStats() {
        const today = await this.get(`
            SELECT COUNT(*) as totalRequests, COUNT(DISTINCT ip) as uniqueIPs
            FROM access_logs WHERE DATE(created_at) = DATE('now')
        `);

        const total = await this.get(`SELECT COUNT(*) as count FROM access_logs`);

        const topPaths = await this.all(`
            SELECT path, COUNT(*) as count
            FROM access_logs
            WHERE DATE(created_at) = DATE('now')
            GROUP BY path
            ORDER BY count DESC
            LIMIT 10
        `);

        const topIPs = await this.all(`
            SELECT ip, COUNT(*) as count, MAX(user_email) as last_user
            FROM access_logs
            WHERE DATE(created_at) = DATE('now')
            GROUP BY ip
            ORDER BY count DESC
            LIMIT 10
        `);

        const hourly = await this.all(`
            SELECT strftime('%H', created_at) as hour, COUNT(*) as count
            FROM access_logs
            WHERE DATE(created_at) = DATE('now')
            GROUP BY hour
            ORDER BY hour ASC
        `);

        return {
            today: today || { totalRequests: 0, uniqueIPs: 0 },
            totalLogs: total?.count || 0,
            topPaths,
            topIPs,
            hourly
        };
    }

    /**
     * Clean old access logs (older than N days)
     */
    async cleanOldAccessLogs(days = 30) {
        const result = await this.run(
            `DELETE FROM access_logs WHERE created_at < datetime('now', '-' || ? || ' days')`,
            [days]
        );
        if (result.changes > 0) {
            console.log(`[DB] Cleaned ${result.changes} access logs older than ${days} days.`);
        }
        return result.changes;
    }

    /**
     * Close database connection gracefully
     */
    async close() {
        return new Promise((resolve) => {
            if (this.db) {
                this.db.close((err) => {
                    if (err) {
                        console.error('[DB] Error closing database:', err.message);
                    } else {
                        console.log('[DB] Database connection closed.');
                    }
                    this.db = null;
                    this.isInitialized = false;
                    this.healthStatus = 'closed';
                    resolve();
                });
            } else {
                resolve();
            }
        });
    }
}

module.exports = new SQLiteAdapter();
