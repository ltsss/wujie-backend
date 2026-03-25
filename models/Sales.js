const { pool } = require('../config/database');

class SalesModel {
    // 创建销售
    static async create({ user_id, name, phone, email, wechat, daily_limit = 10 }) {
        const [result] = await pool.execute(
            `INSERT INTO sales (user_id, name, phone, email, wechat, daily_limit) 
             VALUES (?, ?, ?, ?, ?, ?)`,
            [user_id, name, phone, email, wechat, daily_limit]
        );
        return result.insertId;
    }

    // 获取所有销售
    static async findAll({ is_active = true } = {}) {
        let whereClause = '';
        const params = [];

        if (is_active !== null) {
            whereClause = 'WHERE s.is_active = ?';
            params.push(is_active);
        }

        const [rows] = await pool.execute(
            `SELECT s.*, u.username, u.role
             FROM sales s
             JOIN users u ON s.user_id = u.id
             ${whereClause}
             ORDER BY s.created_at DESC`,
            params
        );
        return rows;
    }

    // 根据 ID 查找销售
    static async findById(id) {
        const [rows] = await pool.execute(
            `SELECT s.*, u.username, u.role
             FROM sales s
             JOIN users u ON s.user_id = u.id
             WHERE s.id = ?`,
            [id]
        );
        return rows[0] || null;
    }

    // 根据用户 ID 查找销售
    static async findByUserId(user_id) {
        const [rows] = await pool.execute(
            `SELECT s.*, u.username, u.role
             FROM sales s
             JOIN users u ON s.user_id = u.id
             WHERE s.user_id = ? AND s.is_active = TRUE`,
            [user_id]
        );
        return rows[0] || null;
    }

    // 更新销售信息
    static async update(id, updates) {
        const fields = [];
        const values = [];

        for (const [key, value] of Object.entries(updates)) {
            if (value !== undefined && key !== 'id') {
                fields.push(`${key} = ?`);
                values.push(value);
            }
        }

        if (fields.length === 0) return false;

        values.push(id);
        const [result] = await pool.execute(
            `UPDATE sales SET ${fields.join(', ')} WHERE id = ?`,
            values
        );
        return result.affectedRows > 0;
    }

    // 删除销售（软删除）
    static async delete(id) {
        const [result] = await pool.execute(
            'UPDATE sales SET is_active = FALSE WHERE id = ?',
            [id]
        );
        return result.affectedRows > 0;
    }

    // 获取销售今日已分配客户数
    static async getTodayAssignedCount(sales_id) {
        const [rows] = await pool.execute(
            `SELECT COUNT(*) as count 
             FROM booking_assignments 
             WHERE sales_id = ? AND DATE(assigned_at) = CURDATE()`,
            [sales_id]
        );
        return rows[0].count;
    }

    // 获取销售统计
    static async getStats(sales_id) {
        const [rows] = await pool.execute(
            `SELECT 
                COUNT(DISTINCT b.id) as total_customers,
                SUM(CASE WHEN b.status = 'pending' THEN 1 ELSE 0 END) as pending,
                SUM(CASE WHEN b.status = 'contacted' THEN 1 ELSE 0 END) as contacted,
                SUM(CASE WHEN b.status = 'quoted' THEN 1 ELSE 0 END) as quoted,
                SUM(CASE WHEN b.status = 'closed' THEN 1 ELSE 0 END) as closed,
                COUNT(DISTINCT fu.id) as total_follow_ups,
                COUNT(DISTINCT CASE WHEN fu.next_follow_up = CURDATE() THEN fu.id END) as today_follow_ups
             FROM sales s
             LEFT JOIN bookings b ON s.id = b.assigned_to
             LEFT JOIN follow_ups fu ON b.id = fu.booking_id
             WHERE s.id = ?`,
            [sales_id]
        );
        return rows[0];
    }
}

module.exports = SalesModel;
