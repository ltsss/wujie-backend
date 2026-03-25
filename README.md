# 無界茶台后端 API

## 项目结构

```
wujiebackend/
├── config/           # 配置文件
│   └── database.js   # 数据库连接
├── middleware/       # 中间件
│   └── auth.js       # JWT 认证
├── models/           # 数据模型
│   ├── User.js       # 用户模型
│   ├── Booking.js    # 预约模型
│   └── Log.js        # 日志模型
├── routes/           # 路由
│   ├── auth.js       # 认证路由
│   ├── bookings.js   # 预约路由
│   ├── users.js      # 用户路由
│   └── logs.js       # 日志路由
├── scripts/          # 脚本
│   └── init-db.js    # 数据库初始化
├── server.js         # 入口文件
├── package.json      # 依赖配置
├── .env.example      # 环境变量示例
├── deploy.sh         # 部署脚本
├── API_DESIGN.md     # API 设计文档
└── README.md         # 本文件
```

## 技术栈

- Node.js 16+ + Express
- MySQL 8.0
- JWT 认证
- bcrypt 密码加密
- PM2 进程管理

## 本地开发

```bash
# 安装依赖
npm install

# 配置环境变量
cp .env.example .env
# 编辑 .env 配置数据库等信息

# 初始化数据库
npm run init-db

# 启动开发服务器
npm run dev
```

## 服务器部署

### 1. 首次部署

```bash
# 在服务器上执行
cd /opt/wujie-backend
./deploy.sh
```

### 2. 更新部署

```bash
# 从本地同步代码到服务器
rsync -avz --exclude='node_modules' ~/Desktop/wujiebackend/ root@test1:/opt/wujie-backend/

# 在服务器上执行部署
ssh test1 "cd /opt/wujie-backend && ./deploy.sh"
```

## 环境变量配置

创建 `.env` 文件：

```env
# 数据库配置
DB_HOST=localhost
DB_PORT=3306
DB_NAME=wujie_tea
DB_USER=root
DB_PASSWORD=你的MySQL密码

# JWT 配置
JWT_SECRET=your-secret-key
JWT_EXPIRES_IN=24h

# 服务器配置
PORT=3000
NODE_ENV=production

# 前端域名
FRONTEND_URL=https://www.wujietest.com
```

## API 接口

### 公开接口

| 接口 | 方法 | 说明 |
|------|------|------|
| `/api/health` | GET | 健康检查 |
| `/api/auth/login` | POST | 登录 |
| `/api/bookings` | POST | 提交预约 |

### 需要认证的接口

| 接口 | 方法 | 说明 | 权限 |
|------|------|------|------|
| `/api/auth/logout` | POST | 登出 | 登录用户 |
| `/api/auth/me` | GET | 获取当前用户 | 登录用户 |
| `/api/bookings` | GET | 预约列表 | 登录用户 |
| `/api/bookings/stats` | GET | 预约统计 | 登录用户 |
| `/api/bookings/:id` | GET/PUT/DELETE | 预约详情/更新/删除 | 登录用户 |
| `/api/users` | GET/POST | 用户列表/创建 | admin |
| `/api/users/:id` | PUT/DELETE | 更新/删除用户 | admin |
| `/api/logs` | GET | 操作日志 | admin |

## 默认账号

- 用户名: `admin`
- 密码: `admin123`
- ⚠️ **请登录后立即修改默认密码！**

## 常用命令

```bash
# PM2 管理后端
pm2 status                    # 查看状态
pm2 logs wujie-backend        # 查看日志
pm2 restart wujie-backend     # 重启服务
pm2 stop wujie-backend        # 停止服务
pm2 monit                     # 监控面板

# Nginx
nginx -t                      # 检查配置
systemctl reload nginx        # 重载配置
systemctl restart nginx       # 重启 Nginx

# MySQL
systemctl status mysqld       # 查看状态
mysql -u root -p              # 登录 MySQL
```

## 服务器架构

```
┌─────────────────────────────────────────────────────────┐
│                      服务器 (test1)                       │
│  ┌─────────────────┐  ┌─────────────────┐  ┌──────────┐ │
│  │   Nginx (80/443) │  │  PM2 + Node.js  │  │  MySQL   │ │
│  │   - 前端静态文件  │  │  - 后端 API     │  │  - 数据  │ │
│  │   - API 反向代理  │  │  - 端口 3000   │  │  - 3306  │ │
│  └─────────────────┘  └─────────────────┘  └──────────┘ │
└─────────────────────────────────────────────────────────┘
```

## 访问地址

- 网站: https://www.wujietest.com
- API: https://www.wujietest.com/api/

## 文件路径

- 前端代码: `/opt/xiangmu/landing-page-1/`
- 后端代码: `/opt/wujie-backend/`
- Nginx 配置: `/etc/nginx/conf.d/wujietest.conf`
