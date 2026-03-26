const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const { authenticateToken, requireRole } = require('../middleware/auth');
const { pool } = require('../config/database');
const SalesModel = require('../models/Sales');
const AssignmentModel = require('../models/Assignment');
const BookingModel = require('../models/Booking');
const FollowUpModel = require('../models/FollowUp');

// 所有路由都需要认证
router.use(authenticateToken);

// ========== 仪表盘（管理员和销售都可以访问）==========
router.get('/dashboard', async (req, res) => {
    try {
        const isSales = req.user.role === 'sales';
        const userId = req.user.id;

        // 客户统计
        let bookingStats;
        if (isSales) {
            // 销售只看自己的数据
            const [rows] = await pool.execute(
                `SELECT
                    COUNT(*) as total,
                    SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
                    SUM(CASE WHEN status = 'contacted' THEN 1 ELSE 0 END) as contacted,
                    SUM(CASE WHEN status = 'quoted' THEN 1 ELSE 0 END) as quoted,
                    SUM(CASE WHEN status = 'closed' THEN 1 ELSE 0 END) as closed
                 FROM bookings WHERE assigned_to = ?`,
                [userId]
            );
            bookingStats = rows[0];
        } else {
            bookingStats = await BookingModel.getStats();
        }

        // 今日新增
        const todayCondition = isSales ? 'AND assigned_to = ?' : '';
        const todayParams = isSales ? [userId] : [];
        const [todayResult] = await pool.execute(
            `SELECT COUNT(*) as count FROM bookings WHERE DATE(created_at) = CURDATE() ${todayCondition}`,
            todayParams
        );

        // 待分配（仅管理员）
        let unassigned = 0;
        if (!isSales) {
            const unassignedData = await AssignmentModel.getUnassigned({ page: 1, limit: 1 });
            unassigned = unassignedData.pagination.total;
        }

        // 销售列表及统计（仅管理员）
        let salesStats = [];
        if (!isSales) {
            const salesList = await SalesModel.findAll({ is_active: true });
            for (const sales of salesList) {
                const stats = await SalesModel.getStats(sales.id);
                salesStats.push({ ...sales, stats });
            }
        }

        res.json({
            success: true,
            data: {
                today_new: todayResult[0].count,
                unassigned: unassigned,
                total_bookings: bookingStats.total,
                pending: bookingStats.pending,
                booking_stats: bookingStats,
                sales_stats: salesStats,
                is_sales: isSales
            }
        });
    } catch (error) {
        console.error('获取仪表盘数据错误:', error);
        res.status(500).json({ success: false, message: '服务器错误' });
    }
});

// ========== 以下路由仅管理员可访问 ==========
router.use(requireRole('admin'));

// ========== 销售管理 ==========

// 获取所有销售
router.get('/sales', async (req, res) => {
    try {
        const { is_active } = req.query;
        const sales = await SalesModel.findAll({ 
            is_active: is_active !== undefined ? is_active === 'true' : null 
        });
        res.json({ success: true, data: sales });
    } catch (error) {
        console.error('获取销售列表错误:', error);
        res.status(500).json({ success: false, message: '服务器错误' });
    }
});

// 创建销售
router.post('/sales', [
    body('user_id').isInt().withMessage('请选择用户'),
    body('name').trim().notEmpty().withMessage('请输入销售姓名'),
    body('phone').optional().trim(),
    body('email').optional().trim().isEmail().withMessage('邮箱格式不正确'),
    body('wechat').optional().trim(),
    body('daily_limit').optional().isInt({ min: 1 }).withMessage('每日上限必须是正整数')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ success: false, errors: errors.array() });
        }

        const salesId = await SalesModel.create(req.body);
        res.status(201).json({ success: true, message: '销售创建成功', data: { id: salesId } });
    } catch (error) {
        console.error('创建销售错误:', error);
        res.status(500).json({ success: false, message: '服务器错误' });
    }
});

// 更新销售
router.put('/sales/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const success = await SalesModel.update(id, req.body);
        
        if (!success) {
            return res.status(404).json({ success: false, message: '销售不存在' });
        }
        
        res.json({ success: true, message: '更新成功' });
    } catch (error) {
        console.error('更新销售错误:', error);
        res.status(500).json({ success: false, message: '服务器错误' });
    }
});

