const { pool } = require('../config/database');

class AssignmentModel {
    // 分配客户给销售
    static async assign({ booking_id, sales_id, assigned_by, notes = '' }) {
        const connection = await pool.getConnection();
        try {
            await connection.beginTransaction();

            // 1. 创建分配记录
            const [result] = await connection.execute(
                `INSERT INTO booking_assignments (booking_id, sales_id, assigned_by, notes, status) 
                 VALUES (?, ?, ?, ?, 'active')
                 ON DUPLICATE KEY UPDATE 
                 sales_id = VALUES(sales_id), 
                 assigned_by = VALUES(assigned_by), 
                 notes = VALUES(notes), 
                 status = 'active',
                 assigned_at = CURRENT_TIMESTAMP`,
                [booking_id, sales_id, assigned_by, notes]
            );

            // 2. 更新 bookings 表
            await connection.execute(
                `UPDATE bookings 
                 SET assigned_to = ?, assigned_at = CURRENT_TIMESTAMP 
                 WHERE id = ?`,
                [sales_id, booking_id]
            );

            await connection.commit();
            return result.insertId || result.affectedRows;
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
    }

    // 重新分配客户
    static async reassign({ booking_id, from_sales_id, to_sales_id, assigned_by, reason = '' }) {
        const connection = await pool.getConnection();
        try {
            await connection.beginTransaction();

            // 1. 将原分配记录标记为 transferred
            await connection.execute(
                `UPDATE booking_assignments 
                 SET status = 'transferred' 
                 WHERE booking_id = ? AND sales_id = ? AND status = 'active'`,
                [booking_id, from_sales_id]
            );

            // 2. 创建新的分配记录
            const [result] = await connection.execute(
                `INSERT INTO booking_assignments (booking_id, sales_id, assigned_by, notes, status) 
                 VALUES (?, ?, ?, ?, 'active')`,
                [booking_id, to_sales_id, assigned_by, reason]
            );

            // 3. 更新 bookings 表
            await connection.execute(
                `UPDATE bookings 
                 SET assigned_to = ?, assigned_at = CURRENT_TIMESTAMP 
                 WHERE id = ?`,
                [to_sales_id, booking_id]
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

    // 获取未分配的客户
    static async getUnassigned({ page = 1, limit = 20 }) {
        const offset = (page - 1) * limit;
        
        const [rows] = await pool.execute(
            `SELECT b.*
             FROM bookings b
             LEFT JOIN booking_assignments ba ON b.id = ba.booking_id AND ba.status = 'active'
             WHERE ba.id IS NULL OR b.assigned_to IS NULL
             ORDER BY b.created_at DESC
             LIMIT ${limit} OFFSET ${offset}`
        );

        const [countResult] = await pool.execute(
            `SELECT COUNT(*) as total 
             FROM bookings b
             LEFT JOIN booking_assignments ba ON b.id = ba.booking_id AND ba.status = 'active'
             WHERE ba.id IS NULL OR b.assigned_to IS NULL`
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

    // 获取销售分配的客户
    static async getBySalesId({ sales_id, status, page = 1, limit = 20 }) {
        let whereClause = 'WHERE b.assigned_to = ?';
        const params = [sales_id];

        if (status) {
            whereClause += ' AND b.status = ?';
            params.push(status);
        }

        const offset = (page - 1) * limit;

        const [rows] = await pool.execute(
            `SELECT b.*, 
                    (SELECT COUNT(*) FROM follow_ups fu WHERE fu.booking_id = b.id) as follow_up_count,
                    (SELECT MAX(fu.created_at) FROM follow_ups fu WHERE fu.booking_id = b.id) as last_follow_up_at,
                    (SELECT fu.next_follow_up FROM follow_ups fu WHERE fu.booking_id = b.id ORDER BY fu.created_at DESC LIMIT 1) as next_follow_up
             FROM bookings b
             ${whereClause}
             ORDER BY b.created_at DESC
             LIMIT ${limit} OFFSET ${offset}`,
            params
        );

        const [countResult] = await pool.execute(
            `SELECT COUNT(*) as total FROM bookings b ${whereClause}`,
            params
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

    // 获取今日待跟进的客户
    static async getTodayFollowUps(sales_id) {
        const [rows] = await pool.execute(
            `SELECT b.*, fu.next_follow_up, fu.next_follow_up_note
             FROM bookings b
             JOIN follow_ups fu ON b.id = fu.booking_id
             WHERE b.assigned_to = ? 
               AND fu.next_follow_up = CURDATE()
               AND fu.id = (SELECT MAX(id) FROM follow_ups WHERE booking_id = b.id)
             ORDER BY fu.next_follow_up ASC`,
            [sales_id]
        );
        return rows;
    }
}

module.exports = AssignmentModel;
