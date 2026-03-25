const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h';

// 生成 JWT Token
function generateToken(payload) {
    return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

// 验证 JWT Token
function verifyToken(token) {
    try {
        return jwt.verify(token, JWT_SECRET);
    } catch (error) {
        return null;
    }
}

// JWT 认证中间件
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
        return res.status(401).json({ 
            success: false, 
            message: '未提供认证令牌' 
        });
    }

    const decoded = verifyToken(token);
    if (!decoded) {
        return res.status(403).json({ 
            success: false, 
            message: '令牌无效或已过期' 
        });
    }

    req.user = decoded;
    next();
}

// 角色权限检查中间件
function requireRole(...roles) {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ 
                success: false, 
                message: '未认证' 
            });
        }

        if (!roles.includes(req.user.role)) {
            return res.status(403).json({ 
                success: false, 
                message: '权限不足' 
            });
        }

        next();
    };
}

module.exports = {
    generateToken,
    verifyToken,
    authenticateToken,
    requireRole
};
