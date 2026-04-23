/**
 * Routes for Xin Quẻ (Divination) Feature
 */

const express = require('express');
const router = express.Router();
const queService = require('../services/que.service');
const baziService = require('../services/bazi.service');
const database = require('../services/db');
const dateUtils = require('../utils/dateUtils');
const { authenticateToken } = require('../middleware/auth');
const { HEXAGRAMS, TRIGRAMS } = require('../bazi/que_data/gua_64');
const { INTERPRETATIONS } = require('../bazi/que_data/interpretations');
const { Solar, Lunar } = require('lunar-javascript');


// Middleware to shape user info from authenticated request
const shapeUserInfo = (req, res, next) => {
    // req.user is guaranteed to exist due to authenticateToken
    req.userInfo = {
        userId: req.user.id,
        customerId: req.query.customerId ? parseInt(req.query.customerId) : null
    };
    next();
};

const GAN_NAMES = { '甲': 'Giáp', '乙': 'Ất', '丙': 'Bính', '丁': 'Đinh', '戊': 'Mậu', '己': 'Kỷ', '庚': 'Canh', '辛': 'Tân', '壬': 'Nhâm', '癸': 'Quý' };
const ZHI_NAMES = { '子': 'Tý', '丑': 'Sửu', '寅': 'Dần', '卯': 'Mão', '辰': 'Thìn', '巳': 'Tỵ', '午': 'Ngọ', '未': 'Mùi', '申': 'Thân', '酉': 'Dậu', '戌': 'Tuất', '亥': 'Hợi' };

// Helper to generate contextId from birth params
const generateContextId = (params) => {
    const { year, month, day, hour, minute, gender } = params;
    return `${year}${month.toString().padStart(2, '0')}${day.toString().padStart(2, '0')}${hour || 12}${minute || 0}${gender === 'Nữ' ? 'F' : 'M'}`;
};

// Helper: Get Detailed Element Description
const getPillarDesc = (char, type) => {
    const data = {
        'Giáp': 'Thế đứng vững chãi, chủ về sự thẳng thắn, phát triển.',
        'Ất': 'Mềm mại như cỏ cây, chủ về sự tinh tế, thích nghi.',
        'Bính': 'Rực rỡ như mặt trời, chủ về sự nồng nhiệt, lan tỏa.',
        'Đinh': 'Ấm áp như ngọn đèn, chủ về sự tỉ mỉ, soi sáng.',
        'Mậu': 'Vững chãi như núi cao, chủ về trách nhiệm, ranh giới.',
        'Kỷ': 'Bao dung như đất vườn, chủ về sự nuôi dưỡng, ổn định.',
        'Canh': 'Cứng cáp như sắt thép, chủ về sự nghĩa khí, quyết liệt.',
        'Tân': 'Lấp lánh như trang sức, chủ về sự thanh cao, nhạy bén.',
        'Nhâm': 'Mênh mông như đại dương, chủ về trí tuệ, dòng chảy.',
        'Quý': 'Dịu mát như mưa móc, chủ về sự thấu hiểu, kiên trì.',
        'Tý': 'Sự khởi đầu, nhạy bén, thiên về trí tuệ và cảm xúc.',
        'Sửu': 'Bền bỉ, kiên định, thiên về thực tế và lao động.',
        'Dần': 'Mạnh mẽ, bùng nổ, thiên về hành động và uy quyền.',
        'Mão': 'Tinh tế, uyển chuyển, thiên về giao tiếp và khéo léo.',
        'Thìn': 'Biến hóa, quyền uy, thiên về tham vọng và sự thay đổi.',
        'Tỵ': 'Biến ảo, quyến rũ, thiên về trực giác và mưu lược.',
        'Ngọ': 'Năng động, bộc trực, thiên về tốc độ và sự rõ ràng.',
        'Mùi': 'Ôn hòa, sâu sắc, thiên về tình cảm và sự nhẫn nại.',
        'Thân': 'Thông minh, linh hoạt, thiên về kỹ thuật và phản ứng nhanh.',
        'Dậu': 'Chỉnh chu, sắc bén, thiên về chi tiết và sự hoàn mỹ.',
        'Tuất': 'Trung thành, bảo vệ, thiên về nguyên tắc và đạo đức.',
        'Hợi': 'Khoan dung, hưởng lạc, thiên về tinh thần và sự hài hòa.'
    };
    return data[char] || '';
};

