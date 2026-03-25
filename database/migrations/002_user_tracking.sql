-- 用户行为追踪表
CREATE TABLE IF NOT EXISTS user_tracking (
    id INT PRIMARY KEY AUTO_INCREMENT,
    session_id VARCHAR(64) NOT NULL,          -- 会话ID
    user_id INT NULL,                          -- 用户ID（登录后）
    page_url VARCHAR(500) NOT NULL,            -- 页面URL
    page_path VARCHAR(255) NOT NULL,           -- 页面路径
    referrer VARCHAR(500),                     -- 来源页面
    
    -- 设备信息
    user_agent TEXT,                           -- 浏览器UA
    device_type ENUM('mobile', 'tablet', 'desktop') DEFAULT 'desktop',
    browser VARCHAR(50),                       -- 浏览器
    os VARCHAR(50),                            -- 操作系统
    screen_resolution VARCHAR(20),             -- 屏幕分辨率
    
    -- 行为数据
    entry_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,  -- 进入时间
    exit_time TIMESTAMP NULL,                        -- 离开时间
    stay_duration INT DEFAULT 0,                    -- 停留时长（秒）
    click_count INT DEFAULT 0,                       -- 点击次数
    scroll_depth INT DEFAULT 0,                      -- 最大滚动深度（%）
    
    -- 点击详情（JSON格式存储点击坐标和元素）
    click_details JSON,
    
    -- IP和地理位置
    ip_address VARCHAR(45),
    country VARCHAR(50),
    city VARCHAR(50),
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_session_id (session_id),
    INDEX idx_page_path (page_path),
    INDEX idx_entry_time (entry_time),
    INDEX idx_device_type (device_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 实时会话表（用于统计在线用户）
CREATE TABLE IF NOT EXISTS active_sessions (
    session_id VARCHAR(64) PRIMARY KEY,
    page_path VARCHAR(255),
    last_activity TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    device_type VARCHAR(20),
    ip_address VARCHAR(45)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 页面统计表（每日汇总）
CREATE TABLE IF NOT EXISTS page_stats (
    id INT PRIMARY KEY AUTO_INCREMENT,
    stat_date DATE NOT NULL,
    page_path VARCHAR(255) NOT NULL,
    pv INT DEFAULT 0,                    -- 页面浏览量
    uv INT DEFAULT 0,                    -- 独立访客
    avg_stay_time INT DEFAULT 0,         -- 平均停留时间
    total_clicks INT DEFAULT 0,          -- 总点击数
    bounce_rate DECIMAL(5,2) DEFAULT 0,  -- 跳出率
    
    UNIQUE KEY unique_date_path (stat_date, page_path),
    INDEX idx_stat_date (stat_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
