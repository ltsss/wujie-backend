const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const { generateToken, authenticateToken } = require('../middleware/auth');
const UserModel = require('../models/User');
const LogModel = require('../models/Log');

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

module.exports = router;
