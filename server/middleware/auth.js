const jwt = require('jsonwebtoken');
const { User } = require('../models');
const { unauthorized, forbidden } = require('../utils/response');
const crypto = require('crypto');
const tokenBlacklist = require('../lib/TokenBlacklist');

// 安全性：必须设置JWT_SECRET环境变量，生产环境禁止使用默认值
const JWT_SECRET = process.env.JWT_SECRET || (() => {
  if (process.env.NODE_ENV === 'production') {
    console.error('❌ 严重错误: 生产环境必须设置JWT_SECRET环境变量！');
    process.exit(1);
  }
  // 开发环境：生成临时随机密钥并警告
  const tempSecret = crypto.randomBytes(32).toString('hex');
  console.warn('⚠️  警告: 未设置JWT_SECRET环境变量，使用临时随机密钥');
  console.warn('⚠️  请在.env文件中设置JWT_SECRET，否则服务器重启后所有token将失效');
  return tempSecret;
})();

/**
 * JWT认证中间件
 * 安全性：检查token黑名单
 */
const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    let token;

    // 优先从 Authorization header 获取 token
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7);
    }
    // 其次从 query 参数获取 token (用于文件下载)
    else if (req.query.token) {
      token = req.query.token;
    }

    if (!token) {
      return unauthorized(res, '请先登录');
    }

    // 安全性：检查token是否在黑名单中
    if (tokenBlacklist.isBlacklisted(token)) {
      return unauthorized(res, 'Token已失效，请重新登录');
    }

    const decoded = jwt.verify(token, JWT_SECRET);

    const user = await User.findByPk(decoded.userId);
    if (!user) {
      return unauthorized(res, '用户不存在');
    }

    req.user = user;
    req.userId = user.id;
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return unauthorized(res, '登录已过期，请重新登录');
    }
    return unauthorized(res, '无效的认证信息');
  }
};

/**
 * 管理员权限中间件
 */
const requireAdmin = (req, res, next) => {
  if (req.user.role !== 'admin') {
    return forbidden(res, '需要管理员权限');
  }
  next();
};

/**
 * 生成JWT Token
 * 安全性：缩短token有效期，建议实施refresh token机制
 */
const generateToken = (user) => {
  // 访问令牌有效期：从环境变量读取，默认2小时
  const accessTokenExpiry = process.env.JWT_ACCESS_EXPIRY || '2h';
  
  return jwt.sign(
    { userId: user.id, role: user.role },
    JWT_SECRET,
    { expiresIn: accessTokenExpiry }
  );
};

/**
 * 生成刷新令牌（可选实现）
 * Refresh Token用于在访问令牌过期后获取新的访问令牌
 */
const generateRefreshToken = (user) => {
  const refreshTokenExpiry = process.env.JWT_REFRESH_EXPIRY || '7d';
  
  return jwt.sign(
    { userId: user.id, type: 'refresh' },
    JWT_SECRET,
    { expiresIn: refreshTokenExpiry }
  );
};

module.exports = {
  authenticate,
  requireAdmin,
  generateToken,
  generateRefreshToken,
  JWT_SECRET
};
