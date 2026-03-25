const { pool } = require('../config/database');

class FollowUpModel {
    // 创建跟进记录
    static async create({ booking_id, sales_id, contact_type, contact_result, content, next_follow_up, next_follow_up_note }) {
        const connection = await pool.getConnection();
        try {
            await connection.beginTransaction();

            // 1. 创建跟进记录
            const [result] = await connection.execute(
                `INSERT INTO follow_ups (booking_id, sales_id, contact_type, contact_result, content, next_follow_up, next_follow_up_note) 
                 VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [booking_id, sales_id, contact_type, contact_result, content, next_follow_up, next_follow_up_note]
            );

            // 2. 更新 bookings 表的 last_contact_at 和 contact_count
            await connection.execute(
                `UPDATE bookings 
                 SET last_contact_at = CURRENT_TIMESTAMP,
                     contact_count = contact_count + 1
                 WHERE id = ?`,
                [booking_id]
            );

            await connection.commit();
            return result.insertId;
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
    }

    // 获取客户的跟进记录
    static async getByBookingId(booking_id) {
        const [rows] = await pool.execute(
            `SELECT fu.*, s.name as sales_name
             FROM follow_ups fu
             JOIN sales s ON fu.sales_id = s.id
             WHERE fu.booking_id = ?
             ORDER BY fu.created_at DESC`,
            [booking_id]
        );
        return rows;
    }

    // 获取销售的跟进记录
    static async getBySalesId({ sales_id, page = 1, limit = 20 }) {
        const offset = (page - 1) * limit;

        const [rows] = await pool.execute(
            `SELECT fu.*, b.customer_name, b.customer_phone, b.product_series, b.product_model
             FROM follow_ups fu
             JOIN bookings b ON fu.booking_id = b.id
             WHERE fu.sales_id = ?
             ORDER BY fu.created_at DESC
             LIMIT ${limit} OFFSET ${offset}`,
            [sales_id]
        );

        const [countResult] = await pool.execute(
            `SELECT COUNT(*) as total 
             FROM follow_ups 
             WHERE sales_id = ?`,
            [sales_id]
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

    // 获取今日待跟进列表
    static async getTodayFollowUps(sales_id) {
        const [rows] = await pool.execute(
            `SELECT DISTINCT b.*, fu.next_follow_up, fu.next_follow_up_note,
                    s.name as sales_name
             FROM bookings b
             JOIN follow_ups fu ON b.id = fu.booking_id
             JOIN sales s ON fu.sales_id = s.id
             WHERE fu.sales_id = ? 
               AND fu.next_follow_up = CURDATE()
               AND fu.id = (SELECT MAX(id) FROM follow_ups WHERE booking_id = b.id)
             ORDER BY fu.next_follow_up ASC`,
            [sales_id]
        );
        return rows;
    }

    // 获取最近跟进记录（用于客户列表显示）
    static async getLatestByBookingId(booking_id) {
        const [rows] = await pool.execute(
            `SELECT fu.*, s.name as sales_name
             FROM follow_ups fu
             JOIN sales s ON fu.sales_id = s.id
             WHERE fu.booking_id = ?
             ORDER BY fu.created_at DESC
             LIMIT 1`,
            [booking_id]
        );
        return rows[0] || null;
    }
}

module.exports = FollowUpModel;
