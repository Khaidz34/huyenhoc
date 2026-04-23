/**
 * Admin API Routes
 * Manages questions, categories, customers
 */

const express = require('express');
const router = express.Router();
const dbService = require('../services/db');
const { authMiddleware, adminMiddleware } = require('./auth.routes');

// Apply protection to all admin routes
router.use(authMiddleware);
router.use(adminMiddleware);

// ========== CATEGORIES ==========

// GET all categories
router.get('/categories', async (req, res) => {
    try {
        const categories = await dbService.getAllCategories();
        res.json(categories);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// POST create category
router.post('/categories', async (req, res) => {
    try {
        const id = await dbService.createCategory(req.body);
        res.json({ id, message: 'Category created' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// PUT update category
router.put('/categories/:id', async (req, res) => {
    try {
        await dbService.updateCategory(parseInt(req.params.id), req.body);
        res.json({ message: 'Category updated' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// DELETE category
router.delete('/categories/:id', async (req, res) => {
    try {
        await dbService.deleteCategory(parseInt(req.params.id));
        res.json({ message: 'Category deleted' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ========== QUESTIONS ==========

// GET all questions
router.get('/questions', async (req, res) => {
    try {
        const categoryId = req.query.category_id ? parseInt(req.query.category_id) : null;
        const questions = await dbService.getAllQuestions(categoryId);
        res.json(questions);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// POST create question
router.post('/questions', async (req, res) => {
    try {
        const id = await dbService.createQuestion(req.body);
        res.json({ id, message: 'Question created' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// PUT update question
router.put('/questions/:id', async (req, res) => {
    try {
        await dbService.updateQuestion(parseInt(req.params.id), req.body);
        res.json({ message: 'Question updated' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// DELETE question
router.delete('/questions/:id', async (req, res) => {
    try {
        await dbService.deleteQuestion(parseInt(req.params.id));
        res.json({ message: 'Question deleted' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ========== CUSTOMERS ==========

// GET customers with pagination
router.get('/customers', async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const search = req.query.search || '';
        const result = await dbService.getCustomersWithPagination(page, limit, search);
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET customer detail with consultations
router.get('/customers/:id', async (req, res) => {
    try {
        const customer = await dbService.getCustomerWithConsultations(parseInt(req.params.id));
        if (!customer) {
            return res.status(404).json({ error: 'Customer not found' });
        }
        res.json(customer);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ========== STATS ==========

// GET admin stats
router.get('/stats', async (req, res) => {
    try {
        const stats = await dbService.getStats();
        const categories = await dbService.getAllCategories();
        const questions = await dbService.getAllQuestions();
        stats.totalCategories = categories.length;
        stats.totalQuestions = questions.length;
        res.json(stats);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET chart data (daily and category distribution)
router.get('/chart-data', async (req, res) => {
    try {
        const daily = await dbService.getDailyConsultationStats();
        const categories = await dbService.getConsultationByCategoryStats();
        res.json({ daily, categories });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ========== USERS (Account & Credit Management) ==========

// GET users with pagination
router.get('/users', async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const search = req.query.search || '';
        const result = await dbService.getAllUsers(page, limit, search);
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET user by ID
router.get('/users/:id', async (req, res) => {
    try {
        const user = await dbService.getUserById(parseInt(req.params.id));
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        const history = await dbService.getUserCreditHistory(user.id);
        res.json({ ...user, credit_history: history });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// PUT update user credits
router.put('/users/:id/credits', async (req, res) => {
    try {
        const { credits, description } = req.body;
        await dbService.setUserCredits(parseInt(req.params.id), credits, description || 'Admin điều chỉnh');
        res.json({ message: 'Credits updated' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ========== CREDIT REQUESTS ==========

// GET pending credit requests
router.get('/credit-requests', async (req, res) => {
    try {
        const requests = await dbService.getPendingRequests();
        res.json(requests);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// POST approve credit request
router.post('/credit-requests/:id/approve', async (req, res) => {
    try {
        const adminId = req.user.id;
        await dbService.approveCreditRequest(parseInt(req.params.id), adminId);
        res.json({ message: 'Yêu cầu đã được duyệt' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// POST reject credit request
router.post('/credit-requests/:id/reject', async (req, res) => {
    try {
        const adminId = req.user.id;
        const { note } = req.body;
        await dbService.rejectCreditRequest(parseInt(req.params.id), adminId, note || '');
        res.json({ message: 'Yêu cầu đã bị từ chối' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET credit statistics for dashboard
router.get('/credit-stats', async (req, res) => {
    try {
        const stats = await dbService.getCreditStats();
        res.json(stats);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ========== ACCESS LOGS ==========

// GET access logs with pagination + filters
router.get('/access-logs', async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 50;
        const filters = {
            ip: req.query.ip || '',
            path: req.query.path || '',
            method: req.query.method || '',
            userId: req.query.userId || '',
            date: req.query.date || ''
        };
        // Remove empty filters
        Object.keys(filters).forEach(k => { if (!filters[k]) delete filters[k]; });

        const result = await dbService.getAccessLogs(page, limit, filters);
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET access log statistics
router.get('/access-stats', async (req, res) => {
    try {
        const stats = await dbService.getAccessStats();
        res.json(stats);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
