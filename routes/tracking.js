const express = require('express');
const router = express.Router();
const { authenticateToken, requireRole } = require('../middleware/auth');
const TrackingModel = require('../models/Tracking');

// ========== 公开接口：前端埋点上报 ==========

// 页面进入
router.post('/entry', async (req, res) => {
    try {
        const {
            session_id,
            page_url,
            page_path,
            referrer,
            screen_resolution
        } = req.body;

        const ip_address = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
        const user_agent = req.headers['user-agent'];

        const trackId = await TrackingModel.trackEntry({
            session_id,
            page_url,
            page_path,
            referrer,
            user_agent,
            screen_resolution,
            ip_address
        });

        res.json({ success: true, data: { id: trackId } });
    } catch (error) {
        console.error('Track entry error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// 页面离开
router.post('/exit', async (req, res) => {
    try {
        const {
            session_id,
            page_path,
            stay_duration,
            click_count,
            scroll_depth,
            click_details
        } = req.body;

        await TrackingModel.trackExit({
            session_id,
            page_path,
            stay_duration,
            click_count,
            scroll_depth,
            click_details
        });

        res.json({ success: true });
    } catch (error) {
        console.error('Track exit error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// 心跳保持
router.post('/heartbeat', async (req, res) => {
    try {
        const { session_id, page_path } = req.body;
        await TrackingModel.trackHeartbeat(session_id, page_path);
        res.json({ success: true });
    } catch (error) {
        console.error('Heartbeat error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// 点击事件
router.post('/click', async (req, res) => {
    try {
        const { session_id, page_path, element, x, y, timestamp } = req.body;
        
        await TrackingModel.trackClick({
            session_id,
            page_path,
            element,
            x,
            y,
            timestamp
        });

        res.json({ success: true });
    } catch (error) {
        console.error('Track click error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// ========== 管理接口：数据统计 ==========

// 所有管理接口需要登录
router.use(authenticateToken);

// 获取实时在线人数
router.get('/active-users', async (req, res) => {
    try {
        const count = await TrackingModel.getActiveUsers();
        res.json({ success: true, data: { count } });
    } catch (error) {
        console.error('Get active users error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// 获取今日统计
router.get('/today-stats', async (req, res) => {
    try {
        const stats = await TrackingModel.getTodayStats();
        res.json({ success: true, data: stats });
    } catch (error) {
        console.error('Get today stats error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// 获取页面统计
router.get('/page-stats', async (req, res) => {
    try {
        const { startDate, endDate, page_path } = req.query;
        
        // 默认查询今天
        const today = new Date().toISOString().split('T')[0];
        const stats = await TrackingModel.getPageStats({
            startDate: startDate || today,
            endDate: endDate || today,
            page_path
        });

        res.json({ success: true, data: stats });
    } catch (error) {
        console.error('Get page stats error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// 获取点击热力图数据
router.get('/heatmap', async (req, res) => {
    try {
        const { page_path, date } = req.query;
        
        if (!page_path) {
            return res.status(400).json({ success: false, message: 'page_path is required' });
        }

        const clicks = await TrackingModel.getClickHeatmap(page_path, date);
        res.json({ success: true, data: clicks });
    } catch (error) {
        console.error('Get heatmap error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

module.exports = router;
