const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
require('dotenv').config();

async function initDatabase() {
    try {
        console.log('🔄 初始化数据库...');

        // 先连接 MySQL（不指定数据库）
        const connection = await mysql.createConnection({
            host: process.env.DB_HOST || 'localhost',
            port: process.env.DB_PORT || 3306,
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD || ''
        });

        const dbName = process.env.DB_NAME || 'wujie_tea';

        // 创建数据库（如果不存在）
        await connection.execute(`CREATE DATABASE IF NOT EXISTS ${dbName} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
        console.log('✅ 数据库创建成功');

        // 使用数据库
        await connection.query(`USE ${dbName}`);

        // 创建用户表
        await connection.execute(`
            CREATE TABLE IF NOT EXISTS users (
                id INT PRIMARY KEY AUTO_INCREMENT,
                username VARCHAR(50) UNIQUE NOT NULL,
                password VARCHAR(255) NOT NULL,
                role ENUM('admin', 'staff') DEFAULT 'staff',
                name VARCHAR(50),
                phone VARCHAR(20),
                email VARCHAR(100),
                is_active BOOLEAN DEFAULT TRUE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);
        console.log('✅ 用户表创建成功');

        // 创建预约表
        await connection.execute(`
            CREATE TABLE IF NOT EXISTS bookings (
                id INT PRIMARY KEY AUTO_INCREMENT,
                customer_name VARCHAR(50) NOT NULL,
                customer_phone VARCHAR(20) NOT NULL,
                product_series VARCHAR(50) NOT NULL,
                product_model VARCHAR(50) NOT NULL,
                marble_type VARCHAR(50) NOT NULL,
                estimated_price DECIMAL(10,2),
                status ENUM('pending', 'contacted', 'quoted', 'closed') DEFAULT 'pending',
                notes TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                handled_by INT,
                FOREIGN KEY (handled_by) REFERENCES users(id) ON DELETE SET NULL
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);
        console.log('✅ 预约表创建成功');

        // 创建日志表
        await connection.execute(`
            CREATE TABLE IF NOT EXISTS logs (
                id INT PRIMARY KEY AUTO_INCREMENT,
                user_id INT,
                action VARCHAR(100) NOT NULL,
                details TEXT,
                ip_address VARCHAR(45),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);
        console.log('✅ 日志表创建成功');

        // 创建默认管理员账号
        const [existingAdmin] = await connection.execute(
            'SELECT id FROM users WHERE username = ?',
            ['admin']
        );

        if (existingAdmin.length === 0) {
            const hashedPassword = await bcrypt.hash('admin123', 10);
            await connection.execute(
                'INSERT INTO users (username, password, role, name) VALUES (?, ?, ?, ?)',
                ['admin', hashedPassword, 'admin', '系统管理员']
            );
            console.log('✅ 默认管理员账号创建成功');
            console.log('   用户名: admin');
            console.log('   密码: admin123');
            console.log('   ⚠️  请登录后立即修改默认密码！');
        } else {
            console.log('ℹ️  管理员账号已存在');
        }

        console.log('\n🎉 数据库初始化完成！');
        await connection.end();
        process.exit(0);
    } catch (error) {
        console.error('❌ 数据库初始化失败:', error);
        process.exit(1);
    }
}

initDatabase();