// Helper: Get Element of Stem/Branch
const getElement = (char) => {
    const elements = {
        'Giáp': 'Mộc', 'Ất': 'Mộc', 'Dần': 'Mộc', 'Mão': 'Mộc',
        'Bính': 'Hỏa', 'Đinh': 'Hỏa', 'Tỵ': 'Hỏa', 'Ngọ': 'Hỏa',
        'Mậu': 'Thổ', 'Kỷ': 'Thổ', 'Thìn': 'Thổ', 'Tuất': 'Thổ', 'Sửu': 'Thổ', 'Mùi': 'Thổ',
        'Canh': 'Kim', 'Tân': 'Kim', 'Thân': 'Kim', 'Dậu': 'Kim',
        'Nhâm': 'Thủy', 'Quý': 'Thủy', 'Hợi': 'Thủy', 'Tý': 'Thủy'
    };
    return elements[char] || 'Thổ';
};

// Helper: Generate Rich Markdown Content
const generateRichAnalysis = (hexInfo, topicLabel, topicKey, interpretationText, interpretation) => {
    // Use Vietnam time for date calculations
    const vnNow = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Ho_Chi_Minh' }));
    const solar = Solar.fromDate(vnNow);
    const lunar = Lunar.fromSolar(solar);

    // Get Hanzi and map to Vietnamese
    const dayGanHanzi = lunar.getDayGan();
    const dayZhiHanzi = lunar.getDayZhi();

    const dayGan = GAN_NAMES[dayGanHanzi] || dayGanHanzi;
    const dayZhi = ZHI_NAMES[dayZhiHanzi] || dayZhiHanzi;

    const dayGanElement = getElement(dayGan);
    const dayZhiElement = getElement(dayZhi);

    const pillarIntro = {
        'love': 'khiến tình duyên hôm nay thiên về hành động thực tế hơn là lời nói suông. Sự quan tâm thầm lặng sẽ có giá trị lớn hơn ngàn lời hứa.',
        'wealth': 'khiến vận tài lộc hôm nay đòi hỏi sự quyết đoán và nắm bắt cơ hội nhanh nhạy. Những dự tính cũ cần được xem xét lại dưới góc độ thực tế.',
        'safety': 'khiến vận hạn hôm nay cần được lưu tâm đặc biệt đến các phương diện giao tiếp và di chuyển. Sự cẩn trọng sẽ là chìa khóa để giữ vững bình an.'
    };

    const generateElementAdvice = (userElement) => {
        const relations = {
            'Mộc': {
                'love': 'Cảm xúc hôm nay dễ bị nén lại. Bạn có thể cảm thấy mình phải cố gắng nhiều hơn để được thấu hiểu. Đừng suy diễn quá sâu.',
                'wealth': 'Tài lộc có dấu hiệu bị kìm hãm. Cần kiên nhẫn tích lũy thay vì mạo hiểm đầu tư lớn lúc này.',
                'safety': 'Sức khỏe cần lưu tâm đến gan và hệ thần kinh. Tránh stress và làm việc quá sức.'
            },
            'Hỏa': {
                'love': 'Bạn có xu hướng cho đi nhiều hơn, nhưng dễ cảm thấy không được đáp lại tương xứng. Hãy chú ý giới hạn của mình.',
                'wealth': 'Tiền bạc dễ chi dùng cho việc giao tiếp, xã giao. Cần cân đối ngân sách để tránh hao hụt không đáng có.',
                'safety': 'Cẩn trọng với các vấn đề liên quan đến hỏa hoạn hoặc nóng nảy dẫn đến xô xát.'
            },
            'Thổ': {
                'love': 'Tình cảm có xu hướng ổn định, nhưng thiếu đi sự bất ngờ. Hãy chủ động tạo ra niềm vui nhỏ cho đối phương.',
                'wealth': 'Vận tài lộc khá vững chắc. Đây là thời điểm tốt để lập kế hoạch tài chính dài hạn hoặc thu hồi công nợ.',
                'safety': 'Mọi sự bình an, tuy nhiên cần chú ý đến vấn đề tiêu hóa và ăn uống điều độ.'
            },
            'Kim': {
                'love': 'Bạn dễ giữ thế chủ động trong giao tiếp. Đây là lúc phù hợp để trao đổi thẳng thắn nhưng cần giữ thái độ ôn hòa.',
                'wealth': 'Cơ hội kiếm dồi dào, nhưng cạnh tranh cũng cao. Cần sự sắc bén và quyết liệt để đạt được mục tiêu.',
                'safety': 'Đề phòng thương tích do kim loại hoặc các sự cố khi tham gia giao thông tốc độ cao.'
            },
            'Thủy': {
                'love': 'Dễ cảm thấy hụt năng lượng cảm xúc. Nên giữ nhịp nhẹ, lắng nghe nhiều hơn thay vì cố ép bản thân phải nói ra.',
                'wealth': 'Tài chính như dòng nước chảy, dễ đến dễ đi. Cần quản lý chặt chẽ chi tiêu cá nhân.',
                'safety': 'Cẩn trọng với các khu vực sông nước hoặc các bệnh liên quan đến đường tiết niệu, cảm lạnh.'
            }
        };
        return relations[userElement][topicKey] || 'Mọi sự bình ổn, cần theo dõi thêm biến động của ngày.';
    };

    return `### Ảnh hưởng chung của Can Chi ngày

**Thiên Can ${dayGan} (${dayGanElement})**: ${getPillarDesc(dayGan)}
**Địa Chi ${dayZhi} (${dayZhiElement})**: ${getPillarDesc(dayZhi)}

Sự kết hợp này ${pillarIntro[topicKey] || 'mang đến năng lượng tương tác mạnh mẽ cho vạn vật.'}

---

### Chiêm nghiệm quẻ ${hexInfo.name} về ${topicLabel}

*Tượng quẻ: ${hexInfo.symbol} - ${hexInfo.meaning}*

Trong chiều sâu đạo dịch, quẻ **${hexInfo.name}** nhắc nhở chúng ta rằng: "${interpretation.overview}".

Đối với phương diện **${topicLabel}**, quẻ này chỉ ra rằng:
${interpretationText}

---

### 🔍 Nếu bạn thuộc Bát Tự sau, hãy lưu ý:

🔹 **Nhật chủ mệnh Mộc**
👉 ${generateElementAdvice('Mộc')}

🔹 **Nhật chủ mệnh Hỏa**
👉 ${generateElementAdvice('Hỏa')}

🔹 **Nhật chủ mệnh Thổ**
👉 ${generateElementAdvice('Thổ')}

🔹 **Nhật chủ mệnh Kim**
👉 ${generateElementAdvice('Kim')}

🔹 **Nhật chủ mệnh Thủy**
👉 ${generateElementAdvice('Thủy')}

---

### ✨ Lời nhắc cho hôm nay

${interpretationText}

### 🔎 Vì sao mỗi người đọc sẽ thấy khác nhau?

Những phân tích trên mới chỉ dựa vào Can Chi ngày và ngũ hành Nhật chủ cơ bản. Trong thực tế, cát hung của mỗi người còn phụ thuộc vào:
- **Thập thần liên quan** đến tình cảm, tài lộc (Tài – Quan – Ấn – Thực – Tỷ)
- **Cấu trúc lá số** mạnh hay yếu về duyên phận và vận may
- **Vận tháng – vận năm** đang kích hoạt những cung vị nào

**👉 Khi nhập lá số Bát Tự đầy đủ, hệ thống sẽ cho bạn biết:**
- Hôm nay là ngày thuận duyên hay thử thách đối với riêng bạn
- Nên chủ động hành động, giữ khoảng cách hay kiên nhẫn chờ thời
- Ảnh hưởng này chỉ diễn ra ngắn hạn hay là dấu hiệu của một đại vận mới

📌 **Điền lá số để nhận luận giải cá nhân hóa chi tiết nhất về vận trình của chính bạn.**`;
};

