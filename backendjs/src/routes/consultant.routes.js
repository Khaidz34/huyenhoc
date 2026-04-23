const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const { THEMES, QUESTIONS } = require('../bazi/questions/data');
const { solveQuestion } = require('../bazi/questions/engine');
const baziCalculator = require('../bazi/calculator');
const baziService = require('../services/bazi.service');
const openRouterService = require('../services/openrouter.service');
const dbService = require('../services/db');
const { formatOutput } = require('../bazi/output');
const { calculateDaiVan } = require('../bazi/dayun');
const authRoutes = require('./auth.routes');
const { authenticateToken } = require('../middleware/auth');

// Credit costs
const CREDIT_COST_PREDEFINED = 10;   // Click vào câu hỏi có sẵn
const CREDIT_COST_AI = 50;            // Sử dụng AI (không dùng hiện tại)
const CREDIT_COST_CUSTOM = 25;        // Điền câu hỏi tự do vào form

// AI Rate Limiter for heavy endpoints
const aiLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 15, // 15 requests per minute
    message: { error: 'Quá nhiều request AI, vui lòng chờ 1 phút' },
    standardHeaders: true,
    legacyHeaders: false,
});

// GET /api/consultant/themes - Load from database (or fallback to hardcoded)
// GET /api/consultant/themes - Load from database (or fallback to hardcoded)
router.get('/themes', async (req, res) => {
    try {
        const dbCategories = await dbService.getAllCategories();

        if (dbCategories.length > 0) {
            // Use database categories
            const themes = dbCategories.map(cat => ({
                id: String(cat.id),
                name: cat.name,
                icon: cat.icon,
                isFromDB: true
            }));
            return res.json(themes);
        }

        // Fallback to hardcoded if database is empty
        res.json(THEMES);
    } catch (error) {
        res.json(THEMES);
    }
});

// GET /api/consultant/questions/:themeId - Load from database (or fallback)
// GET /api/consultant/questions/:themeId - Load from database (or fallback)
router.get('/questions/:themeId', async (req, res) => {
    const themeId = req.params.themeId;

    try {
        // Try to load from database
        const categoryId = parseInt(themeId);
        if (!isNaN(categoryId)) {
            const dbQuestions = await dbService.getAllQuestions(categoryId);
            if (dbQuestions.length > 0) {
                const questions = dbQuestions.map(q => ({
                    id: String(q.id),
                    text: q.text,
                    logic: 'DB_QUESTION',
                    isFromDB: true
                }));
                return res.json(questions);
            }
        }

        // Fallback to hardcoded for old theme IDs
        const questions = QUESTIONS[themeId] || [];
        res.json(questions);
    } catch (error) {
        const questions = QUESTIONS[themeId] || [];
        res.json(questions);
    }
});

