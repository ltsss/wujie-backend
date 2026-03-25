const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const { authenticateToken, requireRole } = require('../middleware/auth');
const UserModel = require('../models/User');
const LogModel = require('../models/Log');

// 所有接口需要 admin 权限
router.use(authenticateToken, requireRole('admin'));

// 获取用户列表
router.get('/', async (req, res) => {
    try {
        const users = await UserModel.findAll();
        res.json({
            success: true,
            data: users
        });
    } catch (error) {
        console.error('获取用户列表错误:', error);
        res.status(500).json({ 
            success: false, 
            message: '服务器错误' 
        });
    }
});

// 创建用户
router.post('/', [
    body('username').trim().notEmpty().withMessage('用户名不能为空'),
    body('username').isLength({ min: 3, max: 50 }).withMessage('用户名长度应在3-50个字符之间'),
    body('password').notEmpty().withMessage('密码不能为空'),
    body('password').isLength({ min: 6 }).withMessage('密码长度至少6位'),
    body('role').isIn(['admin', 'staff']).withMessage('无效的角色'),
    body('name').optional().trim(),
    body('phone').optional().trim(),
    body('email').optional().trim().isEmail().withMessage('邮箱格式不正确')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ 
                success: false, 
                errors: errors.array() 
            });
        }

        const { username, password, role, name, phone, email } = req.body;

        // 检查用户名是否已存在
        const existingUser = await UserModel.findByUsername(username);
        if (existingUser) {
            return res.status(409).json({ 
                success: false, 
                message: '用户名已存在' 
            });
        }

        const userId = await UserModel.create({
            username,
            password,
            role,
            name,
            phone,
            email
        });

        // 记录日志
        await LogModel.create({
            user_id: req.user.id,
            action: '创建用户',
            details: `创建用户 ${username}, 角色: ${role}`,
            ip_address: req.ip
        });

        res.status(201).json({
            success: true,
            message: '用户创建成功',
            data: { id: userId }
        });
    } catch (error) {
        console.error('创建用户错误:', error);
        res.status(500).json({ 
            success: false, 
            message: '服务器错误' 
        });
    }
});

// 更新用户
router.put('/:id', [
    body('role').optional().isIn(['admin', 'staff']).withMessage('无效的角色'),
    body('name').optional().trim(),
    body('phone').optional().trim(),
    body('email').optional().trim().isEmail().withMessage('邮箱格式不正确'),
    body('is_active').optional().isBoolean().withMessage('is_active 必须是布尔值')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ 
                success: false, 
                errors: errors.array() 
            });
        }

        const { password, role, name, phone, email, is_active } = req.body;
        const updates = { password, role, name, phone, email, is_active };

        // 不能修改自己的角色
        if (parseInt(req.params.id) === req.user.id && role && role !== req.user.role) {
            return res.status(403).json({ 
                success: false, 
                message: '不能修改自己的角色' 
            });
        }

        const success = await UserModel.update(req.params.id, updates);
        if (!success) {
            return res.status(404).json({ 
                success: false, 
                message: '用户不存在' 
            });
        }

        // 记录日志
        await LogModel.create({
            user_id: req.user.id,
            action: '更新用户',
            details: `更新用户 #${req.params.id}`,
            ip_address: req.ip
        });

        res.json({
            success: true,
            message: '更新成功'
        });
    } catch (error) {
        console.error('更新用户错误:', error);
        res.status(500).json({ 
            success: false, 
            message: '服务器错误' 
        });
    }
});

// 删除用户
router.delete('/:id', async (req, res) => {
    try {
        // 不能删除自己
        if (parseInt(req.params.id) === req.user.id) {
            return res.status(403).json({ 
                success: false, 
                message: '不能删除自己的账号' 
            });
        }

        const success = await UserModel.delete(req.params.id);
        if (!success) {
            return res.status(404).json({ 
                success: false, 
                message: '用户不存在' 
            });
        }

        // 记录日志
        await LogModel.create({
            user_id: req.user.id,
            action: '删除用户',
            details: `删除用户 #${req.params.id}`,
            ip_address: req.ip
        });

        res.json({
            success: true,
            message: '删除成功'
        });
    } catch (error) {
        console.error('删除用户错误:', error);
        res.status(500).json({ 
            success: false, 
            message: '服务器错误' 
        });
    }
});

module.exports = router;
