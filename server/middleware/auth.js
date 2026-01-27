const jwt = require('jsonwebtoken');
const { User } = require('../models');
const { unauthorized, forbidden } = require('../utils/response');

const JWT_SECRET = process.env.JWT_SECRET || 'student-selection-secret-key-2024';

/**
 * JWT认证中间件
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
 */
const generateToken = (user) => {
  return jwt.sign(
    { userId: user.id, role: user.role },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
};

module.exports = {
  authenticate,
  requireAdmin,
  generateToken,
  JWT_SECRET
};