// POST /api/consultant/ask - Requires authentication and credits
router.post('/ask', authRoutes.authMiddleware, aiLimiter, async (req, res) => {
    try {
        const { year, month, day, hour, minute, gender, calendar, questionId, questionText, useAI, persona } = req.body;
        const userId = req.user.id;

        if (!year || !month || !day || !questionId) {
            return res.status(400).json({ error: 'Missing required parameters' });
        }

        // Determine credit cost based on question type
        const isCustomQuestion = questionText && questionText === questionId;
        const creditCost = isCustomQuestion ? CREDIT_COST_CUSTOM : CREDIT_COST_PREDEFINED;

        // Check and deduct credits
        try {
            const description = isCustomQuestion ? 'Câu hỏi tự do' : 'Câu hỏi có sẵn';
            await dbService.deductCredits(userId, creditCost, description);
        } catch (creditError) {
            const user = await dbService.getUserById(userId);
            return res.status(402).json({
                error: creditError.message,
                credits_required: creditCost,
                credits_current: user?.credits || 0
            });
        }

        const g = (gender || '').toLowerCase();
        const isFemale = g.startsWith('n') && !g.includes('am') || g.includes('female') || g.includes('nữ') || g.includes('nư');

        // Calculate BaZi Context
        const calc = new baziCalculator({
            name: req.body.name || 'Mệnh chủ',
            year: parseInt(year),
            month: parseInt(month),
            day: parseInt(day),
            hour: parseInt(hour || 12),
            minute: parseInt(minute || 0),
            isFemale: isFemale,
            isSolar: (calendar || 'solar').toLowerCase() === 'solar'
        });
        const ctx = calc.calculate();
        ctx.name = req.body.name || 'Mệnh chủ';

        // Calculate Partner Context if provided
        let partnerCtx = null;
        if (req.body.partnerData) {
            const p = req.body.partnerData;
            const pg = (p.gender || '').toLowerCase();
            const pIsFemale = pg.startsWith('n') && !pg.includes('am') || pg.includes('female') || pg.includes('nữ') || pg.includes('nư');

            const pCalc = new baziCalculator({
                name: p.name || 'Đối phương',
                year: parseInt(p.year),
                month: parseInt(p.month),
                day: parseInt(p.day),
                hour: parseInt(p.hour || 12),
                minute: parseInt(p.minute || 0),
                isFemale: pIsFemale,
                isSolar: true
            });
            partnerCtx = pCalc.calculate();
            partnerCtx.name = p.name || 'Đối phương';
        }

        let answerData;
        // questionText and isCustomQuestion already defined above from credit check
        let finalQuestionText = questionText || questionId;
        let themeId = null;

        // First, check if it's a database question (numeric ID)
        const numericId = parseInt(questionId);
        if (!isNaN(numericId) && !isCustomQuestion) {
            // Try to get from database
            const allDbQuestions = await dbService.getAllQuestions();
            const dbQuestion = allDbQuestions.find(q => q.id === numericId);
            if (dbQuestion) {
                finalQuestionText = dbQuestion.text;
                themeId = String(dbQuestion.category_id);
            }
        }

        // Fallback: Find in hardcoded questions
        if (finalQuestionText === questionId && !isCustomQuestion) {
            for (const tid of Object.keys(QUESTIONS)) {
                const found = QUESTIONS[tid].find(q =>
                    q.id === questionId || q.logic === questionId || q.text === questionId
                );
                if (found) {
                    finalQuestionText = found.text;
                    themeId = tid;
                    break;
                }
            }
        }

        // Check if AI mode is requested
        if (useAI) {
            // Prepare full context for AI
            const fullOutput = formatOutput(ctx);
            const daiVanData = calculateDaiVan(ctx);

            // Build context objects for AI
            const baziContext = {
                thong_tin_co_ban: fullOutput.thong_tin_co_ban,
                chi_tiet_tru: fullOutput.chi_tiet_tru,
                phan_tich: fullOutput.phan_tich
            };

            const luckCyclesData = {
                dai_van: daiVanData
            };

            // Call OpenRouter AI
            answerData = await openRouterService.generateAnswer(
                baziContext,
                luckCyclesData,
                finalQuestionText,
                persona || 'huyen_co',
                partnerCtx
            );
        } else {
            // Use traditional engine
            const paragraphs = await solveQuestion(ctx, questionId);
            answerData = {
                answer: paragraphs,
                followUps: [
                    "Con có muốn thầy luận giải sâu hơn về cung Phu Thê không?",
                    "Vấn đề tài lộc năm nay của con có gì cần gỡ rối thêm không?",
                    "Con có muốn biết mình hợp với ngành nghề nào nhất không?"
                ]
            };
        }

        // Save to database
        let customerId = null;
        let consultationId = null;
        try {
            customerId = await dbService.findOrCreateCustomer({
                name: req.body.name,
                year: parseInt(year),
                month: parseInt(month),
                day: parseInt(day),
                hour: parseInt(hour || 12),
                minute: parseInt(minute || 0),
                gender: gender || 'Nam',
                calendar: calendar || 'solar'
            });

            const person1FullData = {
                name: req.body.name || 'Mệnh chủ',
                year: parseInt(year),
                month: parseInt(month),
                day: parseInt(day),
                hour: parseInt(hour || 12),
                minute: parseInt(minute || 0),
                gender: gender || 'Nam',
                calendar: calendar || 'solar',
                chart: baziService.mapToChart(ctx)
            };

            let person2FullData = null;
            if (partnerCtx) {
                const p = req.body.partnerData;
                person2FullData = {
                    name: p.name || 'Đối phương',
                    year: parseInt(p.year),
                    month: parseInt(p.month),
                    day: parseInt(p.day),
                    hour: parseInt(p.hour || 12),
                    minute: parseInt(p.minute || 0),
                    gender: p.gender || 'Nam',
                    calendar: 'solar',
                    chart: baziService.mapToChart(partnerCtx)
                };
            }

            consultationId = await dbService.saveConsultation(
                customerId,
                themeId,
                questionId,
                finalQuestionText,
                answerData.answer,
                !!useAI,
                creditCost,
                userId,  // Pass user ID
                persona || 'huyen_co', // Pass persona
                answerData.followUps || [], // Pass generated follow-ups
                {
                    person1: person1FullData,
                    person2: person2FullData,
                    metadata: {
                        themeId,
                        isCustom: isCustomQuestion,
                        requestedPersona: persona
                    }
                }
            );

            // Update user's last bazi data for next time
            if (userId) {
                await dbService.updateUserBaziData(userId, {
                    year, month, day, hour, minute, gender, calendar, name: req.body.name
                });
            }

            console.log(`[DB] Saved consultation #${consultationId} for customer #${customerId}, user #${userId}, credits used: ${creditCost}`);
        } catch (dbError) {
            console.error('[DB] Failed to save consultation:', dbError.message);
            // Continue without failing the request
        }

        // Return full answer
        res.json({
            questionId,
            answer: answerData.answer,
            followUps: answerData.followUps,
            useAI: !!useAI,
            persona: persona || 'huyen_co',
            customerId,
            consultationId,
            creditsUsed: creditCost,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('Consultant API Error:', error);
        res.status(500).json({ error: 'Internal server error', message: error.message });
    }
});

// GET /api/consultant/history/:customerId
// GET /api/consultant/history/:customerId
router.get('/history/:customerId', async (req, res) => {
    try {
        const customerId = parseInt(req.params.customerId);
        const history = await dbService.getCustomerHistory(customerId);
        const customer = await dbService.getCustomer(customerId);

        res.json({
            customer,
            history
        });
    } catch (error) {
        console.error('History API Error:', error);
        res.status(500).json({ error: 'Failed to fetch history', message: error.message });
    }
});

// GET /api/consultant/stats
// GET /api/consultant/stats
router.get('/stats', async (req, res) => {
    try {
        const stats = await dbService.getStats();
        res.json(stats);
    } catch (error) {
        console.error('Stats API Error:', error);
        res.status(500).json({ error: 'Failed to fetch stats', message: error.message });
    }
});

// GET /api/consultant/customers
// GET /api/consultant/customers
router.get('/customers', async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 100;
        const customers = await dbService.getAllCustomers(limit);
        res.json(customers);
    } catch (error) {
        console.error('Customers API Error:', error);
        res.status(500).json({ error: 'Failed to fetch customers', message: error.message });
    }
});

