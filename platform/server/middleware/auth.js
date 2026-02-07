const jwt = require('jsonwebtoken');
const { PlatformUser } = require('../models');

// JWT_SECRET必须在环境变量中配置
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  console.error('❌ 致命错误: JWT_SECRET未配置！');
  console.error('   请在.env文件中设置JWT_SECRET环境变量');
  process.exit(1);
}

/**
 * 认证中间件 - 验证JWT token
 */
function authenticate(req, res, next) {
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
 * 生成JWT token
 */
function generateToken(userId) {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: '7d' });
}

module.exports = {
  authenticate,
  requireSuperAdmin,
  generateToken,
  JWT_SECRET
};
