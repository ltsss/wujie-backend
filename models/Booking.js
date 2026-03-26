const { pool } = require('../config/database');

class BookingModel {
    // 创建预约
    static async create({ 
        customer_name, customer_phone, product_series, product_model, marble_type, estimated_price,
        visitor_id, ip_address, device_type, device_model, os, browser, page_url
    }) {
        const [result] = await pool.execute(
            `INSERT INTO bookings (
                customer_name, customer_phone, product_series, product_model, marble_type, estimated_price,
                visitor_id, ip_address, device_type, device_model, os, browser, page_url
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                customer_name, customer_phone, product_series, product_model, marble_type, estimated_price,
                visitor_id || null, ip_address || null, device_type || null, device_model || null, 
                os || null, browser || null, page_url || null
            ]
        );
        return result.insertId;
    }

    // 获取所有预约
    static async findAll({ status, page = 1, limit = 20, assignedTo = null }) {
        let whereClause = '';
        const params = [];

        if (status) {
            whereClause = 'WHERE b.status = ?';
            params.push(status);
        }

        // 销售只能看到自己负责的客户
        if (assignedTo) {
            whereClause = whereClause ? whereClause + ' AND b.assigned_to = ?' : 'WHERE b.assigned_to = ?';
            params.push(assignedTo);
        }

        const pageNum = parseInt(page) || 1;
        const limitNum = parseInt(limit) || 20;
        const offset = (pageNum - 1) * limitNum;

        const [rows] = await pool.execute(
            `SELECT b.*, u.name as handler_name
             FROM bookings b
             LEFT JOIN users u ON b.handled_by = u.id
             ${whereClause}
             ORDER BY b.created_at DESC
             LIMIT ${limitNum} OFFSET ${offset}`,
            params
        );

        // 获取总数
        const [countResult] = await pool.execute(
            `SELECT COUNT(*) as total FROM bookings b ${whereClause}`,
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

    // 根据 ID 查找预约
    static async findById(id) {
        const [rows] = await pool.execute(
            `SELECT b.*, u.name as handler_name 
             FROM bookings b 
             LEFT JOIN users u ON b.handled_by = u.id 
             WHERE b.id = ?`,
            [id]
        );
        return rows[0] || null;
    }

    // 根据 visitor_id 获取该访客的所有预约
    static async findByVisitorId(visitor_id) {
        const [rows] = await pool.execute(
            `SELECT * FROM bookings WHERE visitor_id = ? ORDER BY created_at DESC`,
            [visitor_id]
        );
        return rows;
    }

    // 更新预约
    static async update(id, updates) {
        const fields = [];
        const values = [];

        for (const [key, value] of Object.entries(updates)) {
            if (value !== undefined) {
                fields.push(`${key} = ?`);
                values.push(value);
            }
        }

        if (fields.length === 0) return false;

        values.push(id);
        const [result] = await pool.execute(
            `UPDATE bookings SET ${fields.join(', ')} WHERE id = ?`,
            values
        );
        return result.affectedRows > 0;
    }

    // 删除预约
    static async delete(id) {
        const [result] = await pool.execute(
            'DELETE FROM bookings WHERE id = ?',
            [id]
        );
        return result.affectedRows > 0;
    }

    // 统计
    static async getStats() {
        const [rows] = await pool.execute(
            `SELECT 
                COUNT(*) as total,
                SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
                SUM(CASE WHEN status = 'contacted' THEN 1 ELSE 0 END) as contacted,
                SUM(CASE WHEN status = 'quoted' THEN 1 ELSE 0 END) as quoted,
                SUM(CASE WHEN status = 'closed' THEN 1 ELSE 0 END) as closed
             FROM bookings`
        );
        return rows[0];
    }
}

module.exports = BookingModel;
