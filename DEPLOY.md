# 無界茶台部署文档

## 服务器架构

全部使用服务器原生服务部署，不使用 Docker：

- **前端**: Nginx 直接服务静态文件
- **后端**: PM2 管理 Node.js 进程
- **数据库**: MySQL 系统服务

## 服务器信息

- **IP**: 43.159.199.196
- **域名**: https://www.wujietest.com

## 文件路径

| 项目 | 路径 |
|------|------|
| 前端代码 | `/opt/xiangmu/landing-page-1/` |
| 后端代码 | `/opt/wujie-backend/` |
| Nginx 配置 | `/etc/nginx/conf.d/wujietest.conf` |
| MySQL 数据 | `/var/lib/mysql/` |

## 部署流程

### 1. 前端部署

```bash
# 本地执行 - 同步代码到服务器
rsync -avz ~/Desktop/wujie/ root@test1:/opt/xiangmu/landing-page-1/

# 修复权限
ssh test1 "chmod -R 755 /opt/xiangmu/landing-page-1/ && chown -R 101:101 /opt/xiangmu/landing-page-1/"
```

### 2. 后端部署

```bash
# 本地执行 - 同步代码到服务器
rsync -avz --exclude='node_modules' ~/Desktop/wujiebackend/ root@test1:/opt/wujie-backend/

# 服务器执行 - 运行部署脚本
ssh test1 "cd /opt/wujie-backend && ./deploy.sh"
```

## 服务管理

### Nginx

```bash
# 检查配置
nginx -t

# 重载配置
systemctl reload nginx

# 重启
systemctl restart nginx

# 查看状态
systemctl status nginx
```

### 后端 API (PM2)

```bash
# 查看状态
pm2 status

# 查看日志
pm2 logs wujie-backend

# 重启
pm2 restart wujie-backend

# 停止
pm2 stop wujie-backend

# 监控面板
pm2 monit
```

### MySQL

```bash
# 查看状态
systemctl status mysqld

# 重启
systemctl restart mysqld

# 登录
mysql -u root -p
```

## 环境配置

### 后端环境变量 `/opt/wujie-backend/.env`

```env
DB_HOST=localhost
DB_PORT=3306
DB_NAME=wujie_tea
DB_USER=root
DB_PASSWORD=Wujie@2024
JWT_SECRET=wujie-tea-secret-key-2024
JWT_EXPIRES_IN=24h
PORT=3000
NODE_ENV=production
FRONTEND_URL=https://www.wujietest.com
```

### Nginx 配置 `/etc/nginx/conf.d/wujietest.conf`

```nginx
server {
    listen 80;
    server_name www.wujietest.com;
    
    location /.well-known/acme-challenge/ {
        root /var/www/wujietest;
    }
    
    location / {
        return 301 https://$server_name$request_uri;
    }
}

server {
    listen 443 ssl http2;
    server_name www.wujietest.com;
    
    ssl_certificate /etc/letsencrypt/live/www.wujietest.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/www.wujietest.com/privkey.pem;
    
    # API 反向代理
    location /api/ {
        proxy_pass http://localhost:3000/api/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
    
    # 前端静态文件
    location / {
        root /opt/xiangmu/landing-page-1;
        index index.html;
        try_files $uri $uri/ /index.html;
    }
}
```

## 默认账号

- **管理员**: admin / admin123
- ⚠️ **请登录后立即修改默认密码！**

## 一键部署脚本

本地执行：

```bash
#!/bin/bash
# deploy-all.sh

echo "🚀 部署前端..."
rsync -avz ~/Desktop/wujie/ root@test1:/opt/xiangmu/landing-page-1/
ssh test1 "chmod -R 755 /opt/xiangmu/landing-page-1/ && chown -R 101:101 /opt/xiangmu/landing-page-1/"

echo "🚀 部署后端..."
rsync -avz --exclude='node_modules' ~/Desktop/wujiebackend/ root@test1:/opt/wujie-backend/
ssh test1 "cd /opt/wujie-backend && ./deploy.sh"

echo "✅ 部署完成！"
echo "🌐 https://www.wujietest.com"
```
