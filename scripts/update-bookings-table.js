const mysql = require('mysql2/promise');
require('dotenv').config();

async function updateBookingsTable() {
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
            WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'bookings'
        `, [process.env.DB_NAME || 'wujie_tea']);
        
        const existingColumns = columns.map(c => c.COLUMN_NAME);
        
        const newFields = [
            { name: 'visitor_id', type: 'VARCHAR(64)', comment: '访客ID' },
            { name: 'ip_address', type: 'VARCHAR(45)', comment: 'IP地址' },
            { name: 'device_type', type: 'VARCHAR(50)', comment: '设备类型' },
            { name: 'device_model', type: 'VARCHAR(100)', comment: '设备型号' },
            { name: 'os', type: 'VARCHAR(50)', comment: '操作系统' },
            { name: 'browser', type: 'VARCHAR(50)', comment: '浏览器' },
            { name: 'page_url', type: 'VARCHAR(255)', comment: '提交页面' }
        ];
        
        for (const field of newFields) {
            if (!existingColumns.includes(field.name)) {
                await connection.execute(`
                    ALTER TABLE bookings ADD COLUMN ${field.name} ${field.type} COMMENT '${field.comment}'
                `);
                console.log(`✅ 添加字段: ${field.name}`);
            } else {
                console.log(`ℹ️ 字段已存在: ${field.name}`);
            }
        }

        await connection.end();
        console.log('🎉 bookings表更新完成！');
        process.exit(0);
    } catch (error) {
        console.error('❌ 更新失败:', error);
        process.exit(1);
    }
}

updateBookingsTable();
