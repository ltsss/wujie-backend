# 無界茶台后端 API 设计

## 技术栈
- Node.js + Express
- MySQL 数据库
- JWT 认证
- bcrypt 密码加密

## 数据库设计

### 1. 用户表 (users)
```sql
CREATE TABLE users (
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
);
```

### 2. 客户预约表 (bookings)
```sql
CREATE TABLE bookings (
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
    FOREIGN KEY (handled_by) REFERENCES users(id)
);
```

### 3. 操作日志表 (logs)
```sql
CREATE TABLE logs (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT,
    action VARCHAR(100) NOT NULL,
    details TEXT,
    ip_address VARCHAR(45),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
);
```

## API 接口

### 公开接口 (无需认证)
- `POST /api/bookings` - 提交预约表单

### 管理接口 (需要 JWT 认证)
- `POST /api/auth/login` - 登录
- `POST /api/auth/logout` - 登出
- `GET /api/auth/me` - 获取当前用户信息

- `GET /api/bookings` - 获取预约列表
- `GET /api/bookings/:id` - 获取单个预约详情
- `PUT /api/bookings/:id` - 更新预约状态
- `DELETE /api/bookings/:id` - 删除预约

- `GET /api/users` - 获取用户列表 (admin only)
- `POST /api/users` - 创建用户 (admin only)
- `PUT /api/users/:id` - 更新用户 (admin only)
- `DELETE /api/users/:id` - 删除用户 (admin only)

- `GET /api/logs` - 获取操作日志 (admin only)

## 权限控制
- `admin` - 可以管理所有资源
- `staff` - 只能查看和更新预约，不能管理用户
