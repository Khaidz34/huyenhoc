/**
 * PostgreSQL Database Service using pg driver
 * Replaces SQLite implementation for production deployment
 * 
 * Connection pooling and optimized for Supabase
 */

const { Pool } = require('pg');

class DatabaseService {
    constructor() {
        this.pool = null;
    }

    /**
     * Initialize database connection pool
     */
    async init() {
        try {
            const DATABASE_URL = process.env.DATABASE_URL;
            
            if (!DATABASE_URL) {
                throw new Error('DATABASE_URL environment variable is required');
            }

            this.pool = new Pool({
                connectionString: DATABASE_URL,
                ssl: { rejectUnauthorized: false }, // Required for Supabase
                max: 20, // Connection pool size
                idleTimeoutMillis: 30000,
                connectionTimeoutMillis: 10000, // Increased to 10 seconds for Supabase
            });

            // Test connection
            const client = await this.pool.connect();
            await client.query('SELECT NOW()');
            client.release();

            console.log('[DB] Connected to PostgreSQL database.');
            console.log('[DB] Connection pool initialized with max 20 connections.');

            // Schema already created by migration script, no need to create tables
            console.log('[DB] Database initialized successfully.');
        } catch (error) {
            console.error('[DB] Failed to initialize database:', error.message);
            throw error;
        }
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
}

module.exports = new DatabaseService();
