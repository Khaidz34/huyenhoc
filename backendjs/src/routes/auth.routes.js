/**
 * Authentication Routes
 * Handles user registration, login, and session management
 */

const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const dbService = require('../services/db');

// Simple hash function (for demo - use bcrypt in production)
const hashPassword = (password) => {
    return crypto.createHash('sha256').update(password).digest('hex');
};

// Simple session store (Deprecated - now using dbService for persistent sessions)
// const sessions = new Map();

// CAPTCHA store (token -> { answer, expiresAt })
const captchaStore = new Map();

// Generate session token
const generateToken = () => {
    return crypto.randomBytes(32).toString('hex');
};

// Generate CAPTCHA challenge
const generateCaptcha = () => {
    const operators = ['+', '-', '*'];
    const operator = operators[Math.floor(Math.random() * 2)]; // Only + and - for simplicity
    let num1, num2, answer;

    if (operator === '+') {
        num1 = Math.floor(Math.random() * 20) + 1;
        num2 = Math.floor(Math.random() * 20) + 1;
        answer = num1 + num2;
    } else {
        num1 = Math.floor(Math.random() * 20) + 10;
        num2 = Math.floor(Math.random() * 10) + 1;
        answer = num1 - num2;
    }

    const token = crypto.randomBytes(16).toString('hex');
    const expiresAt = Date.now() + 5 * 60 * 1000; // 5 minutes

    captchaStore.set(token, { answer, expiresAt });

    // Clean up expired captchas
    for (const [key, value] of captchaStore.entries()) {
        if (value.expiresAt < Date.now()) {
            captchaStore.delete(key);
        }
    }

    return {
        token,
        question: `${num1} ${operator} ${num2} = ?`,
        num1,
        num2,
        operator
    };
};

// Verify CAPTCHA
const verifyCaptcha = (token, userAnswer) => {
    const captcha = captchaStore.get(token);

    if (!captcha) {
        return { valid: false, error: 'Mã xác thực không hợp lệ hoặc đã hết hạn' };
    }

    if (captcha.expiresAt < Date.now()) {
        captchaStore.delete(token);
        return { valid: false, error: 'Mã xác thực đã hết hạn, vui lòng thử lại' };
    }

    const isValid = parseInt(userAnswer) === captcha.answer;
    captchaStore.delete(token); // One-time use

    if (!isValid) {
        return { valid: false, error: 'Đáp án không đúng, vui lòng thử lại' };
    }

    return { valid: true };
};

// GET /api/auth/captcha - Get new CAPTCHA challenge
router.get('/captcha', (req, res) => {
    const captcha = generateCaptcha();
    res.json({
        token: captcha.token,
        question: captcha.question
    });
});

// Middleware to check authentication
const authMiddleware = async (req, res, next) => {
    const token = req.headers.authorization?.replace('Bearer ', '');

    if (!token) {
        return res.status(401).json({ error: 'Chưa đăng nhập' });
    }

    try {
        const session = await dbService.getSession(token);
        if (!session) {
            return res.status(401).json({ error: 'Phiên đăng nhập hết hạn' });
        }

        req.user = session.user;
        req.token = token;
        next();
    } catch (error) {
        console.error('[AUTH] Middleware error:', error);
        return res.status(500).json({ error: 'Lỗi xác thực hệ thống' });
    }
};

