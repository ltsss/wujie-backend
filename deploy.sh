#!/bin/bash
# 無界茶台后端部署脚本（无 Docker 版本）

set -e

echo "🚀 开始部署無界茶台后端..."

# 进入部署目录
cd /opt/wujie-backend

# 检查环境变量文件
if [ ! -f ".env" ]; then
    echo "❌ 错误: .env 文件不存在"
    echo "请创建 .env 文件:"
    echo "  DB_HOST=localhost"
    echo "  DB_PORT=3306"
    echo "  DB_NAME=wujie_tea"
    echo "  DB_USER=root"
    echo "  DB_PASSWORD=你的密码"
    echo "  JWT_SECRET=your-secret"
    echo "  JWT_EXPIRES_IN=24h"
    echo "  PORT=3000"
    echo "  NODE_ENV=production"
    echo "  FRONTEND_URL=https://www.wujietest.com"
    exit 1
fi

# 安装依赖
echo "📦 安装依赖..."
npm install

# 停止旧服务
echo "🛑 停止旧服务..."
pm2 stop wujie-backend 2>/dev/null || true
pm2 delete wujie-backend 2>/dev/null || true

# 启动服务
echo "🚀 启动服务..."
pm2 start server.js --name wujie-backend

# 保存 PM2 配置
pm2 save

# 等待服务启动
echo "⏳ 等待服务启动..."
sleep 3

# 检查健康状态
echo "🔍 检查服务状态..."
if curl -s http://localhost:3000/health > /dev/null; then
    echo "✅ 服务运行正常"
else
    echo "❌ 服务启动失败，查看日志:"
    pm2 logs wujie-backend --lines 20
    exit 1
fi

echo ""
echo "✅ 部署完成！"
echo ""
echo "📊 服务状态:"
pm2 status
echo ""
echo "📝 日志查看:"
echo "  pm2 logs wujie-backend"
echo ""
echo "🌐 API 地址: http://localhost:3000"
echo ""
echo "⚡ 常用命令:"
echo "  pm2 restart wujie-backend  # 重启"
echo "  pm2 stop wujie-backend     # 停止"
echo "  pm2 monit                  # 监控"
