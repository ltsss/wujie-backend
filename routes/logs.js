const express = require('express');
const router = express.Router();
const { LogModel, VisitorModel, SessionModel } = require('../models/Log');
const { getIPLocation, formatLocation } = require('../utils/ipLocation');

// 公开接口：接收前端埋点数据（无需认证）
router.post('/track', async (req, res) => {
    try {
        const {
            visitor_id, session_id, action, details, page_url, referrer, duration,
            device_type, device_model, os, browser
        } = req.body;

        const ip_address = req.headers['x-forwarded-for'] || req.socket.remoteAddress;

        // 查询 IP 地区
        const location = await getIPLocation(ip_address);

        // 保存日志
        await LogModel.create({
            visitor_id, session_id, action, details, ip_address,
            device_type, device_model, os, browser, page_url, referrer, duration,
            country: location.country,
            region: location.region,
            city: location.city
        });

        // 更新访客信息
        if (visitor_id) {
            await VisitorModel.track({
                visitor_id, device_type, device_model, os, browser, ip_address,
                country: location.country,
                region: location.region,
                city: location.city
            });
        }

        res.json({ success: true });
    } catch (error) {
        console.error('Track error:', error);
        res.status(500).json({ success: false, message: '服务器错误' });
    }
});

// 会话开始
router.post('/session/start', async (req, res) => {
    try {
        const { session_id, visitor_id, device_type, device_model, os, browser } = req.body;
        const ip_address = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
        
        await SessionModel.start({
            session_id, visitor_id, device_type, device_model, os, browser, ip_address
        });
        
        res.json({ success: true });
    } catch (error) {
        console.error('Session start error:', error);
        res.status(500).json({ success: false, message: '服务器错误' });
    }
});

// 会话结束
router.post('/session/end', async (req, res) => {
    try {
        const { session_id, duration, page_views } = req.body;
        
        await SessionModel.end({ session_id, duration, page_views });
        
        res.json({ success: true });
    } catch (error) {
        console.error('Session end error:', error);
        res.status(500).json({ success: false, message: '服务器错误' });
    }
});

// 以下接口需要管理员认证
const { authenticateToken, requireRole } = require('../middleware/auth');
router.use(authenticateToken, requireRole('admin'));

// 获取日志列表
router.get('/', async (req, res) => {
    try {
        const { page, limit, action, visitor_id, date_from, date_to } = req.query;
        
        const result = await LogModel.findAll({ 
            page, limit, action, visitor_id, date_from, date_to 
        });

        res.json({
            success: true,
            data: result.data,
            pagination: result.pagination
        });
    } catch (error) {
        console.error('获取日志错误:', error);
        res.status(500).json({ success: false, message: '服务器错误' });
    }
});

// 获取访客统计
router.get('/stats', async (req, res) => {
    try {
        const { date_from, date_to } = req.query;
        const stats = await LogModel.getVisitorStats({ date_from, date_to });
        
        res.json({
            success: true,
            data: stats
        });
    } catch (error) {
        console.error('获取统计错误:', error);
        res.status(500).json({ success: false, message: '服务器错误' });
    }
});

// 获取单个访客详情
router.get('/visitor/:visitor_id', async (req, res) => {
    try {
        const { visitor_id } = req.params;
        const detail = await LogModel.getVisitorDetail(visitor_id);
        
        res.json({
            success: true,
            data: detail
        });
    } catch (error) {
        console.error('获取访客详情错误:', error);
        res.status(500).json({ success: false, message: '服务器错误' });
    }
});

module.exports = router;
