const { pool } = require('../config/database');
const bcrypt = require('bcryptjs');

class UserModel {
    // 根据用户名查找用户
    static async findByUsername(username) {
        const [rows] = await pool.execute(
            'SELECT * FROM users WHERE username = ?',
            [username]
        );
        return rows[0] || null;
    }

    // 根据 ID 查找用户
    static async findById(id) {
        const [rows] = await pool.execute(
            'SELECT id, username, role, name, phone, email, is_active, created_at FROM users WHERE id = ?',
            [id]
        );
        return rows[0] || null;
    }

    // 获取所有用户
    static async findAll() {
        const [rows] = await pool.execute(
            'SELECT id, username, role, name, phone, email, is_active, created_at FROM users ORDER BY created_at DESC'
        );
        return rows;
    }

    // 创建用户
    static async create({ username, password, role = 'staff', name, phone, email }) {
        const hashedPassword = await bcrypt.hash(password, 10);
        const [result] = await pool.execute(
            'INSERT INTO users (username, password, role, name, phone, email) VALUES (?, ?, ?, ?, ?, ?)',
            [username, hashedPassword, role, name, phone, email]
        );
        return result.insertId;
    }

    // 更新用户
    static async update(id, updates) {
        const fields = [];
        const values = [];

        for (const [key, value] of Object.entries(updates)) {
            if (key === 'password' && value) {
                fields.push('password = ?');
                values.push(await bcrypt.hash(value, 10));
            } else if (value !== undefined) {
                fields.push(`${key} = ?`);
                values.push(value);
            }
        }

        if (fields.length === 0) return false;

        values.push(id);
        const [result] = await pool.execute(
            `UPDATE users SET ${fields.join(', ')} WHERE id = ?`,
            values
        );
        return result.affectedRows > 0;
    }

    // 删除用户
    static async delete(id) {
        const [result] = await pool.execute(
            'DELETE FROM users WHERE id = ?',
            [id]
        );
        return result.affectedRows > 0;
    }

    // 验证密码
    static async verifyPassword(plainPassword, hashedPassword) {
        return bcrypt.compare(plainPassword, hashedPassword);
    }
}

module.exports = UserModel;
