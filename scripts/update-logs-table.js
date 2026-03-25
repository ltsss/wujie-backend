const mysql = require('mysql2/promise');
require('dotenv').config();

async function updateLogsTable() {
    try {
        const connection = await mysql.createConnection({
            host: process.env.DB_HOST || 'localhost',
            port: process.env.DB_PORT || 3306,
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD || '',
            database: process.env.DB_NAME || 'wujie_tea'
        });

        // 检查并添加新字段
        const [columns] = await connection.execute(`
            SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'logs'
        `, [process.env.DB_NAME || 'wujie_tea']);
        
        const existingColumns = columns.map(c => c.COLUMN_NAME);
        
        const newFields = [
            { name: 'visitor_id', type: 'VARCHAR(64)', comment: '访客唯一ID' },
            { name: 'device_type', type: 'VARCHAR(50)', comment: '设备类型' },
            { name: 'device_model', type: 'VARCHAR(100)', comment: '设备型号' },
            { name: 'os', type: 'VARCHAR(50)', comment: '操作系统' },
            { name: 'browser', type: 'VARCHAR(50)', comment: '浏览器' },
            { name: 'page_url', type: 'VARCHAR(255)', comment: '页面URL' },
            { name: 'referrer', type: 'VARCHAR(255)', comment: '来源页面' },
            { name: 'duration', type: 'INT', comment: '停留时长(秒)' },
            { name: 'session_id', type: 'VARCHAR(64)', comment: '会话ID' }
        ];
        
        for (const field of newFields) {
            if (!existingColumns.includes(field.name)) {
                await connection.execute(`
                    ALTER TABLE logs ADD COLUMN ${field.name} ${field.type} COMMENT '${field.comment}'
                `);
                console.log(`✅ 添加字段: ${field.name}`);
            }
        }

        // 创建访客表
        await connection.execute(`
            CREATE TABLE IF NOT EXISTS visitors (
                id INT PRIMARY KEY AUTO_INCREMENT,
                visitor_id VARCHAR(64) UNIQUE NOT NULL,
                first_visit TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                last_visit TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                visit_count INT DEFAULT 1,
                device_type VARCHAR(50),
                device_model VARCHAR(100),
                os VARCHAR(50),
                browser VARCHAR(50),
                ip_address VARCHAR(45),
                INDEX idx_visitor_id (visitor_id),
                INDEX idx_last_visit (last_visit)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        `);
        console.log('✅ visitors表创建成功');

        // 创建会话表
        await connection.execute(`
            CREATE TABLE IF NOT EXISTS sessions (
                id INT PRIMARY KEY AUTO_INCREMENT,
                session_id VARCHAR(64) UNIQUE NOT NULL,
                visitor_id VARCHAR(64) NOT NULL,
                start_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                end_time TIMESTAMP NULL,
                duration INT,
                page_views INT DEFAULT 0,
                ip_address VARCHAR(45),
                device_type VARCHAR(50),
                device_model VARCHAR(100),
                os VARCHAR(50),
                browser VARCHAR(50),
                INDEX idx_session_id (session_id),
                INDEX idx_visitor_id (visitor_id),
                INDEX idx_start_time (start_time)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        `);
        console.log('✅ sessions表创建成功');

        await connection.end();
        console.log('🎉 数据库更新完成！');
        process.exit(0);
    } catch (error) {
        console.error('❌ 更新失败:', error);
        process.exit(1);
    }
}

updateLogsTable();