// 删除销售（软删除）
router.delete('/sales/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const success = await SalesModel.delete(id);
        
        if (!success) {
            return res.status(404).json({ success: false, message: '销售不存在' });
        }
        
        res.json({ success: true, message: '删除成功' });
    } catch (error) {
        console.error('删除销售错误:', error);
        res.status(500).json({ success: false, message: '服务器错误' });
    }
});

// 获取销售统计
router.get('/sales/:id/stats', async (req, res) => {
    try {
        const { id } = req.params;
        const stats = await SalesModel.getStats(id);
        res.json({ success: true, data: stats });
    } catch (error) {
        console.error('获取销售统计错误:', error);
        res.status(500).json({ success: false, message: '服务器错误' });
    }
});

// ========== 客户分配管理 ==========

// 获取未分配的客户
router.get('/bookings/unassigned', async (req, res) => {
    try {
        const { page = 1, limit = 20 } = req.query;
        const result = await AssignmentModel.getUnassigned({ page, limit });
        res.json({ success: true, ...result });
    } catch (error) {
        console.error('获取未分配客户错误:', error);
        res.status(500).json({ success: false, message: '服务器错误' });
    }
});

// 分配客户给销售
router.post('/bookings/assign', [
    body('booking_id').isInt().withMessage('请选择客户'),
    body('sales_id').isInt().withMessage('请选择销售')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ success: false, errors: errors.array() });
        }

        const { booking_id, sales_id, notes } = req.body;

        // 检查销售今日分配是否已达上限
        const todayCount = await SalesModel.getTodayAssignedCount(sales_id);
        const sales = await SalesModel.findById(sales_id);
        
        if (todayCount >= sales.daily_limit) {
            return res.status(400).json({ 
                success: false, 
                message: `该销售今日已分配 ${todayCount} 个客户，已达上限 ${sales.daily_limit}` 
            });
        }

        await AssignmentModel.assign({
            booking_id,
            sales_id,
            assigned_by: req.user.id,
            notes
        });

        res.json({ success: true, message: '分配成功' });
    } catch (error) {
        console.error('分配客户错误:', error);
        res.status(500).json({ success: false, message: '服务器错误' });
    }
});

// 批量分配客户
router.post('/bookings/assign-batch', [
    body('booking_ids').isArray({ min: 1 }).withMessage('请至少选择一个客户'),
    body('sales_id').isInt().withMessage('请选择销售')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ success: false, errors: errors.array() });
        }

        const { booking_ids, sales_id } = req.body;

        // 检查销售今日分配是否已达上限
        const todayCount = await SalesModel.getTodayAssignedCount(sales_id);
        const sales = await SalesModel.findById(sales_id);
        const remainingLimit = sales.daily_limit - todayCount;

        if (remainingLimit <= 0) {
            return res.status(400).json({ 
                success: false, 
                message: `该销售今日已分配 ${todayCount} 个客户，已达上限` 
            });
        }

        // 只分配不超过剩余上限的数量
        const toAssign = booking_ids.slice(0, remainingLimit);
        
        for (const booking_id of toAssign) {
            await AssignmentModel.assign({
                booking_id,
                sales_id,
                assigned_by: req.user.id
            });
        }

        const skipped = booking_ids.length - toAssign.length;
        res.json({ 
            success: true, 
            message: `成功分配 ${toAssign.length} 个客户${skipped > 0 ? `，${skipped} 个因超出上限未分配` : ''}` 
        });
    } catch (error) {
        console.error('批量分配客户错误:', error);
        res.status(500).json({ success: false, message: '服务器错误' });
    }
});

// 重新分配客户
router.post('/bookings/reassign', [
    body('booking_id').isInt().withMessage('请选择客户'),
    body('to_sales_id').isInt().withMessage('请选择目标销售'),
    body('reason').optional().trim()
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ success: false, errors: errors.array() });
        }

        const { booking_id, to_sales_id, reason } = req.body;

        // 获取当前分配信息
        const booking = await BookingModel.findById(booking_id);
        if (!booking || !booking.assigned_to) {
            return res.status(400).json({ success: false, message: '该客户未分配' });
        }

        await AssignmentModel.reassign({
            booking_id,
            from_sales_id: booking.assigned_to,
            to_sales_id,
            assigned_by: req.user.id,
            reason
        });

        res.json({ success: true, message: '重新分配成功' });
    } catch (error) {
        console.error('重新分配客户错误:', error);
        res.status(500).json({ success: false, message: '服务器错误' });
    }
});

module.exports = router;
