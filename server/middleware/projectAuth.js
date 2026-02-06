/**
 * 项目级认证中间件
 * 用于需要在项目数据库中验证用户的路由
 */
const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'student-selection-secret-key-2024';

/**
 * 项目级认证 - 在项目数据库中验证用户
 * 必须在 projectDb 中间件之后使用
 */
async function authenticateProject(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ code: 401, message: '请先登录' });
    }

    const token = authHeader.substring(7);
    let decoded;

    try {
      decoded = jwt.verify(token, JWT_SECRET);
    } catch (err) {
      if (err.name === 'TokenExpiredError') {
        return res.status(401).json({ code: 401, message: '登录已过期，请重新登录' });
      }
      return res.status(401).json({ code: 401, message: '无效的认证信息' });
    }

    const { User } = req.projectModels;

    // 在项目数据库中查找用户
    const user = await User.findByPk(decoded.userId);
    if (!user) {
      return res.status(401).json({ code: 401, message: '用户不存在' });
    }

    req.user = user;
    req.userId = user.id;
    next();
  } catch (err) {
    console.error('项目认证错误:', err);
    return res.status(401).json({ code: 401, message: '认证失败' });
  }
}

/**
 * 项目级管理员权限检查
 * 必须在 authenticateProject 之后使用
 */
async function requireProjectAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ code: 403, message: '需要管理员权限' });
  }
  next();
}

module.exports = {
  authenticateProject,
  requireProjectAdmin
};
