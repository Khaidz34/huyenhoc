const fs = require('fs');

const sqliteCode = fs.readFileSync('src/services/database.service.js', 'utf8');

const missingMethodNames = [
  'saveQue', 'getQue', 'getQueHistory', 'updateQueNote',
  'createCategory', 'updateCategory', 'deleteCategory',
  'createQuestion', 'updateQuestion', 'deleteQuestion',
  'getCustomersWithPagination', 'getCustomerWithConsultations',
  'getAllUsers', 'getUserCreditHistory', 'setUserCredits',
  'getPendingRequests', 'approveCreditRequest', 'rejectCreditRequest', 'getCreditStats',
  'getArticleCategories', 'createArticleCategory', 'getArticles', 'getArticlesCount',
  'getArticleBySlug', 'getArticleById', 'createArticle', 'updateArticle', 'deleteArticle',
  'incrementArticleViews', 'autoSeedArticles', 'getAccessLogs', 'getAccessStats'
];

let pgCode = fs.readFileSync('src/services/database.service.postgres.js', 'utf8');

// Ensure we don't append twice
if (pgCode.includes('async getArticleCategories(')) {
    console.log('Already appended');
    process.exit(0);
}

let newMethods = `
    // ==========================================
    // MISSING METHODS ADDED AUTOMATICALLY
    // ==========================================
`;

// Helper to replace ? with $N for basic queries
function convertToPg(sql) {
    let n = 1;
    return sql.replace(/\?/g, () => '$' + (n++));
}

