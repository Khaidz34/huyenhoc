const express = require('express');
const router = express.Router();
const baziService = require('../services/bazi.service');
const dbService = require('../services/db');
const ganzhi = require('../bazi/ganzhi');

/**
 * GET /api/analyze - Full BaZi Analysis
 * Every request creates a new customer record for tracking
 */
router.get('/analyze', async (req, res) => {
    try {
        const { year, month, day, hour = 12, minute = 0, gender = 'Nam', calendar = 'solar', name = '' } = req.query;

        if (!year || !month || !day) {
            return res.status(400).json({ error: 'Missing required parameters: year, month, day' });
        }

        // Save customer to database (every request = new customer)
        let customerId = null;
        try {
            customerId = await dbService.createNewCustomer({
                name: name || 'Mệnh chủ',
                year: parseInt(year),
                month: parseInt(month),
                day: parseInt(day),
                hour: parseInt(hour),
                minute: parseInt(minute),
                gender,
                calendar
            });
            console.log(`[DB] New customer #${customerId} created`);
        } catch (dbError) {
            console.error('[DB] Failed to save customer:', dbError.message);
        }

        const result = await baziService.analyzeComplete({
            year: parseInt(year),
            month: parseInt(month),
            day: parseInt(day),
            hour: parseInt(hour),
            minute: parseInt(minute),
            gender,
            calendar,
            name
        });

        // Include customerId in response
        result.customerId = customerId;

        res.json(result);
    } catch (error) {
        console.error('Analyze error:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /api/chart - Basic Chart
 */
router.get('/chart', async (req, res) => {
    try {
        const { year, month, day, hour = 12, minute = 0, gender = 'Nam', calendar = 'solar' } = req.query;

        if (!year || !month || !day) {
            return res.status(400).json({ error: 'Missing required parameters' });
        }

        const result = await baziService.getBasicChart({
            year: parseInt(year),
            month: parseInt(month),
            day: parseInt(day),
            hour: parseInt(hour),
            minute: parseInt(minute),
            gender,
            calendar
        });

        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /api/elements - Ngũ Hành Analysis
 */
router.get('/elements', async (req, res) => {
    try {
        const { year, month, day, hour = 12, gender = 'Nam', calendar = 'solar' } = req.query;

        if (!year || !month || !day) {
            return res.status(400).json({ error: 'Missing required parameters' });
        }

        const result = await baziService.getElements({
            year: parseInt(year),
            month: parseInt(month),
            day: parseInt(day),
            hour: parseInt(hour),
            gender,
            calendar
        });

        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /api/stars - Thần Sát
 */
router.get('/stars', async (req, res) => {
    try {
        const { year, month, day, hour = 12, gender = 'Nam', calendar = 'solar' } = req.query;

        if (!year || !month || !day) {
            return res.status(400).json({ error: 'Missing required parameters' });
        }

        const result = await baziService.getStars({
            year: parseInt(year),
            month: parseInt(month),
            day: parseInt(day),
            hour: parseInt(hour),
            gender,
            calendar
        });

        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /api/luck-cycles - Đại Vận
 */
router.get('/luck-cycles', async (req, res) => {
    try {
        const { year, month, day, hour = 12, gender = 'Nam', calendar = 'solar' } = req.query;

        if (!year || !month || !day) {
            return res.status(400).json({ error: 'Missing required parameters' });
        }

        const result = await baziService.getLuckCycles({
            year: parseInt(year),
            month: parseInt(month),
            day: parseInt(day),
            hour: parseInt(hour),
            gender,
            calendar
        });

        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /api/year-analysis - Lưu Niên
 */
router.get('/year-analysis', async (req, res) => {
    try {
        const { year, month, day, hour = 12, gender = 'Nam', calendar = 'solar', targetYear } = req.query;

        if (!year || !month || !day) {
            return res.status(400).json({ error: 'Missing required parameters' });
        }

        const result = await baziService.getYearAnalysis({
            year: parseInt(year),
            month: parseInt(month),
            day: parseInt(day),
            hour: parseInt(hour),
            gender,
            calendar,
            targetYear: targetYear ? parseInt(targetYear) : new Date().getFullYear()
        });

        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /api/analyze-time - Alias for year-analysis for frontend compatibility
 */
router.get('/analyze-time', async (req, res) => {
    try {
        const { year, month, day, hour = 12, gender = 'Nam', target_year, target_month, target_day } = req.query;
        const result = await baziService.analyzeTimeStatus({
            year: parseInt(year),
            month: parseInt(month),
            day: parseInt(day) || 1,
            hour: parseInt(hour),
            gender,
            targetYear: parseInt(target_year),
            targetMonth: target_month ? parseInt(target_month) : null,
            targetDay: target_day ? parseInt(target_day) : null
        });

        const timeLabel = result.type === 'day' ? `ngay ${result.value}/${result.month}/${result.year}` :
            result.type === 'month' ? `thang ${result.value}/${result.year}` :
                `nam ${result.value}`;

        // Build content for THẾ CỤC section
        const theCucContent = [`**Trạng thái khí**: ${result.life_stage}`];
        if (result.luck_interaction && result.luck_interaction.length > 0) {
            result.luck_interaction.forEach(li => theCucContent.push(`➤ ${li}`));
        }
        if (result.special_stars && result.special_stars.length > 0) {
            result.special_stars.forEach(ss => theCucContent.push(`✨ **Thần sát**: ${ss}`));
        }
        // Add interpretation about the life stage
        const lifeStageNotes = {
            'Trường sinh': '➤ Năng lượng mới bắt đầu, phù hợp khởi sự mới.',
            'Mộc dục': '➤ Giai đoạn tắm gội, cần cẩn thận về danh dự.',
            'Quan đới': '➤ Năng lượng đang lên, thuận lợi cho học tập, thi cử.',
            'Lâm quan': '➤ Đang hưng vượng, thuận lợi cho sự nghiệp.',
            'Đế vượng': '➤ Năng lượng cực thịnh, dễ thành công nhưng cũng cần đề phòng.',
            'Suy': '➤ Năng lượng bắt đầu giảm, nên củng cố hơn là mạo hiểm.',
            'Bệnh': '➤ Cần chú ý sức khỏe, tránh làm việc quá sức.',
            'Tử': '➤ Năng lượng yếu, thích hợp nghỉ ngơi, tĩnh dưỡng.',
            'Mộ': '➤ Giai đoạn tích trữ, phù hợp tiết kiệm, lên kế hoạch.',
            'Tuyệt': '➤ Nên thận trọng, tránh khởi sự mới quan trọng.',
            'Thai': '➤ Có điềm báo mới, sắp có sự thay đổi.',
            'Dưỡng': '➤ Giai đoạn nuôi dưỡng, chuẩn bị cho chu kỳ mới.'
        };
        if (lifeStageNotes[result.life_stage]) {
            theCucContent.push(lifeStageNotes[result.life_stage]);
        }
        theCucContent.push(`➤ Điểm đánh giá tổng thể: ${result.score >= 0 ? 'Thuận lợi' : 'Cần cẩn thận'} (${result.score >= 0 ? '+' : ''}${result.score})`);

        // Build content for TƯƠNG TÁC section
        const tuongTacContent = result.relationships && result.relationships.length > 0
            ? result.relationships.map(r => `• ${r}`)
            : [`• Không có xung khắc đặc biệt với tứ trụ bản mệnh - thuận lợi cho hoạt động.`,
                `• Can ${result.ganzhiVN.split(' ')[0]} tương tác với Nhật Chủ theo quan hệ ${result.shishen}.`];

        const sections = [
            {
                title: `PHÂN TÍCH ${timeLabel.toUpperCase()}: ${result.ganzhiVN}`,
                icon: result.type === 'day' ? "☀️" : result.type === 'month' ? "🌙" : "🌟",
                content: [
                    `**Thập Thần**: ${result.shishen}`,
                    result.type === 'day' ? `**Âm lịch**: ${result.lunarDay} | **Trực**: ${result.jianchu}` : null,
                    result.type === 'day' && result.xiu ? `**Nhị thập bát tú**: ${result.xiu}` : null,
                    `**Sự nghiệp**: ${result.evaluations.career.desc}`,
                    `**Tài lộc**: ${result.evaluations.wealth.desc}`,
                    `**Tình cảm**: ${result.evaluations.love.desc}`,
                    `**Sức khỏe**: ${result.evaluations.health.desc}`,
                    result.interpretation ? `**Luận giải tổng quan**: ${result.interpretation}` : null
                ].filter(Boolean)
            },
            {
                title: "THẾ CỤC & THỜI VẬN",
                icon: "☯️",
                content: theCucContent
            },
            {
                title: "TƯƠNG TÁC VỚI TỨ TRỤ",
                icon: "🔗",
                content: tuongTacContent
            }
        ];

        res.json({ results: [], sections });
    } catch (error) {
        console.error("Analyze time error:", error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /api/select-dates - Alias for auspicious-dates for frontend compatibility
 */
router.get('/select-dates', async (req, res) => {
    try {
        const { year, month, day, hour = 12, gender = 'Nam', target_year, target_month, activity } = req.query;
        const result = await baziService.getAuspiciousDates({
            year: parseInt(year),
            month: parseInt(month),
            day: parseInt(day),
            hour: parseInt(hour),
            gender,
            targetYear: parseInt(target_year),
            targetMonth: parseInt(target_month),
            activity
        });

        // Format to match old Python output structure if needed, 
        // but frontend parser is quite complex. Let's provide a simplified string list.
        const activityLabel = activity ? activity.toUpperCase() : 'BẤT KỲ';
        const dates = [
            `PHÂN TÍCH CHỌN NGÀY CHO: ${activityLabel}`,
            "=========================================",
            ""
        ];

        // Group by quality
        const excellent = result.lich_thang.filter(d => d.quality === 'Đại Cát');
        const good = result.lich_thang.filter(d => d.quality === 'Tốt');
        const avoid = result.lich_thang.filter(d => d.quality === 'Đại Hung' || d.quality === 'Xấu');

        if (excellent.length > 0) {
            dates.push("🌟🌟🌟 NGÀY ĐẠI CÁT 🌟🌟🌟");
            excellent.forEach(d => {
                const vnGanzhi = d.ganzhi.split('').map((c, i) => i === 0 ? ganzhi.ganToVN(c) : ganzhi.zhiToVN(c)).join(' ');
                dates.push(`📅 Ngày ${d.date} - ${vnGanzhi} | Âm lịch: ${d.lunarDate} | Kiến trừ: ${d.jianchu} | ✅ ${d.summary}`);
            });
            dates.push("");
        }

        if (good.length > 0) {
            dates.push("✨✨✨ NGÀY TỐT ✨✨✨");
            good.forEach(d => {
                const vnGanzhi = d.ganzhi.split('').map((c, i) => i === 0 ? ganzhi.ganToVN(c) : ganzhi.zhiToVN(c)).join(' ');
                dates.push(`📅 Ngày ${d.date} - ${vnGanzhi} | Âm lịch: ${d.lunarDate} | Kiến trừ: ${d.jianchu} | ✅ ${d.summary}`);
            });
            dates.push("");
        }

        if (avoid.length > 0) {
            dates.push("⛔⛔⛔ NGÀY NÊN TRÁNH ⛔⛔⛔");
            avoid.forEach(d => {
                const vnGanzhi = d.ganzhi.split('').map((c, i) => i === 0 ? ganzhi.ganToVN(c) : ganzhi.zhiToVN(c)).join(' ');
                dates.push(`❌ Ngày ${d.date} - ${vnGanzhi} | Âm lịch: ${d.lunarDate} | Kiến trừ: ${d.jianchu} | ⚠️ ${d.summary}`);
            });
            dates.push("");
        }

        res.json({ dates });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /api/basic-info
 */
router.get('/basic-info', async (req, res) => {
    try {
        const result = await baziService.getBasicInfo(req.query);
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /api/scores - Alias for elements
 */
router.get('/scores', async (req, res) => {
    try {
        const result = await baziService.getElements(req.query);
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /api/pillars
 */
router.get('/pillars', async (req, res) => {
    try {
        const result = await baziService.getPillars(req.query);
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /api/analysis
 */
router.get('/analysis', async (req, res) => {
    try {
        const result = await baziService.getAnalysis(req.query);
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /api/advanced
 */
router.get('/advanced', async (req, res) => {
    try {
        const result = await baziService.getAdvanced(req.query);
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /api/dayun - Alias for luck-cycles
 */
router.get('/dayun', async (req, res) => {
    try {
        const result = await baziService.getLuckCycles(req.query);
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /api/classic-texts
 */
router.get('/classic-texts', async (req, res) => {
    try {
        const result = await baziService.getClassicTexts(req.query);
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /api/luan-giai
 */
router.get('/luan-giai', async (req, res) => {
    try {
        const result = await baziService.getLuanGiai(req.query);
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/matching - Compatibility Analysis between two people
 * Body: {
 *   person1: { year, month, day, hour, gender, name },
 *   person2: { year, month, day, hour, gender, name },
 *   relationship: 'romance' | 'friendship' | 'parent_child' | 'siblings' | 'business'
 * }
 */
router.post('/matching', async (req, res) => {
    try {
        const { person1, person2, relationship = 'romance' } = req.body;

        if (!person1 || !person2) {
            return res.status(400).json({ error: 'Missing person1 or person2 data' });
        }

        if (!person1.year || !person1.month || !person1.day) {
            return res.status(400).json({ error: 'Missing required fields for person1' });
        }

        if (!person2.year || !person2.month || !person2.day) {
            return res.status(400).json({ error: 'Missing required fields for person2' });
        }

        const hopHon = require('../bazi/hop_hon');

        const result = hopHon.analyzeCompatibility(
            {
                year: parseInt(person1.year),
                month: parseInt(person1.month),
                day: parseInt(person1.day),
                hour: parseInt(person1.hour) || 12,
                gender: person1.gender || 'Nam',
                name: person1.name || 'Người 1'
            },
            {
                year: parseInt(person2.year),
                month: parseInt(person2.month),
                day: parseInt(person2.day),
                hour: parseInt(person2.hour) || 12,
                gender: person2.gender || 'Nữ',
                name: person2.name || 'Người 2'
            },
            relationship
        );

        res.json(result);
    } catch (error) {
        console.error('Matching error:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/matching/ai - Comprehensive AI Compatibility Analysis
 * Requires authentication and 25 credits
 */
const authRoutes = require('./auth.routes');
const CREDIT_COST_MATCHING_AI = 25;

router.post('/matching/ai', authRoutes.authMiddleware, async (req, res) => {
    try {
        const { person1, person2, relationship = 'romance', persona = 'huyen_co' } = req.body;
        const userId = req.user.id;

        if (!person1 || !person2) {
            return res.status(400).json({ error: 'Missing person1 or person2 data' });
        }

        // Check and deduct credits
        try {
            await dbService.deductCredits(userId, CREDIT_COST_MATCHING_AI, `Luận giải Duyên Số (${relationship})`);
        } catch (creditError) {
            const user = await dbService.getUserById(userId);
            return res.status(402).json({
                error: creditError.message,
                credits_required: CREDIT_COST_MATCHING_AI,
                credits_current: user?.credits || 0
            });
        }

        const baziService = require('../services/bazi.service');
        const openRouterService = require('../services/openrouter.service');

        // Calculate detailed Bazi for both people
        const getBaziContext = (person) => {
            const BaZiCalculator = require('../bazi/calculator');
            const { analyzeNguHanh } = require('../bazi/phan_tich/ngu_hanh');
            const { calculateDaiVan } = require('../bazi/dayun');

            const g = (person.gender || '').toLowerCase();
            const isFemale = g.startsWith('n') && !g.includes('am') || g.includes('female') || g.includes('nữ');

            const calc = new BaZiCalculator({
                year: parseInt(person.year),
                month: parseInt(person.month),
                day: parseInt(person.day),
                hour: parseInt(person.hour) || 12,
                minute: parseInt(person.minute) || 0,
                isFemale: isFemale,
                isSolar: true
            });
            const ctx = calc.calculate();

            // Calculate additional details needed for Luck Cycles and AI Depth
            ctx.nguHanhResult = analyzeNguHanh(ctx);
            ctx.dai_van = calculateDaiVan(ctx);

            return ctx;
        };

        const ctx1 = getBaziContext(person1);
        const ctx2 = getBaziContext(person2);

        // Generate AI analysis
        const result = await openRouterService.generateMatchingAnswer(ctx1, ctx2, relationship, persona);

        // Map context to chart data expected by frontend
        const person1FullData = { ...person1, chart: baziService.mapToChart(ctx1) };
        const person2FullData = { ...person2, chart: baziService.mapToChart(ctx2) };

        // Save to database as a consultation
        try {
            const customerId = await dbService.findOrCreateCustomer(person1);

            await dbService.saveConsultation(
                customerId,
                'matching',
                'matching_ai',
                `Luận giải Duyên Số với ${person2.name || 'Đối phương'}`,
                result, // Pass the object, saveConsultation handles stringify
                true,
                CREDIT_COST_MATCHING_AI,
                userId,
                persona,
                result.suggestedQuestions || [],
                {
                    person1: person1FullData,
                    person2: person2FullData,
                    metadata: { relationship }
                }
            );
        } catch (dbError) {
            console.error('[DB] Failed to save AI matching consultation:', dbError);
        }

        res.json({
            ...result,
            creditsUsed: CREDIT_COST_MATCHING_AI,
            person1: person1FullData,
            person2: person2FullData
        });
    } catch (error) {
        console.error('Matching AI error:', error);
        res.status(500).json({ error: 'Internal server error', message: error.message });
    }
});

module.exports = router;