// GET /api/consultant/recent - Recent customers with last question
// GET /api/consultant/recent - Recent customers with last question
router.get('/recent', async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 10;
        const recentData = await dbService.getRecentCustomersWithQuestions(limit);
        res.json(recentData);
    } catch (error) {
        console.error('Recent API Error:', error);
        res.status(500).json({ error: 'Failed to fetch recent data', message: error.message });
    }
});

// GET /api/consultant/my-history - Get logged-in user's consultation history
// GET /api/consultant/my-history - Get logged-in user's consultation history
router.get('/my-history', authRoutes.authMiddleware, async (req, res) => {
    try {
        const userId = req.user.id;
        const limit = parseInt(req.query.limit) || 20;
        const history = await dbService.getUserHistory(userId, limit);

        res.json({
            history,
            count: history.length,
            userId
        });
    } catch (error) {
        console.error('My History API Error:', error);
        res.status(500).json({ error: 'Failed to fetch history', message: error.message });
    }
});

// POST /api/consultant/comprehensive - Comprehensive chart interpretation with AI
const CREDIT_COST_COMPREHENSIVE = 25;
router.post('/comprehensive', authRoutes.authMiddleware, aiLimiter, async (req, res) => {
    try {
        const { chartData, persona } = req.body;
        const userId = req.user.id;

        if (!chartData) {
            return res.status(400).json({ error: 'Thiếu dữ liệu lá số' });
        }

        // Check and deduct credits
        try {
            await dbService.deductCredits(userId, CREDIT_COST_COMPREHENSIVE, 'Tổng hợp luận giải lá số');
        } catch (creditError) {
            const user = await dbService.getUserById(userId);
            return res.status(402).json({
                error: creditError.message,
                credits_required: CREDIT_COST_COMPREHENSIVE,
                credits_current: user?.credits || 0
            });
        }

        // Build comprehensive prompt from chart data
        const personaName = persona === 'menh_meo' ? 'Thầy Mệnh Mèo GenZ' : 'Thầy Huyền Cơ Bát Tự';
        const personaStyle = persona === 'menh_meo'
            ? `Hãy dùng ngôn ngữ Gen Z, hài hước, vui vẻ, NHIỀU EMOJI trong mỗi đoạn văn. 
- Gọi người hỏi là "con", "bồ", hoặc "cưng"
- Dùng các từ lóng như: "chill", "vibe", "flex", "slay", "real", "cap", "no cap", "đu trend", "xịn xò", "đỉnh của chóp", "so chill", "tuổi gì đây trời", "quẩy lên"
- Ví von bằng pop culture: "như Blackpink", "energy như Sơn Tùng", "drama như Bà Nguyễn Phương Hằng"
- Đưa ra lời khuyên theo kiểu GenZ: "Cứ chill thôi", "Đừng overthink nhiều quá", "Slay thôi nào"
- Khi nói về bát tự, giải thích đơn giản, dễ hiểu như đang giải thích cho bạn bè
- Mỗi section nên có ít nhất 1-2 emoji phù hợp`
            : `Hãy dùng ngôn ngữ trang trọng, uyên thâm, đầy chiêm nghiệm Đông phương.
- Gọi người hỏi là "con" hoặc "Mệnh chủ"
- Trích dẫn kinh điển khi phù hợp (Kinh Dịch, Luận Ngữ, Đạo Đức Kinh)
- Dùng từ ngữ cổ kính: "nghiệm rằng", "xét thấy", "lý giải", "vốn dĩ", "cổ nhân có câu"
- Giải thích chi tiết về bát tự, mệnh lý học, ngũ hành tương sinh tương khắc
- Lời khuyên mang tính triết lý sâu sắc`;

        // Current time for context
        const now = new Date();
        const currentYear = now.getFullYear();
        const currentMonth = now.getMonth() + 1;
        const currentDay = now.getDate();
        const currentTimeStr = `${currentDay}/${currentMonth}/${currentYear}`;

        // Extract key data from chartData - use actual structure from formatOutput()
        const basicInfo = chartData.thong_tin_co_ban || chartData.thong_tin || {};

        // chi_tiet_tru is an ARRAY [yearPillar, monthPillar, dayPillar, hourPillar]
        const chiTietTru = chartData.chi_tiet_tru || [];
        const yearPillar = chiTietTru[0] || {};
        const monthPillar = chiTietTru[1] || {};
        const dayPillar = chiTietTru[2] || {};
        const hourPillar = chiTietTru[3] || {};

        // Day master info from dayPillar
        const dayMaster = dayPillar.can || 'Chưa xác định';
        const dayMasterElement = dayPillar.hanh_can || (chartData.phan_tich?.can_bang_ngu_hanh?.nhat_chu_hanh || 'Chưa xác định');
        const dayMasterStrength = chartData.phan_tich?.can_bang_ngu_hanh?.nhan_dinh?.cuong_do || 'Cần phân tích thêm';

        // Get thập thần from each pillar
        const shiShen = {
            'Năm (Can)': yearPillar.thap_than_can || '',
            'Năm (Chi)': yearPillar.thap_than_chi || '',
            'Tháng (Can)': monthPillar.thap_than_can || '',
            'Tháng (Chi)': monthPillar.thap_than_chi || '',
            'Giờ (Can)': hourPillar.thap_than_can || '',
            'Giờ (Chi)': hourPillar.thap_than_chi || ''
        };

        // Get thần sát from each pillar
        const allShenSha = [
            ...(yearPillar.than_sat || []).map(s => `Năm: ${s}`),
            ...(monthPillar.than_sat || []).map(s => `Tháng: ${s}`),
            ...(dayPillar.than_sat || []).map(s => `Ngày: ${s}`),
            ...(hourPillar.than_sat || []).map(s => `Giờ: ${s}`)
        ];

        const luckyElements = chartData.phan_tich?.can_bang_ngu_hanh?.dung_than?.ngu_hanh || [];
        const avoidElements = chartData.phan_tich?.can_bang_ngu_hanh?.ky_than?.ngu_hanh || [];
        const daiVan = chartData.dai_van || [];
        const elementScores = chartData.diem_so || {};

        // Format Tứ Trụ from chi_tiet_tru array
        const formatPillarFromObj = (p) => {
            if (!p || !p.can || !p.chi) return 'Chưa có dữ liệu';
            return `${p.can} ${p.chi}`;
        };

        // Format element scores
        const elementScoreStr = Object.keys(elementScores).length > 0
            ? Object.entries(elementScores).map(([k, v]) => `- ${k}: ${v}`).join('\n')
            : '- Kim: ' + (elementScores.kim || 0) + ', Mộc: ' + (elementScores.moc || 0) +
            ', Thủy: ' + (elementScores.thuy || 0) + ', Hỏa: ' + (elementScores.hoa || 0) +
            ', Thổ: ' + (elementScores.tho || 0);

        // Format thập thần
        const shiShenStr = Object.entries(shiShen)
            .filter(([k, v]) => v)
            .map(([k, v]) => `- ${k}: ${v}`).join('\n') || '- Thập thần đang được tính toán';

        // Format thần sát
        const shenShaStr = allShenSha.length > 0
            ? allShenSha.slice(0, 10).map(s => `- ${s}`).join('\n')
            : '- Chưa có thần sát đặc biệt';

        // Format đại vận
        const daiVanStr = Array.isArray(daiVan) && daiVan.length > 0
            ? daiVan.slice(0, 5).map(d => {
                const startAge = d.tuoi_bat_dau || d.tuoi_start || '?';
                const canChi = d.can_chi || `${d.can || ''} ${d.chi || ''}`;
                const startYear = d.nam || '';
                return `- Tuổi ${startAge}+: ${canChi} (từ năm ${startYear})`;
            }).join('\n')
            : '- Đại vận đang được tính toán';

        // Calculate time info for predictions
        const tomorrow = new Date(now);
        tomorrow.setDate(tomorrow.getDate() + 1);
        const tomorrowStr = `${tomorrow.getDate()}/${tomorrow.getMonth() + 1}/${tomorrow.getFullYear()}`;

        const nextMonth = currentMonth === 12 ? 1 : currentMonth + 1;
        const nextMonthYear = currentMonth === 12 ? currentYear + 1 : currentYear;

        const monthNames = ['', 'Tháng Giêng', 'Tháng Hai', 'Tháng Ba', 'Tháng Tư', 'Tháng Năm', 'Tháng Sáu',
            'Tháng Bảy', 'Tháng Tám', 'Tháng Chín', 'Tháng Mười', 'Tháng Mười Một', 'Tháng Chạp'];

        const prompt = `Bạn là ${personaName}, một chuyên gia Bát Tự (Tử Vi).
${personaStyle}

THỜI ĐIỂM HIỆN TẠI: ${currentTimeStr} (Năm ${currentYear}, ${monthNames[currentMonth]})
NGÀY MAI: ${tomorrowStr}
THÁNG SAU: ${monthNames[nextMonth]} năm ${nextMonthYear}

Hãy tổng hợp và luận giải đầy đủ lá số Bát Tự sau đây. Bao gồm:

**PHẦN 1: PHÂN TÍCH BẢN MỆNH**
1. Tổng quan về Nhật chủ (bản mệnh) - giải thích chi tiết Tứ Trụ
2. Phân tích tính cách, ưu điểm, nhược điểm
3. Phân tích sự nghiệp và tài lộc
4. Phân tích tình duyên và gia đạo
5. Phân tích sức khỏe cần lưu ý
6. Các sao thần sát quan trọng và ý nghĩa

**PHẦN 2: DỰ BÁO THEO THỜI GIAN**
7. Vận hạn NGÀY MAI (${tomorrowStr}) - điều cần lưu ý, nên làm gì, tránh gì
8. Vận hạn THÁNG NÀY (${monthNames[currentMonth]} ${currentYear}) - xu hướng chung, cơ hội, thách thức
9. Vận hạn THÁNG SAU (${monthNames[nextMonth]} ${nextMonthYear}) - dự báo và chuẩn bị
10. Tổng quan NĂM ${currentYear} - Đại vận hiện tại và lời khuyên

**PHẦN 3: HƯỚNG DẪN THỰC HÀNH**
11. Vật phẩm phong thủy, màu sắc may mắn, hướng tốt

LƯU Ý QUAN TRỌNG VỀ TRÌNH BÀY:
- Không sử dụng quá nhiều ký tự markdown đặc biệt.
- Sử dụng in đậm (**) một cách tiết chế, chỉ dùng cho các từ khóa hoặc ý cực kỳ quan trọng. Không bôi đậm cả câu dài.
- Trình bày rõ ràng, ngắt đoạn hợp lý.
- Luôn giữ đúng phong cách (persona) đã chọn.

THÔNG TIN LÁ SỐ:
- Họ tên: ${basicInfo.ten || basicInfo.name || 'Mệnh chủ'}
- Ngày sinh: ${basicInfo.ngay_sinh || basicInfo.birth_date || 'Theo lá số'}
- Giới tính: ${basicInfo.gioi_tinh || basicInfo.gender || 'Nam/Nữ'}

TỨ TRỤ (Năm-Tháng-Ngày-Giờ):
- Năm: ${formatPillarFromObj(yearPillar)} (Nạp Âm: ${yearPillar.nap_am || ''})
- Tháng: ${formatPillarFromObj(monthPillar)} (Nạp Âm: ${monthPillar.nap_am || ''})
- Ngày: ${formatPillarFromObj(dayPillar)} (Nạp Âm: ${dayPillar.nap_am || ''}) ← NHẬT CHỦ
- Giờ: ${formatPillarFromObj(hourPillar)} (Nạp Âm: ${hourPillar.nap_am || ''})

NHẬT CHỦ: ${dayMaster} (Hành ${dayMasterElement})
CƯỜNG NHƯỢC: ${dayMasterStrength}

DỤNG THẦN (Ngũ hành có lợi): ${Array.isArray(luckyElements) && luckyElements.length > 0 ? luckyElements.join(', ') : 'Cần phân tích từ lá số'}
KỴ THẦN (Ngũ hành bất lợi): ${Array.isArray(avoidElements) && avoidElements.length > 0 ? avoidElements.join(', ') : 'Cần phân tích từ lá số'}

ĐIỂM NGŨ HÀNH:
${elementScoreStr}

THẬP THẦN (Quan hệ ngũ hành):
${shiShenStr}

THẦN SÁT QUAN TRỌNG:
${shenShaStr}

ĐẠI VẬN HIỆN TẠI VÀ SẮP TỚI:
${daiVanStr}

LƯU Ý QUAN TRỌNG: 
- Nếu có thông tin nào chưa có dữ liệu, hãy bỏ qua phần đó hoặc đưa ra nhận định dựa trên các thông tin khác có sẵn. 
- KHÔNG được để các placeholder như [X] trong câu trả lời.
- Phải luận giải chi tiết về TỨ TRỤ, giải thích ý nghĩa của từng trụ (Năm, Tháng, Ngày, Giờ).
- Đề cập cụ thể các Can Chi và ngũ hành tương ứng trong bản mệnh.

Hãy viết một bản luận giải đầy đủ, chi tiết, có tổ chức rõ ràng, dài khoảng 800-1200 từ. Điền đầy đủ các thông tin cụ thể, không để trống.

CUỐI CÙNG, hãy gợi ý 3-5 câu hỏi mà người dùng có thể muốn hỏi thêm. Viết theo format:
---GỢI Ý CÂU HỎI---
1. [Câu hỏi 1]
2. [Câu hỏi 2]
3. [Câu hỏi 3]
4. [Câu hỏi 4 - tùy chọn]
5. [Câu hỏi 5 - tùy chọn]`;

        // Call OpenRouter API
        const rawResponse = await openRouterService.generateCompletion(prompt, persona);

        // Parse response to separate interpretation from follow-up questions
        let interpretation = rawResponse;
        let followUpQuestions = [];

        const followUpMarker = '---GỢI Ý CÂU HỎI---';
        if (rawResponse.includes(followUpMarker)) {
            const parts = rawResponse.split(followUpMarker);
            interpretation = parts[0].trim();

            // Extract questions from the second part
            const questionsText = parts[1] || '';
            const questionLines = questionsText.split('\n').filter(line => line.trim());
            followUpQuestions = questionLines
                .map(line => line.replace(/^\d+\.\s*/, '').replace(/^\[|\]$/g, '').trim())
                .filter(q => q.length > 5);
        }

        // Save to consultation history
        try {
            let customerId = chartData.customerId;

            if (!customerId) {
                // Try to reconstruct customer info if missing ID
                const customerInfo = {
                    name: basicInfo.name || basicInfo.ho_ten || basicInfo.ten || 'Mệnh chủ',
                    year: parseInt(basicInfo.year || basicInfo.nam_sinh),
                    month: parseInt(basicInfo.month || basicInfo.thang_sinh),
                    day: parseInt(basicInfo.day || basicInfo.ngay_sinh),
                    hour: parseInt(basicInfo.hour || basicInfo.gio_sinh || 12),
                    minute: parseInt(basicInfo.minute || basicInfo.phut_sinh || 0),
                    gender: basicInfo.gender || basicInfo.gioi_tinh || 'Nam',
                    calendar: basicInfo.calendar || 'solar'
                };

                // Fallback for ngay_duong_lich format (e.g. "25/12/1995")
                if (isNaN(customerInfo.year) && basicInfo.ngay_duong_lich) {
                    const parts = basicInfo.ngay_duong_lich.split('/');
                    if (parts.length >= 3) {
                        customerInfo.day = parseInt(parts[0]);
                        customerInfo.month = parseInt(parts[1]);
                        customerInfo.year = parseInt(parts[2]);
                    }
                }

                if (!isNaN(customerInfo.year)) {
                    customerId = await dbService.findOrCreateCustomer(customerInfo);
                }
            }

            if (customerId) {
                // Format answer as array of paragraphs to match DB storage format
                const paragraphs = interpretation.split('\n\n').filter(p => p.trim());

                await dbService.saveConsultation(
                    customerId,
                    'comprehensive',
                    'comprehensive',
                    `Tổng hợp luận giải phong cách ${personaName}`,
                    paragraphs, // Save as array
                    true,
                    CREDIT_COST_COMPREHENSIVE,
                    userId,
                    persona,
                    followUpQuestions
                );
            }
        } catch (dbError) {
            console.error('[DB] Failed to save comprehensive consultation:', dbError);
        }

        res.json({
            interpretation,
            followUpQuestions,
            persona: personaName,
            creditsUsed: CREDIT_COST_COMPREHENSIVE
        });


    } catch (error) {
        console.error('Comprehensive Interpretation Error:', error);
        res.status(500).json({ error: 'Có lỗi xảy ra khi tổng hợp luận giải', message: error.message });
    }
});

module.exports = router;