for (const method of missingMethodNames) {
    const regex = new RegExp(`^\\s*async ${method}\\([\\s\\S]*?\\n    }`, 'm');
    const match = sqliteCode.match(regex);
    if (!match) continue;
    
    let body = match[0];
    
    // Fix ? to $N for simple queries
    body = body.replace(/(?:run|get|all)\(\s*\`([^\`]+)\`/g, (m, sql) => m.replace(sql, convertToPg(sql)));
    
    // Custom overrides for dynamic queries
    if (method === 'getArticles') {
        body = `    async getArticles(options = {}) {
        const { categoryId, limit = 10, offset = 0, published = true, featured = null } = options;
        let sql = \`
            SELECT a.*, c.name as category_name, c.slug as category_slug
            FROM articles a
            LEFT JOIN article_categories c ON a.category_id = c.id
            WHERE 1=1
        \`;
        const params = [];

        if (published) {
            sql += \` AND a.is_published = true\`;
        }
        if (categoryId) {
            params.push(categoryId);
            sql += \` AND a.category_id = $\${params.length}\`;
        }
        if (featured !== null) {
            params.push(featured ? true : false);
            sql += \` AND a.is_featured = $\${params.length}\`;
        }

        params.push(limit, offset);
        sql += \` ORDER BY a.is_featured DESC, a.created_at DESC LIMIT $\${params.length - 1} OFFSET $\${params.length}\`;

        return this.all(sql, params);
    }`;
    } else if (method === 'getArticlesCount') {
        body = `    async getArticlesCount(options = {}) {
        const { categoryId, published = true } = options;
        let sql = \`SELECT COUNT(*) as count FROM articles WHERE 1=1\`;
        const params = [];

        if (published) {
            sql += \` AND is_published = true\`;
        }
        if (categoryId) {
            params.push(categoryId);
            sql += \` AND category_id = $\${params.length}\`;
        }

        const result = await this.get(sql, params);
        return parseInt(result?.count || 0);
    }`;
    } else if (method === 'getCustomersWithPagination') {
        body = `    async getCustomersWithPagination(page = 1, limit = 20, search = '') {
        const offset = (page - 1) * limit;
        let whereClause = '';
        let params = [];
        if (search) {
            whereClause = \`WHERE c.name ILIKE $1 OR CAST(c.year AS TEXT) ILIKE $2\`;
            params = [\`%\${search}%\`, \`%\${search}%\`];
        }

        const countRow = await this.get(\`SELECT COUNT(*) as total FROM customers c \${whereClause}\`, params);
        const total = countRow ? parseInt(countRow.total) : 0;

        params.push(limit);
        params.push(offset);
        const customers = await this.all(\`
            SELECT c.*, COUNT(con.id) as consultation_count
            FROM customers c
            LEFT JOIN consultations con ON c.id = con.customer_id
            \${whereClause}
            GROUP BY c.id
            ORDER BY c.created_at DESC
            LIMIT $\${params.length - 1} OFFSET $\${params.length}
        \`, params);

        return { customers, total, page, limit };
    }`;
    } else if (method === 'getAllUsers') {
        body = `    async getAllUsers(page = 1, limit = 20, search = '') {
        const offset = (page - 1) * limit;
        let whereClause = '';
        let params = [];
        if (search) {
            whereClause = \`WHERE email ILIKE $1 OR name ILIKE $2\`;
            params = [\`%\${search}%\`, \`%\${search}%\`];
        }

        const countRow = await this.get(\`SELECT COUNT(*) as total FROM users \${whereClause}\`, params);
        const total = countRow ? parseInt(countRow.total) : 0;

        params.push(limit, offset);
        const users = await this.all(\`SELECT id, email, name, credits, is_admin, created_at, last_login FROM users \${whereClause} ORDER BY created_at DESC LIMIT $\${params.length - 1} OFFSET $\${params.length}\`, params);

        return { users, total, page, limit };
    }`;
    } else if (method === 'getAccessLogs') {
        body = `    async getAccessLogs(page = 1, limit = 50, filters = {}) {
        const offset = (page - 1) * limit;
        let where = [];
        let params = [];

        if (filters.ip) {
            params.push(\`%\${filters.ip}%\`);
            where.push(\`ip ILIKE $\${params.length}\`);
        }
        if (filters.path) {
            params.push(\`%\${filters.path}%\`);
            where.push(\`path ILIKE $\${params.length}\`);
        }
        if (filters.method) {
            params.push(filters.method);
            where.push(\`method = $\${params.length}\`);
        }
        if (filters.userId) {
            params.push(filters.userId);
            where.push(\`user_id = $\${params.length}\`);
        }
        if (filters.date) {
            params.push(filters.date);
            where.push(\`DATE(created_at) = $\${params.length}\`);
        }

        const whereClause = where.length > 0 ? 'WHERE ' + where.join(' AND ') : '';

        const countResult = await this.get(\`SELECT COUNT(*) as total FROM access_logs \${whereClause}\`, params);
        const total = countResult ? parseInt(countResult.total) : 0;

        params.push(limit, offset);
        const rows = await this.all(
            \`SELECT * FROM access_logs \${whereClause} ORDER BY created_at DESC LIMIT $\${params.length - 1} OFFSET $\${params.length}\`,
            params
        );

        return {
            items: rows,
            meta: { total, page, limit, totalPages: Math.ceil(total / limit) }
        };
    }`;
    } else if (method === 'getAccessStats') {
        body = `    async getAccessStats() {
        const today = await this.get(\`
            SELECT COUNT(*) as totalRequests, COUNT(DISTINCT ip) as uniqueIPs
            FROM access_logs WHERE DATE(created_at) = CURRENT_DATE
        \`);

        const total = await this.get(\`SELECT COUNT(*) as count FROM access_logs\`);

        const topPaths = await this.all(\`
            SELECT path, COUNT(*) as count
            FROM access_logs
            WHERE DATE(created_at) = CURRENT_DATE
            GROUP BY path
            ORDER BY count DESC
            LIMIT 10
        \`);

        const topIPs = await this.all(\`
            SELECT ip, COUNT(*) as count, MAX(user_email) as last_user
            FROM access_logs
            WHERE DATE(created_at) = CURRENT_DATE
            GROUP BY ip
            ORDER BY count DESC
            LIMIT 10
        \`);

        const hourly = await this.all(\`
            SELECT EXTRACT(HOUR FROM created_at) as hour, COUNT(*) as count
            FROM access_logs
            WHERE DATE(created_at) = CURRENT_DATE
            GROUP BY hour
            ORDER BY hour ASC
        \`);

        return {
            today: { totalRequests: parseInt(today?.totalrequests || 0), uniqueIPs: parseInt(today?.uniqueips || 0) },
            totalLogs: parseInt(total?.count || 0),
            topPaths: topPaths.map(r => ({ path: r.path, count: parseInt(r.count) })),
            topIPs: topIPs.map(r => ({ ip: r.ip, count: parseInt(r.count), last_user: r.last_user })),
            hourly: hourly.map(r => ({ hour: parseInt(r.hour), count: parseInt(r.count) }))
        };
    }`;
    }
    
    newMethods += '\n' + body + '\n';
}

// Insert before the last closing brace
const insertPos = pgCode.lastIndexOf('}');
pgCode = pgCode.substring(0, insertPos) + newMethods + '\n' + pgCode.substring(insertPos);

fs.writeFileSync('src/services/database.service.postgres.js', pgCode);
console.log('Appended methods to postgres service');
