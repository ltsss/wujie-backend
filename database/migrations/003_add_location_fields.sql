-- 003_add_location_fields.sql
-- 添加 IP 地区字段到 logs 和 visitors 表

-- logs 表添加地区字段
ALTER TABLE logs
ADD COLUMN country VARCHAR(100) NULL COMMENT '国家',
ADD COLUMN region VARCHAR(100) NULL COMMENT '省份/地区',
ADD COLUMN city VARCHAR(100) NULL COMMENT '城市';

-- visitors 表添加地区字段
ALTER TABLE visitors
ADD COLUMN country VARCHAR(100) NULL COMMENT '国家',
ADD COLUMN region VARCHAR(100) NULL COMMENT '省份/地区',
ADD COLUMN city VARCHAR(100) NULL COMMENT '城市';

-- 添加索引优化查询
CREATE INDEX idx_logs_country ON logs(country);
CREATE INDEX idx_logs_region ON logs(region);
CREATE INDEX idx_visitors_country ON visitors(country);
CREATE INDEX idx_visitors_region ON visitors(region);