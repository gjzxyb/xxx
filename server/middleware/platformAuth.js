const jwt = require('jsonwebtoken');
const { PlatformUser } = require('../models');
const tokenBlacklist = require('../lib/TokenBlacklist');

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

/**
 * 平台用户认证中间件 - 验证JWT token
 */
function authenticatePlatform(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ code: 401, message: '未提供认证令牌' });
  }

  jwt.verify(token, JWT_SECRET, async (err, decoded) => {
    if (err) {
      console.error('JWT验证失败:', err.message);
      return res.status(403).json({ code: 403, message: '令牌无效或已过期' });
    }

    try {
      // Extract user ID - handle both primitive and object cases
      const userId = typeof decoded.userId === 'object' && decoded.userId !== null
        ? decoded.userId.id
        : decoded.userId;

      if (!userId) {
        console.error('Token中缺少有效的userId:', decoded);
        return res.status(401).json({ code: 401, message: '令牌格式无效' });
      }

      const user = await PlatformUser.findByPk(userId);
      if (!user) {
        console.error('用户不存在:', userId);
        return res.status(404).json({ code: 404, message: '用户不存在' });
      }

      if (user.isDisabled) {
        console.error('账号已被禁用:', user.email);
        return res.status(403).json({ code: 403, message: '账号已被禁用' });
      }

      req.user = user;
      next();
    } catch (error) {
      console.error('认证过程错误:', error);
      res.status(500).json({ code: 500, message: '认证失败' });
    }
  });
}

/**
 * 超级管理员认证中间件
 */
function requireSuperAdmin(req, res, next) {
  if (!req.user || !req.user.isSuperAdmin) {
    console.error('超级管理员权限检查失败:', {
      hasUser: !!req.user,
      isSuperAdmin: req.user?.isSuperAdmin,
      userEmail: req.user?.email
    });
    return res.status(403).json({ code: 403, message: '需要超级管理员权限' });
  }
  next();
}

/**
 * 生成JWT token for platform users
 */
function generatePlatformToken(userId) {
  return jwt.sign({ userId, type: 'platform' }, JWT_SECRET, { expiresIn: '7d' });
}

module.exports = {
  authenticatePlatform,
  requireSuperAdmin,
  generatePlatformToken,
  JWT_SECRET
};
