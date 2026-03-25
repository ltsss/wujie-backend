const { pool } = require('../config/database');
const crypto = require('crypto');

class TrackingModel {
    // 生成会话ID
    static generateSessionId() {
        return crypto.randomBytes(32).toString('hex');
    }

    // 解析User-Agent
    static parseUserAgent(userAgent) {
        const deviceType = /Mobile|Android|iPhone|iPad/i.test(userAgent) 
            ? (/iPad|Tablet/i.test(userAgent) ? 'tablet' : 'mobile') 
            : 'desktop';
        
        let browser = 'Unknown';
        if (/Chrome/i.test(userAgent)) browser = 'Chrome';
        else if (/Safari/i.test(userAgent)) browser = 'Safari';
        else if (/Firefox/i.test(userAgent)) browser = 'Firefox';
        else if (/Edge/i.test(userAgent)) browser = 'Edge';
        
        let os = 'Unknown';
        if (/Windows/i.test(userAgent)) os = 'Windows';
        else if (/Mac/i.test(userAgent)) os = 'MacOS';
        else if (/Android/i.test(userAgent)) os = 'Android';
        else if (/iOS|iPhone|iPad/i.test(userAgent)) os = 'iOS';
        else if (/Linux/i.test(userAgent)) os = 'Linux';
        
        return { deviceType, browser, os };
    }

    // 记录页面进入
    static async trackEntry({
        session_id,
        page_url,
        page_path,
        referrer,
        user_agent,
        screen_resolution,
        ip_address
    }) {
        const { deviceType, browser, os } = this.parseUserAgent(user_agent);
        
        // 插入追踪记录
        const [result] = await pool.execute(
            `INSERT INTO user_tracking 
             (session_id, page_url, page_path, referrer, user_agent, device_type, 
              browser, os, screen_resolution, ip_address) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [session_id, page_url, page_path, referrer, user_agent, deviceType, 
             browser, os, screen_resolution, ip_address]
        );

        // 更新活跃会话
        await pool.execute(
            `INSERT INTO active_sessions (session_id, page_path, device_type, ip_address) 
             VALUES (?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE 
             page_path = VALUES(page_path), 
             last_activity = CURRENT_TIMESTAMP`,
            [session_id, page_path, deviceType, ip_address]
        );

        return result.insertId;
    }

    // 更新页面离开数据
    static async trackExit({ session_id, page_path, stay_duration, click_count, scroll_depth, click_details }) {
        await pool.execute(
            `UPDATE user_tracking 
             SET exit_time = CURRENT_TIMESTAMP,
                 stay_duration = ?,
                 click_count = ?,
                 scroll_depth = ?,
                 click_details = ?
             WHERE session_id = ? AND page_path = ?
             ORDER BY entry_time DESC LIMIT 1`,
            [stay_duration, click_count, scroll_depth, 
             click_details ? JSON.stringify(click_details) : null,
             session_id, page_path]
        );

        // 删除活跃会话
        await pool.execute(
            'DELETE FROM active_sessions WHERE session_id = ?',
            [session_id]
        );
    }

    // 记录心跳（保持会话活跃）
    static async trackHeartbeat(session_id, page_path) {
        await pool.execute(
            `UPDATE active_sessions 
             SET last_activity = CURRENT_TIMESTAMP, page_path = ?
             WHERE session_id = ?`,
            [page_path, session_id]
        );
    }

    // 记录点击事件
    static async trackClick({ session_id, page_path, element, x, y, timestamp }) {
        // 获取当前记录的点击详情
        const [rows] = await pool.execute(
            `SELECT click_details FROM user_tracking 
             WHERE session_id = ? AND page_path = ?
             ORDER BY entry_time DESC LIMIT 1`,
            [session_id, page_path]
        );

        let clicks = [];
        if (rows.length > 0 && rows[0].click_details) {
            clicks = JSON.parse(rows[0].click_details);
        }

        clicks.push({ element, x, y, timestamp });

        await pool.execute(
            `UPDATE user_tracking 
             SET click_details = ?, click_count = ?
             WHERE session_id = ? AND page_path = ?
             ORDER BY entry_time DESC LIMIT 1`,
            [JSON.stringify(clicks), clicks.length, session_id, page_path]
        );
    }

    // 获取实时在线用户
    static async getActiveUsers(minutes = 5) {
        const [rows] = await pool.execute(
            `SELECT COUNT(*) as count FROM active_sessions 
             WHERE last_activity > DATE_SUB(NOW(), INTERVAL ? MINUTE)`,
            [minutes]
        );
        return rows[0].count;
    }

    // 获取今日统计数据
    static async getTodayStats() {
        const [pvResult] = await pool.execute(
            `SELECT COUNT(*) as count FROM user_tracking 
             WHERE DATE(entry_time) = CURDATE()`
        );

        const [uvResult] = await pool.execute(
            `SELECT COUNT(DISTINCT session_id) as count FROM user_tracking 
             WHERE DATE(entry_time) = CURDATE()`
        );

        const [avgTimeResult] = await pool.execute(
            `SELECT AVG(stay_duration) as avg_time FROM user_tracking 
             WHERE DATE(entry_time) = CURDATE() AND stay_duration > 0`
        );

        const [clickResult] = await pool.execute(
            `SELECT SUM(click_count) as total FROM user_tracking 
             WHERE DATE(entry_time) = CURDATE()`
        );

        return {
            pv: pvResult[0].count,
            uv: uvResult[0].count,
            avgStayTime: Math.round(avgTimeResult[0].avg_time || 0),
            totalClicks: clickResult[0].total || 0
        };
    }

    // 获取页面统计
    static async getPageStats({ startDate, endDate, page_path }) {
        let whereClause = 'WHERE entry_time >= ? AND entry_time <= ?';
        const params = [startDate, endDate];

        if (page_path) {
            whereClause += ' AND page_path = ?';
            params.push(page_path);
        }

        const [rows] = await pool.execute(
            `SELECT 
                page_path,
                COUNT(*) as pv,
                COUNT(DISTINCT session_id) as uv,
                AVG(stay_duration) as avg_stay,
                SUM(click_count) as total_clicks,
                SUM(CASE WHEN stay_duration < 5 THEN 1 ELSE 0 END) as bounce_count
             FROM user_tracking
             ${whereClause}
             GROUP BY page_path
             ORDER BY pv DESC`,
            params
        );

        return rows.map(r => ({
            ...r,
            avg_stay: Math.round(r.avg_stay || 0),
            bounce_rate: r.pv > 0 ? ((r.bounce_count / r.pv) * 100).toFixed(2) : 0
        }));
    }

    // 获取点击热力图数据
    static async getClickHeatmap(page_path, date = null) {
        const targetDate = date || new Date().toISOString().split('T')[0];
        
        const [rows] = await pool.execute(
            `SELECT click_details FROM user_tracking 
             WHERE page_path = ? AND DATE(entry_time) = ? AND click_details IS NOT NULL`,
            [page_path, targetDate]
        );

        const clicks = [];
        rows.forEach(row => {
            const details = JSON.parse(row.click_details);
            clicks.push(...details);
        });

        return clicks;
    }

    // 清理过期会话（超过30分钟无活动）
    static async cleanupExpiredSessions() {
        await pool.execute(
            `DELETE FROM active_sessions 
             WHERE last_activity < DATE_SUB(NOW(), INTERVAL 30 MINUTE)`
        );
    }
}

module.exports = TrackingModel;
