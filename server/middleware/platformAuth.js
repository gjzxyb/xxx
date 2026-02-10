const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { PlatformUser } = require('../models');
const tokenBlacklist = require('../lib/TokenBlacklist');

// 安全性：平台级和项目级使用不同的JWT密钥
const PLATFORM_JWT_SECRET = process.env.PLATFORM_JWT_SECRET || (() => {
  if (process.env.NODE_ENV === 'production') {
    console.error('❌ 严重错误: 生产环境必须设置PLATFORM_JWT_SECRET环境变量！');
    process.exit(1);
  }
  // 开发环境：生成临时随机密钥并警告
  const tempSecret = crypto.randomBytes(32).toString('hex');
  console.warn('⚠️  警告: 未设置PLATFORM_JWT_SECRET环境变量，使用临时随机密钥');
  console.warn('⚠️  请在.env文件中设置PLATFORM_JWT_SECRET');
  return tempSecret;
})();

/**
 * 平台用户认证中间件 - 验证JWT token
 */
function authenticatePlatform(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ code: 401, message: '未提供认证令牌' });
  }

  jwt.verify(token, PLATFORM_JWT_SECRET, { algorithms: ['HS256'] }, async (err, decoded) => {
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
 * 安全性：使用独立的平台密钥
 */
function generatePlatformToken(userId) {
  return jwt.sign(
    { userId, type: 'platform' },
    PLATFORM_JWT_SECRET,
    { expiresIn: '7d', algorithm: 'HS256' }  // 安全性：明确指定算法
  );
}

module.exports = {
  authenticatePlatform,
  requireSuperAdmin,
  generatePlatformToken,
  PLATFORM_JWT_SECRET
};
