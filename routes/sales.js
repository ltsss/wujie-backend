const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const { authenticateToken } = require('../middleware/auth');
const SalesModel = require('../models/Sales');
const AssignmentModel = require('../models/Assignment');
const BookingModel = require('../models/Booking');
const FollowUpModel = require('../models/FollowUp');

// 所有路由都需要登录
router.use(authenticateToken);

// 获取当前销售信息
router.get('/profile', async (req, res) => {
    try {
        const sales = await SalesModel.findByUserId(req.user.id);
        if (!sales) {
            return res.status(403).json({ success: false, message: '您不是销售人员' });
        }
        res.json({ success: true, data: sales });
    } catch (error) {
        console.error('获取销售信息错误:', error);
        res.status(500).json({ success: false, message: '服务器错误' });
    }
});

// 获取工作台数据
router.get('/dashboard', async (req, res) => {
    try {
        const sales = await SalesModel.findByUserId(req.user.id);
        if (!sales) {
            return res.status(403).json({ success: false, message: '您不是销售人员' });
        }

        // 获取统计
        const stats = await SalesModel.getStats(sales.id);
        
        // 今日待跟进
        const todayFollowUps = await FollowUpModel.getTodayFollowUps(sales.id);
        
        // 最近分配的客户（最近5个）
        const recentCustomers = await AssignmentModel.getBySalesId({ 
            sales_id: sales.id, 
            page: 1, 
            limit: 5 
        });

        res.json({
            success: true,
            data: {
                sales_info: sales,
                stats,
                today_follow_ups: todayFollowUps,
                recent_customers: recentCustomers.data
            }
        });
    } catch (error) {
        console.error('获取工作台数据错误:', error);
        res.status(500).json({ success: false, message: '服务器错误' });
    }
});

// 获取我的客户列表
router.get('/bookings', async (req, res) => {
    try {
        const sales = await SalesModel.findByUserId(req.user.id);
        if (!sales) {
            return res.status(403).json({ success: false, message: '您不是销售人员' });
        }

        const { status, page = 1, limit = 20 } = req.query;
        const result = await AssignmentModel.getBySalesId({ 
            sales_id: sales.id, 
            status, 
            page, 
            limit 
        });

        res.json({ success: true, ...result });
    } catch (error) {
        console.error('获取客户列表错误:', error);
        res.status(500).json({ success: false, message: '服务器错误' });
    }
});

// 获取客户详情
router.get('/bookings/:id', async (req, res) => {
    try {
        const sales = await SalesModel.findByUserId(req.user.id);
        if (!sales) {
            return res.status(403).json({ success: false, message: '您不是销售人员' });
        }

        const { id } = req.params;
        const booking = await BookingModel.findById(id);

        if (!booking) {
            return res.status(404).json({ success: false, message: '客户不存在' });
        }

        // 检查是否是自己的客户
        if (booking.assigned_to !== sales.id && req.user.role !== 'admin') {
            return res.status(403).json({ success: false, message: '无权查看此客户' });
        }

        // 获取跟进记录
        const followUps = await FollowUpModel.getByBookingId(id);

        res.json({
            success: true,
            data: {
                ...booking,
                follow_ups: followUps
            }
        });
    } catch (error) {
        console.error('获取客户详情错误:', error);
        res.status(500).json({ success: false, message: '服务器错误' });
    }
});

// 添加跟进记录
router.post('/bookings/:id/followup', [
    body('contact_type').isIn(['phone', 'wechat', 'visit', 'other']).withMessage('请选择联系类型'),
    body('contact_result').trim().notEmpty().withMessage('请填写沟通结果'),
    body('content').trim().notEmpty().withMessage('请填写跟进内容'),
    body('next_follow_up').optional().isDate().withMessage('下次跟进日期格式不正确'),
    body('next_follow_up_note').optional().trim()
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ success: false, errors: errors.array() });
        }

        const sales = await SalesModel.findByUserId(req.user.id);
        if (!sales) {
            return res.status(403).json({ success: false, message: '您不是销售人员' });
        }

        const { id } = req.params;
        const booking = await BookingModel.findById(id);

        if (!booking) {
            return res.status(404).json({ success: false, message: '客户不存在' });
        }

        // 检查是否是自己的客户
        if (booking.assigned_to !== sales.id && req.user.role !== 'admin') {
            return res.status(403).json({ success: false, message: '无权操作此客户' });
        }

        const followUpId = await FollowUpModel.create({
            booking_id: id,
            sales_id: sales.id,
            ...req.body
        });

        res.status(201).json({ success: true, message: '跟进记录添加成功', data: { id: followUpId } });
    } catch (error) {
        console.error('添加跟进记录错误:', error);
        res.status(500).json({ success: false, message: '服务器错误' });
    }
});

// 更新客户状态
router.put('/bookings/:id/status', [
    body('status').isIn(['pending', 'contacted', 'quoted', 'closed']).withMessage('状态不正确'),
    body('notes').optional().trim()
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ success: false, errors: errors.array() });
        }

        const sales = await SalesModel.findByUserId(req.user.id);
        if (!sales) {
            return res.status(403).json({ success: false, message: '您不是销售人员' });
        }

        const { id } = req.params;
        const booking = await BookingModel.findById(id);

        if (!booking) {
            return res.status(404).json({ success: false, message: '客户不存在' });
        }

        // 检查是否是自己的客户
        if (booking.assigned_to !== sales.id && req.user.role !== 'admin') {
            return res.status(403).json({ success: false, message: '无权操作此客户' });
        }

        await BookingModel.update(id, {
            status: req.body.status,
            notes: req.body.notes
        });

        res.json({ success: true, message: '状态更新成功' });
    } catch (error) {
        console.error('更新客户状态错误:', error);
        res.status(500).json({ success: false, message: '服务器错误' });
    }
});

// 获取今日待跟进列表
router.get('/today-followups', async (req, res) => {
    try {
        const sales = await SalesModel.findByUserId(req.user.id);
        if (!sales) {
            return res.status(403).json({ success: false, message: '您不是销售人员' });
        }

        const followUps = await FollowUpModel.getTodayFollowUps(sales.id);
        res.json({ success: true, data: followUps });
    } catch (error) {
        console.error('获取今日待跟进错误:', error);
        res.status(500).json({ success: false, message: '服务器错误' });
    }
});

// 获取我的跟进记录
router.get('/followups', async (req, res) => {
    try {
        const sales = await SalesModel.findByUserId(req.user.id);
        if (!sales) {
            return res.status(403).json({ success: false, message: '您不是销售人员' });
        }

        const { page = 1, limit = 20 } = req.query;
        const result = await FollowUpModel.getBySalesId({ 
            sales_id: sales.id, 
            page, 
            limit 
        });

        res.json({ success: true, ...result });
    } catch (error) {
        console.error('获取跟进记录错误:', error);
        res.status(500).json({ success: false, message: '服务器错误' });
    }
});

module.exports = router;
