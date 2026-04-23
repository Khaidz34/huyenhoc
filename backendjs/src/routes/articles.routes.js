/**
 * Articles API Routes
 * Public and Admin endpoints for managing blog articles
 */

const express = require('express');
const router = express.Router();
const db = require('../services/db');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

// ========== PUBLIC ENDPOINTS ==========

/**
 * GET /api/articles
 * Get published articles with pagination
 */
router.get('/', async (req, res) => {
    try {
        const { category, page = 1, limit = 10 } = req.query;
        const offset = (parseInt(page) - 1) * parseInt(limit);

        let categoryId = null;
        if (category && category !== 'all') {
            const cat = await db.get(`SELECT id FROM article_categories WHERE slug = ?`, [category]);
            categoryId = cat?.id || null;
        }

        const articles = await db.getArticles({
            categoryId,
            limit: parseInt(limit),
            offset,
            published: true
        });

        const total = await db.getArticlesCount({ categoryId, published: true });

        res.json({
            success: true,
            articles,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                totalPages: Math.ceil(total / parseInt(limit))
            }
        });
    } catch (err) {
        console.error('[Articles] Error fetching articles:', err);
        res.status(500).json({ success: false, error: 'Failed to fetch articles' });
    }
});

/**
 * GET /api/articles/categories
 * Get all article categories
 */
router.get('/categories', async (req, res) => {
    try {
        const categories = await db.getArticleCategories();
        res.json({ success: true, categories });
    } catch (err) {
        console.error('[Articles] Error fetching categories:', err);
        res.status(500).json({ success: false, error: 'Failed to fetch categories' });
    }
});

// ========== ADMIN ENDPOINTS (must be before /:slug) ==========

/**
 * GET /api/articles/admin/all
 * Get all articles (including unpublished) - Temporarily public for testing
 */
router.get('/admin/all', authenticateToken, async (req, res) => {
    try {
        const { page = 1, limit = 20, search = '' } = req.query;
        const offset = (parseInt(page) - 1) * parseInt(limit);

        let articles;
        let total;

        if (search) {
            articles = await db.all(`
                SELECT a.*, c.name as category_name
                FROM articles a
                LEFT JOIN article_categories c ON a.category_id = c.id
                WHERE a.title LIKE ? OR a.excerpt LIKE ?
                ORDER BY a.created_at DESC
                LIMIT ? OFFSET ?
            `, [`%${search}%`, `%${search}%`, parseInt(limit), offset]);

            const countResult = await db.get(`
                SELECT COUNT(*) as count FROM articles
                WHERE title LIKE ? OR excerpt LIKE ?
            `, [`%${search}%`, `%${search}%`]);
            total = countResult?.count || 0;
        } else {
            articles = await db.getArticles({
                limit: parseInt(limit),
                offset,
                published: null // Get all, including unpublished
            });
            total = await db.getArticlesCount({ published: null });
        }

        res.json({
            success: true,
            articles,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                totalPages: Math.ceil(total / parseInt(limit))
            }
        });
    } catch (err) {
        console.error('[Articles Admin] Error:', err);
        res.status(500).json({ success: false, error: 'Failed to fetch articles' });
    }
});

/**
 * POST /api/articles/seed
 * Seed articles - Force reseed with new content
 */
router.post('/seed', authenticateToken, async (req, res) => {
    try {
        // Delete existing articles first
        await db.run(`DELETE FROM articles`);
        console.log('[Seed] Deleted all existing articles');

        // Initialize categories first
        await db.initDefaultArticleCategories();

        // Get category IDs
        const categories = await db.getArticleCategories();
        const catMap = {};
        categories.forEach(c => { catMap[c.slug] = c.id; });

        // Clear require cache to get fresh data
        delete require.cache[require.resolve('../utils/seed-articles')];

        // Seed articles
        const seedArticles = require('../utils/seed-articles');
        let count = 0;

        for (const article of seedArticles) {
            await db.createArticle({
                ...article,
                category_id: catMap[article.category_slug] || catMap['khai-niem']
            });
            count++;
        }

        res.json({ success: true, message: `Seeded ${count} articles successfully (replaced old data)` });
    } catch (err) {
        console.error('[Articles Admin] Seed error:', err);
        res.status(500).json({ success: false, error: 'Failed to seed articles' });
    }
});

/**
 * POST /api/articles
 * Create new article - Admin only
 */
router.post('/', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { title, slug, excerpt, content, thumbnail, category_id, author, is_published, is_featured } = req.body;

        if (!title || !content) {
            return res.status(400).json({ success: false, error: 'Title and content are required' });
        }

        // Generate slug if not provided
        const finalSlug = slug || title
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/đ/g, 'd')
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-|-$/g, '');

        // Check for duplicate slug
        const existing = await db.getArticleBySlug(finalSlug);
        if (existing) {
            return res.status(400).json({ success: false, error: 'Slug already exists' });
        }

        const id = await db.createArticle({
            title,
            slug: finalSlug,
            excerpt,
            content,
            thumbnail,
            category_id,
            author,
            is_published,
            is_featured
        });

        res.json({ success: true, id, message: 'Article created successfully' });
    } catch (err) {
        console.error('[Articles Admin] Create error:', err);
        res.status(500).json({ success: false, error: 'Failed to create article' });
    }
});

/**
 * PUT /api/articles/:id
 * Update article - Admin only
 */
router.put('/:id', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const article = await db.getArticleById(id);

        if (!article) {
            return res.status(404).json({ success: false, error: 'Article not found' });
        }

        await db.updateArticle(id, req.body);
        res.json({ success: true, message: 'Article updated successfully' });
    } catch (err) {
        console.error('[Articles Admin] Update error:', err);
        res.status(500).json({ success: false, error: 'Failed to update article' });
    }
});

/**
 * DELETE /api/articles/:id
 * Delete article - Admin only
 */
router.delete('/:id', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const article = await db.getArticleById(id);

        if (!article) {
            return res.status(404).json({ success: false, error: 'Article not found' });
        }

        await db.deleteArticle(id);
        res.json({ success: true, message: 'Article deleted successfully' });
    } catch (err) {
        console.error('[Articles Admin] Delete error:', err);
        res.status(500).json({ success: false, error: 'Failed to delete article' });
    }
});

// ========== SLUG ROUTE (must be last!) ==========

/**
 * GET /api/articles/:slug
 * Get single article by slug
 */
router.get('/:slug', async (req, res) => {
    try {
        const article = await db.getArticleBySlug(req.params.slug);

        if (!article) {
            return res.status(404).json({ success: false, error: 'Article not found' });
        }

        // Increment view count
        await db.incrementArticleViews(article.id);

        // Get related articles (same category)
        const related = await db.getArticles({
            categoryId: article.category_id,
            limit: 4,
            published: true
        });

        res.json({
            success: true,
            article: { ...article, views: article.views + 1 },
            related: related.filter(a => a.id !== article.id).slice(0, 3)
        });
    } catch (err) {
        console.error('[Articles] Error fetching article:', err);
        res.status(500).json({ success: false, error: 'Failed to fetch article' });
    }
});

module.exports = router;
