const { pool } = require('../config/database');

class LogModel {
    // 创建日志
    static async create({
        visitor_id, session_id, action, details, ip_address,
        device_type, device_model, os, browser, page_url, referrer, duration,
        country, region, city
    }) {
        // 确保所有参数都有值，undefined 转为 null
        const params = [
            visitor_id || null,
            session_id || null,
            action || '',
            details ? JSON.stringify(details) : null,
            ip_address || null,
            device_type || null,
            device_model || null,
            os || null,
            browser || null,
            page_url || null,
            referrer || null,
            duration || null,
            country || null,
            region || null,
            city || null
        ];

        await pool.execute(
            `INSERT INTO logs
            (visitor_id, session_id, action, details, ip_address,
             device_type, device_model, os, browser, page_url, referrer, duration,
             country, region, city)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            params
        );
    }

    // 获取日志列表（带详细筛选）
    static async findAll({ page = 1, limit = 50, action, visitor_id, date_from, date_to }) {
        const pageNum = parseInt(page) || 1;
        const limitNum = parseInt(limit) || 50;
        const offset = (pageNum - 1) * limitNum;
        
        let whereClause = 'WHERE 1=1';
        const params = [];
        
        if (action) {
            whereClause += ' AND action = ?';
            params.push(action);
        }
        if (visitor_id) {
            whereClause += ' AND visitor_id = ?';
            params.push(visitor_id);
        }
        if (date_from) {
            whereClause += ' AND created_at >= ?';
            params.push(date_from);
        }
        if (date_to) {
            whereClause += ' AND created_at <= ?';
            params.push(date_to + ' 23:59:59');
        }
        
        const [rows] = await pool.execute(
            `SELECT * FROM logs ${whereClause} ORDER BY created_at DESC LIMIT ${limitNum} OFFSET ${offset}`,
            params
        );

        const [countResult] = await pool.execute(
            `SELECT COUNT(*) as total FROM logs ${whereClause}`,
            params
        );

        return {
            data: rows,
            pagination: {
                page: pageNum,
                limit: limitNum,
                total: countResult[0].total,
                totalPages: Math.ceil(countResult[0].total / limitNum)
            }
        };
    }

    // 获取访客统计
    static async getVisitorStats({ date_from, date_to }) {
        let whereClause = 'WHERE 1=1';
        const params = [];
        
        if (date_from) {
            whereClause += ' AND created_at >= ?';
            params.push(date_from);
        }
        if (date_to) {
            whereClause += ' AND created_at <= ?';
            params.push(date_to + ' 23:59:59');
        }
        
        // 独立访客数
        const [uvResult] = await pool.execute(
            `SELECT COUNT(DISTINCT visitor_id) as uv FROM logs ${whereClause}`,
            params
        );
        
        // 页面访问数
        const [pvResult] = await pool.execute(
            `SELECT COUNT(*) as pv FROM logs ${whereClause} AND action = 'pageview'`,
            params
        );
        
        // 平均停留时长
        const [durationResult] = await pool.execute(
            `SELECT AVG(duration) as avg_duration FROM logs ${whereClause} AND duration > 0`,
            params
        );
        
        // 设备分布
        const [deviceResult] = await pool.execute(
            `SELECT device_type, COUNT(*) as count FROM logs ${whereClause} GROUP BY device_type`,
            params
        );
        
        // 设备型号TOP10
        const [modelResult] = await pool.execute(
            `SELECT device_model, COUNT(*) as count FROM logs ${whereClause} AND device_model IS NOT NULL GROUP BY device_model ORDER BY count DESC LIMIT 10`,
            params
        );

        return {
            uv: uvResult[0].uv,
            pv: pvResult[0].pv,
            avg_duration: Math.round(durationResult[0].avg_duration || 0),
            device_distribution: deviceResult,
            top_devices: modelResult
        };
    }

    // 获取单个访客的详细记录
    static async getVisitorDetail(visitor_id) {
        const [logs] = await pool.execute(
            `SELECT * FROM logs WHERE visitor_id = ? ORDER BY created_at DESC`,
            [visitor_id]
        );
        
        const [visitor] = await pool.execute(
            `SELECT * FROM visitors WHERE visitor_id = ?`,
            [visitor_id]
        );
        
        return {
            visitor: visitor[0] || null,
            logs: logs
        };
    }
}

// 访客管理
class VisitorModel {
    // 创建或更新访客
    static async track({ visitor_id, device_type, device_model, os, browser, ip_address, country, region, city }) {
        try {
            await pool.execute(
                `INSERT INTO visitors (visitor_id, device_type, device_model, os, browser, ip_address, country, region, city, visit_count)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
                 ON DUPLICATE KEY UPDATE
                 last_visit = CURRENT_TIMESTAMP,
                 visit_count = visit_count + 1,
                 country = VALUES(country),
                 region = VALUES(region),
                 city = VALUES(city)`,
                [visitor_id, device_type, device_model, os, browser, ip_address, country, region, city]
            );
        } catch (err) {
            console.error('Track visitor error:', err);
        }
    }
}

// 会话管理
class SessionModel {
    // 开始会话
    static async start({ session_id, visitor_id, device_type, device_model, os, browser, ip_address }) {
        await pool.execute(
            `INSERT INTO sessions (session_id, visitor_id, device_type, device_model, os, browser, ip_address) 
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [session_id, visitor_id, device_type, device_model, os, browser, ip_address]
        );
    }
    
    // 结束会话（更新时长和页面数）
    static async end({ session_id, duration, page_views }) {
        await pool.execute(
            `UPDATE sessions SET end_time = CURRENT_TIMESTAMP, duration = ?, page_views = ? WHERE session_id = ?`,
            [duration, page_views, session_id]
        );
    }
}

module.exports = { LogModel, VisitorModel, SessionModel };
