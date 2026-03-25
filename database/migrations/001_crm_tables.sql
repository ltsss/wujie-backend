-- CRM 系统数据库迁移脚本
-- 创建销售表、客户分配表、跟进记录表

-- 1. 创建销售表
CREATE TABLE IF NOT EXISTS sales (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    name VARCHAR(50) NOT NULL,
    phone VARCHAR(20),
    email VARCHAR(100),
    wechat VARCHAR(50),
    daily_limit INT DEFAULT 10,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_user_id (user_id),
    INDEX idx_is_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. 创建客户分配表
CREATE TABLE IF NOT EXISTS booking_assignments (
    id INT PRIMARY KEY AUTO_INCREMENT,
    booking_id INT NOT NULL,
    sales_id INT NOT NULL,
    assigned_by INT,
    assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    status ENUM('active', 'transferred', 'closed') DEFAULT 'active',
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE,
    FOREIGN KEY (sales_id) REFERENCES sales(id) ON DELETE CASCADE,
    FOREIGN KEY (assigned_by) REFERENCES users(id) ON DELETE SET NULL,
    UNIQUE KEY unique_booking (booking_id),
    INDEX idx_sales_id (sales_id),
    INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. 创建跟进记录表
CREATE TABLE IF NOT EXISTS follow_ups (
    id INT PRIMARY KEY AUTO_INCREMENT,
    booking_id INT NOT NULL,
    sales_id INT NOT NULL,
    contact_type ENUM('phone', 'wechat', 'visit', 'other') DEFAULT 'phone',
    contact_result VARCHAR(50),
    content TEXT NOT NULL,
    next_follow_up DATE,
    next_follow_up_note TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE,
    FOREIGN KEY (sales_id) REFERENCES sales(id) ON DELETE CASCADE,
    INDEX idx_booking_id (booking_id),
    INDEX idx_sales_id (sales_id),
    INDEX idx_next_follow_up (next_follow_up)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. 为 bookings 表添加新字段（使用存储过程检查字段是否存在）
DELIMITER $$
CREATE PROCEDURE AddBookingColumns()
BEGIN
    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS 
                   WHERE TABLE_NAME = 'bookings' AND COLUMN_NAME = 'assigned_to') THEN
        ALTER TABLE bookings ADD COLUMN assigned_to INT NULL AFTER status;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS 
                   WHERE TABLE_NAME = 'bookings' AND COLUMN_NAME = 'assigned_at') THEN
        ALTER TABLE bookings ADD COLUMN assigned_at TIMESTAMP NULL AFTER assigned_to;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS 
                   WHERE TABLE_NAME = 'bookings' AND COLUMN_NAME = 'last_contact_at') THEN
        ALTER TABLE bookings ADD COLUMN last_contact_at TIMESTAMP NULL AFTER assigned_at;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS 
                   WHERE TABLE_NAME = 'bookings' AND COLUMN_NAME = 'contact_count') THEN
        ALTER TABLE bookings ADD COLUMN contact_count INT DEFAULT 0 AFTER last_contact_at;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS 
                   WHERE TABLE_NAME = 'bookings' AND COLUMN_NAME = 'priority') THEN
        ALTER TABLE bookings ADD COLUMN priority ENUM('high', 'normal', 'low') DEFAULT 'normal' AFTER contact_count;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS 
                   WHERE TABLE_NAME = 'bookings' AND COLUMN_NAME = 'source') THEN
        ALTER TABLE bookings ADD COLUMN source VARCHAR(50) DEFAULT 'website' AFTER priority;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS 
                   WHERE TABLE_NAME = 'bookings' AND COLUMN_NAME = 'notes') THEN
        ALTER TABLE bookings ADD COLUMN notes TEXT NULL AFTER source;
    END IF;
END$$
DELIMITER ;
CALL AddBookingColumns();
DROP PROCEDURE AddBookingColumns;

-- 添加外键和索引
ALTER TABLE bookings 
    ADD FOREIGN KEY (assigned_to) REFERENCES sales(id) ON DELETE SET NULL,
    ADD INDEX idx_assigned_to (assigned_to),
    ADD INDEX idx_priority (priority),
    ADD INDEX idx_source (source);

-- 5. 插入默认销售账号（关联已有的 admin 用户）
INSERT IGNORE INTO sales (user_id, name, phone, email, daily_limit, is_active)
SELECT id, name, phone, email, 10, TRUE 
FROM users 
WHERE role = 'admin' AND NOT EXISTS (
    SELECT 1 FROM sales WHERE user_id = users.id
);

-- 6. 创建视图：客户完整信息（含分配信息）
CREATE OR REPLACE VIEW booking_details AS
SELECT 
    b.*,
    s.name as sales_name,
    s.phone as sales_phone,
    s.wechat as sales_wechat,
    ba.assigned_at as assignment_date,
    ba.status as assignment_status,
    (SELECT COUNT(*) FROM follow_ups fu WHERE fu.booking_id = b.id) as follow_up_count,
    (SELECT MAX(fu.created_at) FROM follow_ups fu WHERE fu.booking_id = b.id) as last_follow_up_at
FROM bookings b
LEFT JOIN sales s ON b.assigned_to = s.id
LEFT JOIN booking_assignments ba ON b.id = ba.booking_id AND ba.status = 'active';

-- 7. 创建视图：销售统计
CREATE OR REPLACE VIEW sales_stats AS
SELECT 
    s.id as sales_id,
    s.name as sales_name,
    s.is_active,
    COUNT(DISTINCT b.id) as total_customers,
    SUM(CASE WHEN b.status = 'pending' THEN 1 ELSE 0 END) as pending_count,
    SUM(CASE WHEN b.status = 'contacted' THEN 1 ELSE 0 END) as contacted_count,
    SUM(CASE WHEN b.status = 'quoted' THEN 1 ELSE 0 END) as quoted_count,
    SUM(CASE WHEN b.status = 'closed' THEN 1 ELSE 0 END) as closed_count,
    COUNT(DISTINCT fu.id) as total_follow_ups,
    COUNT(DISTINCT CASE WHEN fu.next_follow_up = CURDATE() THEN fu.id END) as today_follow_ups
FROM sales s
LEFT JOIN bookings b ON s.id = b.assigned_to
LEFT JOIN follow_ups fu ON b.id = fu.booking_id
WHERE s.is_active = TRUE
GROUP BY s.id, s.name, s.is_active;
