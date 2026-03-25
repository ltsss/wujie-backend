const express = require('express');
const router = express.Router();
const { authenticateToken, requireRole } = require('../middleware/auth');
const LogModel = require('../models/Log');

// 仅 admin 可查看日志
router.use(authenticateToken, requireRole('admin'));

// 获取日志列表
router.get('/', async (req, res) => {
    try {
        const { page, limit } = req.query;
        const result = await LogModel.findAll({ page, limit });

        res.json({
            success: true,
            data: result.data,
            pagination: result.pagination
        });
    } catch (error) {
        console.error('获取日志错误:', error);
        res.status(500).json({ 
            success: false, 
            message: '服务器错误' 
        });
    }
});

module.exports = router;
