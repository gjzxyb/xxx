const jwt = require('jsonwebtoken');
const { PlatformUser } = require('../models');

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
      return res.status(403).json({ code: 403, message: '令牌无效或已过期' });
    }

    try {
      const user = await PlatformUser.findByPk(decoded.userId);
      if (!user) {
        return res.status(404).json({ code: 404, message: '用户不存在' });
      }

      if (user.isDisabled) {
        return res.status(403).json({ code: 403, message: '账号已被禁用' });
      }

      req.user = user;
      next();
    } catch (error) {
      res.status(500).json({ code: 500, message: '认证失败' });
    }
  });
}

/**
 * 超级管理员认证中间件
 */
function requireSuperAdmin(req, res, next) {
  if (!req.user || !req.user.isSuperAdmin) {
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
