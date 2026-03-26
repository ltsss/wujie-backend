const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const { generateToken, authenticateToken, requireRole } = require('../middleware/auth');
const UserModel = require('../models/User');
const SalesModel = require('../models/Sales');
const { LogModel } = require('../models/Log');

// 登录
router.post('/login', [
    body('username').trim().notEmpty().withMessage('用户名不能为空'),
    body('password').notEmpty().withMessage('密码不能为空')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ 
                success: false, 
                errors: errors.array() 
            });
        }

        const { username, password } = req.body;
        
        const user = await UserModel.findByUsername(username);
        if (!user) {
            return res.status(401).json({ 
                success: false, 
                message: '用户名或密码错误' 
            });
        }

        if (!user.is_active) {
            return res.status(401).json({ 
                success: false, 
                message: '账号已被禁用' 
            });
        }

        const isValidPassword = await UserModel.verifyPassword(password, user.password);
        if (!isValidPassword) {
            return res.status(401).json({ 
                success: false, 
                message: '用户名或密码错误' 
            });
        }

        // 记录登录日志
        await LogModel.create({
            user_id: user.id,
            action: '用户登录',
            details: `用户 ${user.username} 登录系统`,
            ip_address: req.ip
        });

        const token = generateToken({
            id: user.id,
            username: user.username,
            role: user.role
        });

        res.json({
            success: true,
            message: '登录成功',
            data: {
                token,
                user: {
                    id: user.id,
                    username: user.username,
                    role: user.role,
                    name: user.name,
                    phone: user.phone,
                    email: user.email
                }
            }
        });
    } catch (error) {
        console.error('登录错误:', error);
        res.status(500).json({ 
            success: false, 
            message: '服务器错误' 
        });
    }
});

// 获取当前用户信息
router.get('/me', authenticateToken, async (req, res) => {
    try {
        const user = await UserModel.findById(req.user.id);
        if (!user) {
            return res.status(404).json({ 
                success: false, 
                message: '用户不存在' 
            });
        }

        res.json({
            success: true,
            data: user
        });
    } catch (error) {
        console.error('获取用户信息错误:', error);
        res.status(500).json({ 
            success: false, 
            message: '服务器错误' 
        });
    }
});

// 登出
router.post('/logout', authenticateToken, async (req, res) => {
    try {
        await LogModel.create({
            user_id: req.user.id,
            action: '用户登出',
            details: `用户 ${req.user.username} 登出系统`,
            ip_address: req.ip
        });

        res.json({
            success: true,
            message: '登出成功'
        });
    } catch (error) {
        console.error('登出错误:', error);
        res.status(500).json({
            success: false,
            message: '服务器错误'
        });
    }
});

// 注册新账号（仅管理员）
router.post('/register', [
    authenticateToken,
    requireRole('admin'),
    body('username').trim().notEmpty().withMessage('用户名不能为空').isLength({ min: 3, max: 20 }).withMessage('用户名长度3-20位'),
    body('password').notEmpty().withMessage('密码不能为空').isLength({ min: 6 }).withMessage('密码至少6位'),
    body('name').trim().notEmpty().withMessage('姓名不能为空'),
    body('role').isIn(['admin', 'sales']).withMessage('角色必须是 admin 或 sales'),
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

        const { username, password, name, role, phone, email } = req.body;

        // 检查用户名是否已存在
        const existingUser = await UserModel.findByUsername(username);
        if (existingUser) {
            return res.status(400).json({
                success: false,
                message: '用户名已存在'
            });
        }

        // 创建用户
        const userId = await UserModel.create({
            username,
            password,
            name,
            role,
            phone,
            email
        });

        // 如果是销售角色，同时在 sales 表创建记录
        if (role === 'sales') {
            try {
                await SalesModel.create({
                    user_id: userId,
                    name: name,
                    phone: phone,
                    email: email,
                    daily_limit: 10
                });
            } catch (salesError) {
                console.error('创建销售记录失败:', salesError);
                // 不影响用户创建成功
            }
        }

        // 记录日志
        await LogModel.create({
            user_id: req.user.id,
            action: '创建账号',
            details: `管理员 ${req.user.username} 创建了 ${role} 账号 ${username}`,
            ip_address: req.ip
        });

        res.status(201).json({
            success: true,
            message: '账号创建成功',
            data: { id: userId }
        });
    } catch (error) {
        console.error('注册错误:', error);
        res.status(500).json({
            success: false,
            message: '服务器错误'
        });
    }
});

// 获取所有用户列表（仅管理员）
router.get('/users', authenticateToken, requireRole('admin'), async (req, res) => {
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

// 更新用户信息（仅管理员）
router.put('/users/:id', [
    authenticateToken,
    requireRole('admin')
], async (req, res) => {
    try {
        const { id } = req.params;
        const updates = {};

        if (req.body.name) updates.name = req.body.name;
        if (req.body.role) updates.role = req.body.role;
        if (req.body.is_active !== undefined) updates.is_active = req.body.is_active;
        if (req.body.phone) updates.phone = req.body.phone;
        if (req.body.email) updates.email = req.body.email;
        if (req.body.password) updates.password = req.body.password;

        const success = await UserModel.update(id, updates);
        if (!success) {
            return res.status(404).json({
                success: false,
                message: '用户不存在'
            });
        }

        await LogModel.create({
            user_id: req.user.id,
            action: '更新账号',
            details: `管理员 ${req.user.username} 更新了用户ID ${id} 的信息`,
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

module.exports = router;