// GET /api/que/quick-random
// Public endpoint for random hexagram
router.get('/quick-random', async (req, res) => {
    try {
        const { topic } = req.query; // 'love', 'wealth', 'safety'

        // 1. Random Hexagram ID (1-64)
        const hexId = Math.floor(Math.random() * 64) + 1;
        const hexInfo = HEXAGRAMS[hexId];
        const interpretation = INTERPRETATIONS[hexId];

        if (!hexInfo || !interpretation) {
            return res.status(500).json({ error: 'Failed to generate hexagram' });
        }

        // 2. Map Topic to Data Key
        let mappingKey = 'career';
        let topicLabel = 'Tổng Quan';

        switch (topic) {
            case 'love':
                mappingKey = 'love';
                topicLabel = 'Tình Duyên';
                break;
            case 'wealth':
                mappingKey = 'finance';
                topicLabel = 'Tài Lộc';
                break;
            case 'safety':
                mappingKey = 'safety';
                topicLabel = 'Tai Tinh & Bình An';
                break;
        }

        const rawInterpretation = interpretation.aspects[mappingKey] || interpretation.overview;

        // 3. Generate Rich Content
        const richContent = generateRichAnalysis(hexInfo, topicLabel, topic, rawInterpretation, interpretation);

        // 4. Construct Result
        const result = {
            id: hexId,
            name: hexInfo.name,
            symbol: hexInfo.symbol,
            meaning: hexInfo.meaning,
            quality: hexInfo.quality,
            topic: topicLabel,
            overview: interpretation.overview,
            interpretation: rawInterpretation, // Short version for preview if needed
            ai_analysis: richContent, // This will be rendered as Markdown
            advice: interpretation.advice,
            disclaimer: "Kết quả gieo quẻ ngẫu nhiên mang tính chất tham khảo. Độ chính xác phụ thuộc vào sự thành tâm của người gieo. Để có kết quả chính xác theo mệnh lý (Bát Tự), vui lòng điền ngày giờ sinh để hệ thống tính toán năng lượng Mệnh khuyết và Vận hạn chính xác."
        };

        res.json(result);
    } catch (error) {
        console.error('Quick Random Error:', error);
        res.status(500).json({ error: error.message });
    }
});