// POST /api/auth/register
router.post('/register', async (req, res) => {
    console.log('--- REGISTER REQUEST ---');
    console.log('[AUTH] Register attempt for:', req.body?.email || 'unknown');
    try {
        const { email, password, name, captchaToken, captchaAnswer } = req.body;

        // Verify CAPTCHA first
        if (!captchaToken || captchaAnswer === undefined || captchaAnswer === '') {
            console.warn('[AUTH] Register failed: Missing CAPTCHA');
            return res.status(400).json({ error: 'Vui lòng hoàn thành xác thực' });
        }

        const captchaResult = verifyCaptcha(captchaToken, captchaAnswer);
        if (!captchaResult.valid) {
            console.warn('[AUTH] Register failed: Invalid CAPTCHA');
            return res.status(400).json({ error: captchaResult.error, refreshCaptcha: true });
        }

        if (!email || !password) {
            console.warn('[AUTH] Register failed: Missing email or password');
            return res.status(400).json({ error: 'Email và mật khẩu là bắt buộc' });
        }

        if (password.length < 6) {
            console.warn('[AUTH] Register failed: Password too short');
            return res.status(400).json({ error: 'Mật khẩu phải có ít nhất 6 ký tự' });
        }

        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            console.warn('[AUTH] Register failed: Invalid email format');
            return res.status(400).json({ error: 'Email không đúng định dạng' });
        }

        const passwordHash = hashPassword(password);
        console.log(`[AUTH] Creating user: ${email.toLowerCase().trim()}`);

        const userId = await dbService.createUser(email.toLowerCase().trim(), passwordHash, name || '');
        console.log(`[AUTH] User created with ID: ${userId}`);

        // Auto login after registration
        const user = await dbService.getUserById(userId);
        console.log(`[AUTH] getUserById result:`, user);

        if (!user) {
            console.error(`[AUTH] CRITICAL: getUserById returned null for userId ${userId}`);
            // Fallback: create user object manually
            const fallbackUser = {
                id: userId,
                email: email.toLowerCase().trim(),
                name: name || '',
                credits: 100,
                is_admin: 0
            };
            const token = generateToken();
            await dbService.createSession(token, fallbackUser);
            console.log(`[AUTH] Register success (fallback): ${email} -> User ID ${userId}`);
            return res.json({
                message: 'Đăng ký thành công! Bạn nhận được 100 Linh Thạch',
                token,
                user: fallbackUser
            });
        }

        const token = generateToken();
        const userData = { id: user.id, email: user.email, name: user.name, credits: user.credits, is_admin: user.is_admin };
        await dbService.createSession(token, userData);

        await dbService.updateLastLogin(userId);

        console.log(`[AUTH] Register success: ${email} -> User ID ${userId}`);

        res.json({
            message: 'Đăng ký thành công! Bạn nhận được 100 Linh Thạch',
            token,
            user: { id: user.id, email: user.email, name: user.name, credits: user.credits, is_admin: user.is_admin }
        });
    } catch (error) {
        console.error('[AUTH] Register error:', error.message);
        res.status(400).json({ error: error.message });
    }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
    console.log('--- LOGIN REQUEST ---');
    console.log('[AUTH] Login attempt for:', req.body?.email || 'unknown');
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            console.warn('[AUTH] Missing email or password');
            return res.status(400).json({ error: 'Email và mật khẩu là bắt buộc' });
        }

        const user = await dbService.getUserByEmail(email.toLowerCase().trim());

        if (!user) {
            console.warn(`[AUTH] Login Failed: User NOT FOUND -> "${email}"`);
            return res.status(401).json({ error: 'Email hoặc mật khẩu không đúng' });
        }

        const passwordHash = hashPassword(password);
        if (user.password_hash !== passwordHash) {
            console.warn(`[AUTH] Login Failed: PASSWORD MISMATCH for -> "${email}"`);
            return res.status(401).json({ error: 'Email hoặc mật khẩu không đúng' });
        }

        console.log(`[AUTH] Login Success: "${email}" (is_admin: ${user.is_admin})`);
        const token = generateToken();
        const userData = { id: user.id, email: user.email, name: user.name, credits: user.credits, is_admin: user.is_admin };
        await dbService.createSession(token, userData);

        await dbService.updateLastLogin(user.id);

        res.json({
            message: 'Đăng nhập thành công',
            token,
            user: { id: user.id, email: user.email, name: user.name, credits: user.credits, is_admin: user.is_admin }
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET /api/auth/me - Get current user info
router.get('/me', authMiddleware, async (req, res) => {
    try {
        // Refresh user data from database
        const user = await dbService.getUserById(req.user.id);

        if (!user) {
            await dbService.deleteSession(req.token);
            return res.status(401).json({ error: 'Người dùng không tồn tại' });
        }

        // Update session with fresh credits
        const userData = { id: user.id, email: user.email, name: user.name, credits: user.credits, is_admin: user.is_admin };
        await dbService.createSession(req.token, userData); // Overwrites with fresh data

        let baziData = null;
        try {
            baziData = user.bazi_data ? JSON.parse(user.bazi_data) : null;
        } catch (e) {
            console.error('[AUTH] Failed to parse bazi_data:', e.message);
        }

        res.json({
            user: {
                id: user.id,
                email: user.email,
                name: user.name,
                credits: user.credits,
                is_admin: user.is_admin,
                bazi_data: baziData
            }
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// POST /api/auth/logout
router.post('/logout', async (req, res) => {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (token) {
        await dbService.deleteSession(token);
    }
    res.json({ message: 'Đã đăng xuất' });
});

// GET /api/auth/suggestions - Get latest suggested questions for user
router.get('/suggestions', authMiddleware, async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 5;
        const suggestions = await dbService.getLatestSuggestions(req.user.id, limit);
        res.json({ suggestions });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// POST /api/auth/profile - Update user profile
router.post('/profile', authMiddleware, async (req, res) => {
    try {
        const { name, baziData } = req.body;
        console.log(`[AUTH] Update Profile for ${req.user.id}:`, req.body); // DEBUG LOG

        if (name !== undefined) {
            await dbService.updateUserProfile(req.user.id, { name });
        }

        if (baziData !== undefined) {
            await dbService.updateUserBaziData(req.user.id, baziData);
        }

        const freshUser = await dbService.getUserById(req.user.id);

        res.json({
            message: 'Cập nhật thành công',
            user: {
                ...freshUser,
                bazi_data: freshUser.bazi_data ? JSON.parse(freshUser.bazi_data) : null
            }
        });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// POST /api/auth/request-credits - User requests more credits
router.post('/request-credits', authMiddleware, async (req, res) => {
    try {
        const amount = 50; // Fixed amount per request
        const requestId = await dbService.createCreditRequest(req.user.id, amount);
        res.json({
            message: 'Yêu cầu đã được gửi, vui lòng chờ Admin phê duyệt',
            requestId
        });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// GET /api/auth/pending-request - Check if user has pending request
router.get('/pending-request', authMiddleware, async (req, res) => {
    try {
        const pending = await dbService.getUserPendingRequest(req.user.id);
        res.json({ hasPending: !!pending, request: pending });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Middleware to check if user is admin
const adminMiddleware = (req, res, next) => {
    if (!req.user || !req.user.is_admin) {
        return res.status(403).json({ error: 'Quyền truy cập bị từ chối. Yêu cầu quyền Admin.' });
    }
    next();
};

// Export middleware for use in other routes
router.authMiddleware = authMiddleware;
router.adminMiddleware = adminMiddleware;
// router.sessions = sessions; // Removed for DB sessions

module.exports = router;
