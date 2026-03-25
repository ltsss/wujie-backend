const { pool } = require('../config/database');

class LogModel {
    // 创建日志
    static async create({ user_id, action, details, ip_address }) {
        await pool.execute(
            'INSERT INTO logs (user_id, action, details, ip_address) VALUES (?, ?, ?, ?)',
            [user_id, action, details, ip_address]
        );
    }

    // 获取日志列表
    static async findAll({ page = 1, limit = 50 }) {
        const offset = (page - 1) * limit;
        
        const [rows] = await pool.execute(
            `SELECT l.*, u.username, u.name 
             FROM logs l 
             LEFT JOIN users u ON l.user_id = u.id 
             ORDER BY l.created_at DESC 
             LIMIT ? OFFSET ?`,
            [parseInt(limit), parseInt(offset)]
        );

        const [countResult] = await pool.execute(
            'SELECT COUNT(*) as total FROM logs'
        );

        return {
            data: rows,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total: countResult[0].total,
                totalPages: Math.ceil(countResult[0].total / limit)
            }
        };
    }
}

module.exports = LogModel;
