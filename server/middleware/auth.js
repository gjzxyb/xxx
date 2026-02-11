const jwt = require('jsonwebtoken');
const { User } = require('../models');
const { unauthorized, forbidden } = require('../utils/response');
const tokenBlacklist = require('../lib/TokenBlacklist');
const { JWT_SECRET, getJWTAccessExpiry, getJWTRefreshExpiry } = require('../config/security');

/**
 * JWT认证中间件
 * 安全性：检查token黑名单，仅接受Authorization header中的token
 * 注意：此中间件用于平台级认证，项目级认证请使用 projectAuth.js
 */
const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    let token;

    // 仅从 Authorization header 获取 token
    // 安全性：不再接受query参数中的token，防止token泄露到日志、浏览器历史等
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7);
    }

    if (!token) {
      return unauthorized(res, '请先登录');
    }

    // 安全性：检查token是否在黑名单中
    if (await tokenBlacklist.isBlacklisted(token)) {
      return unauthorized(res, 'Token已失效，请重新登录');
    }

    const decoded = jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] });

    // 如果token中有projectId，将其附加到req（用于后续中间件）
    if (decoded.projectId) {
      req.projectId = decoded.projectId;
    }

    // 注意：这里查询的是平台级User表，仅用于平台管理
    // 项目级用户认证应该使用 projectAuth.js 中的 authenticateProject
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
 * 文件下载专用认证中间件
 * 使用一次性下载令牌，而非长期JWT token
 * 用法：生成短期（5分钟）的下载令牌，仅用于特定文件下载
 */
const authenticateFileDownload = async (req, res, next) => {
  try {
    const downloadToken = req.query.token;
    
    if (!downloadToken) {
      return unauthorized(res, '缺少下载令牌');
    }

    // 验证下载令牌（短期有效，5分钟）
    const decoded = jwt.verify(downloadToken, JWT_SECRET, { 
      algorithms: ['HS256'],
      maxAge: '5m' // 最大5分钟有效期
    });

    // 检查令牌类型
    if (decoded.type !== 'download') {
      return unauthorized(res, '无效的下载令牌');
    }

    // 检查文件路径是否匹配
    if (decoded.filePath && decoded.filePath !== req.path) {
      return unauthorized(res, '令牌与文件路径不匹配');
    }

    req.userId = decoded.userId;
    req.downloadToken = decoded;
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return unauthorized(res, '下载令牌已过期，请重新生成');
    }
    return unauthorized(res, '无效的下载令牌');
  }
};

/**
 * 生成文件下载令牌
 * @param {number} userId - 用户ID
 * @param {string} filePath - 文件路径
 * @returns {string} 下载令牌
 */
const generateDownloadToken = (userId, filePath) => {
  return jwt.sign(
    {
      userId,
      filePath,
      type: 'download',
      timestamp: Date.now()
    },
    JWT_SECRET,
    {
      expiresIn: '5m', // 5分钟有效期
      algorithm: 'HS256'
    }
  );
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
  const payload = {
    userId: user.id,
    role: user.role
  };

  // 如果提供了projectId，也签入token
  if (user.projectId) {
    payload.projectId = user.projectId;
  }

  return jwt.sign(
    payload,
    JWT_SECRET,
    { 
      expiresIn: getJWTAccessExpiry(),
      algorithm: 'HS256'  // 安全性：明确指定算法，防止算法混淆攻击
    }
  );
};

/**
 * 生成刷新令牌（可选实现）
 * Refresh Token用于在访问令牌过期后获取新的访问令牌
 */
const generateRefreshToken = (user) => {
  return jwt.sign(
    { userId: user.id, type: 'refresh' },
    JWT_SECRET,
    { 
      expiresIn: getJWTRefreshExpiry(),
      algorithm: 'HS256'  // 安全性：明确指定算法
    }
  );
};

module.exports = {
  authenticate,
  authenticateFileDownload,
  requireAdmin,
  generateToken,
  generateRefreshToken,
  generateDownloadToken,
  JWT_SECRET
};
