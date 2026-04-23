
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
            LIMIT $1 OFFSET $2
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
            whereClause = `WHERE email LIKE ? OR name LIKE ?`;
            params = [`%${search}%`, `%${search}%`];
        }

        const countRow = await this.get(`SELECT COUNT(*) as total FROM users ${whereClause}`, params);
        const total = countRow ? countRow.total : 0;

        params.push(limit, offset);
        const users = await this.all(`SELECT id, email, name, credits, is_admin, created_at, last_login FROM users ${whereClause} ORDER BY created_at DESC LIMIT $1 OFFSET $2`, params);

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
            `SELECT * FROM access_logs ${whereClause} ORDER BY created_at DESC LIMIT $1 OFFSET $2`,
            [...params, limit, offset]
        );

        return {
            items: rows,
            meta: { total, page, limit, totalPages: Math.ceil(total / limit) }
        };
    }

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
