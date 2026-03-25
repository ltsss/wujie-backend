const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const { authenticateToken, requireRole } = require('../middleware/auth');
const BookingModel = require('../models/Booking');
const LogModel = require('../models/Log');

// 公开接口：创建预约
router.post('/', [
    body('customer_name').trim().notEmpty().withMessage('请填写您的称呼'),
    body('customer_phone').trim().notEmpty().withMessage('请填写联系电话'),
    body('customer_phone').matches(/^1[3-9]\d{9}$/).withMessage('请填写正确的手机号'),
    body('product_series').trim().notEmpty().withMessage('请选择产品系列'),
    body('product_model').trim().notEmpty().withMessage('请选择产品型号'),
    body('marble_type').trim().notEmpty().withMessage('请选择大理石类型')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ 
                success: false, 
                errors: errors.array() 
            });
        }

        const { customer_name, customer_phone, product_series, product_model, marble_type, estimated_price } = req.body;

        const bookingId = await BookingModel.create({
            customer_name,
            customer_phone,
            product_series,
            product_model,
            marble_type,
            estimated_price: estimated_price || null
        });

        res.status(201).json({
            success: true,
            message: '预约提交成功，我们会尽快与您联系',
            data: { id: bookingId }
        });
    } catch (error) {
        console.error('创建预约错误:', error);
        res.status(500).json({ 
            success: false, 
            message: '服务器错误，请稍后重试' 
        });
    }
});

// 以下接口需要认证
router.use(authenticateToken);

// 获取预约列表
router.get('/', async (req, res) => {
    try {
        const { status, page, limit } = req.query;
        const result = await BookingModel.findAll({ status, page, limit });

        res.json({
            success: true,
            data: result.data,
            pagination: result.pagination
        });
    } catch (error) {
        console.error('获取预约列表错误:', error);
        res.status(500).json({ 
            success: false, 
            message: '服务器错误' 
        });
    }
});

// 获取预约统计
router.get('/stats', async (req, res) => {
    try {
        const stats = await BookingModel.getStats();
        res.json({
            success: true,
            data: stats
        });
    } catch (error) {
        console.error('获取统计错误:', error);
        res.status(500).json({ 
            success: false, 
            message: '服务器错误' 
        });
    }
});

// 获取单个预约
router.get('/:id', async (req, res) => {
    try {
        const booking = await BookingModel.findById(req.params.id);
        if (!booking) {
            return res.status(404).json({ 
                success: false, 
                message: '预约不存在' 
            });
        }

        res.json({
            success: true,
            data: booking
        });
    } catch (error) {
        console.error('获取预约详情错误:', error);
        res.status(500).json({ 
            success: false, 
            message: '服务器错误' 
        });
    }
});

// 更新预约
router.put('/:id', [
    body('status').optional().isIn(['pending', 'contacted', 'quoted', 'closed']).withMessage('无效的状态'),
    body('notes').optional().trim()
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ 
                success: false, 
                errors: errors.array() 
            });
        }

        const { status, notes } = req.body;
        const updates = { status, notes, handled_by: req.user.id };

        const success = await BookingModel.update(req.params.id, updates);
        if (!success) {
            return res.status(404).json({ 
                success: false, 
                message: '预约不存在' 
            });
        }

        // 记录日志
        await LogModel.create({
            user_id: req.user.id,
            action: '更新预约',
            details: `更新预约 #${req.params.id}, 状态: ${status}`,
            ip_address: req.ip
        });

        res.json({
            success: true,
            message: '更新成功'
        });
    } catch (error) {
        console.error('更新预约错误:', error);
        res.status(500).json({ 
            success: false, 
            message: '服务器错误' 
        });
    }
});

// 删除预约 (仅 admin)
router.delete('/:id', requireRole('admin'), async (req, res) => {
    try {
        const success = await BookingModel.delete(req.params.id);
        if (!success) {
            return res.status(404).json({ 
                success: false, 
                message: '预约不存在' 
            });
        }

        // 记录日志
        await LogModel.create({
            user_id: req.user.id,
            action: '删除预约',
            details: `删除预约 #${req.params.id}`,
            ip_address: req.ip
        });

        res.json({
            success: true,
            message: '删除成功'
        });
    } catch (error) {
        console.error('删除预约错误:', error);
        res.status(500).json({ 
            success: false, 
            message: '服务器错误' 
        });
    }
});

module.exports = router;
