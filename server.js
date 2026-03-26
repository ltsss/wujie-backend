const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const { testConnection } = require('./config/database');
const authRoutes = require('./routes/auth');
const bookingRoutes = require('./routes/bookings');
const userRoutes = require('./routes/users');
const logRoutes = require('./routes/logs');
const adminRoutes = require('./routes/admin');
const salesRoutes = require('./routes/sales');
const trackingRoutes = require('./routes/tracking');

const app = express();
const PORT = process.env.PORT || 3000;

// 安全中间件
app.use(helmet());

// CORS 配置
app.use(cors({
    origin: process.env.FRONTEND_URL || '*',
    credentials: true
}));

// 限流配置
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 分钟
    max: 100, // 每个 IP 限制 100 次请求
    message: { success: false, message: '请求过于频繁，请稍后再试' }
});
app.use(limiter);

// 公开接口更严格的限流
const publicLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 小时
    max: 10, // 每小时最多 10 次
    message: { success: false, message: '提交次数过多，请稍后再试' }
});

// 解析 JSON
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 健康检查
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 路由
app.use('/api/auth', authRoutes);
app.use('/api/bookings', publicLimiter, bookingRoutes);
app.use('/api/users', userRoutes);
app.use('/api/logs', logRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/sales', salesRoutes);
app.use('/api/tracking', trackingRoutes);

// 404 处理
app.use((req, res) => {
    res.status(404).json({ success: false, message: '接口不存在' });
});

// 错误处理
app.use((err, req, res, next) => {
    console.error('服务器错误:', err);
    res.status(500).json({ 
        success: false, 
        message: process.env.NODE_ENV === 'production' 
            ? '服务器内部错误' 
            : err.message 
    });
});

// 启动服务器
async function startServer() {
    // 测试数据库连接
    await testConnection();
    
    app.listen(PORT, () => {
        console.log(`🚀 服务器运行在端口 ${PORT}`);
        console.log(`📚 API 文档: http://localhost:${PORT}/health`);
    });
}

startServer().catch(console.error);