// GET /api/que/daily
// Params: birth info (year, month, day, hour...)
router.get('/daily', authenticateToken, shapeUserInfo, async (req, res) => {
    try {
        const { year, month, day, hour, minute, gender, topic, forceNew } = req.query;

        // Validate required birth data
        if (!year || !month || !day) {
            return res.status(400).json({ error: 'Missing birth data' });
        }

        // Calculate Bazi Context
        const baziContext = await baziService.analyzeComplete({
            year: parseInt(year),
            month: parseInt(month),
            day: parseInt(day),
            hour: parseInt(hour || 12),
            minute: parseInt(minute || 0),
            gender: gender || 'Nam'
        });

        const today = dateUtils.getVNDateString(); // YYYY-MM-DD (Vietnam Time)
        const contextId = generateContextId(req.query);
        const result = await queService.generateDailyQue(baziContext, req.userInfo, today, contextId, topic, forceNew === 'true');

        res.json(result);
    } catch (error) {
        console.error('Daily Que Error:', error);
        res.status(500).json({ error: error.message });
    }
});

// GET /api/que/monthly
router.get('/monthly', authenticateToken, shapeUserInfo, async (req, res) => {
    try {
        const { year, month, day, hour, minute, gender, topic, forceNew } = req.query;
        if (!year || !month || !day) {
            return res.status(400).json({ error: 'Missing birth data' });
        }

        const baziContext = await baziService.analyzeComplete({
            year: parseInt(year), month: parseInt(month), day: parseInt(day),
            hour: parseInt(hour || 12), minute: parseInt(minute || 0), gender: gender || 'Nam'
        });

        const currentMonth = dateUtils.getVNMonthString(); // YYYY-MM (Vietnam Time)
        const contextId = generateContextId(req.query);
        const result = await queService.generateMonthlyQue(baziContext, req.userInfo, currentMonth, contextId, topic, forceNew === 'true');

        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET /api/que/history
router.get('/history', authenticateToken, shapeUserInfo, async (req, res) => {
    try {
        const userId = req.userInfo.userId;
        if (!userId) return res.status(401).json({ error: 'Unauthorized' });

        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;

        const historyData = await queService.getHistory(userId, page, limit);
        res.json(historyData);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET /api/que/timeline - Get recent hexagrams for timeline visualization
router.get('/timeline', authenticateToken, shapeUserInfo, async (req, res) => {
    try {
        const userId = req.userInfo.userId;
        if (!userId) return res.status(401).json({ error: 'Unauthorized' });

        const { type = 'daily', limit = 7 } = req.query;

        // Get recent consultations of specific type
        const query = `
            SELECT id, answer, metadata, created_at 
            FROM consultations 
            WHERE user_id = ? AND theme_id = 'xin_que' 
            AND metadata LIKE '%"queType":"${type}"%'
            ORDER BY created_at DESC 
            LIMIT ?
        `;

        const results = await database.all(query, [userId, parseInt(limit)]);

        const timeline = results.map(r => {
            try {
                const meta = JSON.parse(r.metadata || '{}');
                const guaData = meta.gua_data || {};
                return {
                    id: r.id,
                    name: guaData.name || 'Unknown',
                    symbol: guaData.symbol || '☰☰',
                    quality: guaData.quality || 'Bình',
                    hexagramId: guaData.hexagramId,
                    created_at: r.created_at
                };
            } catch (e) {
                return null;
            }
        }).filter(Boolean).reverse(); // Reverse for chronological order

        res.json({ timeline, type });
    } catch (error) {
        console.error('Timeline Error:', error);
        res.status(500).json({ error: error.message });
    }
});

// GET /api/que/yearly
router.get('/yearly', authenticateToken, shapeUserInfo, async (req, res) => {
    try {
        const { year, month, day, hour, minute, gender, topic, forceNew } = req.query;
        if (!year || !month || !day) {
            return res.status(400).json({ error: 'Missing birth data' });
        }
        const baziContext = await baziService.analyzeComplete({
            year: parseInt(year), month: parseInt(month), day: parseInt(day),
            hour: parseInt(hour || 12), minute: parseInt(minute || 0), gender: gender || 'Nam'
        });
        const currentYear = dateUtils.getVNYearString(); // YYYY (Vietnam Time)
        const contextId = generateContextId(req.query);
        const result = await queService.generateYearlyQue(baziContext, req.userInfo, currentYear, contextId, topic, forceNew === 'true');
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// POST /api/que/note - Update note and verification
router.post('/note', authenticateToken, shapeUserInfo, async (req, res) => {
    try {
        const { id, note, isVerified } = req.body;
        if (!id) return res.status(400).json({ error: 'Missing id' });

        await queService.updateNote(id, note, isVerified);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
