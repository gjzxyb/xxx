const express = require('express');
const router = express.Router();
const { success, error } = require('../utils/response');
const { authenticate, generateToken } = require('../middleware/auth');
const { authenticateProject } = require('../middleware/projectAuth');
const { projectDb } = require('../middleware/projectDb');
const { validatePasswordMiddleware, getPasswordPolicy } = require('../middleware/passwordPolicy');
const { validateLogin, validatePasswordChange } = require('../middleware/validation');
const loginAttemptTracker = require('../lib/LoginAttemptTracker');
const tokenBlacklist = require('../lib/TokenBlacklist');
const jwt = require('jsonwebtoken');

/**
 * 用户登录
 * POST /api/auth/login
 * 安全性：添加登录失败锁定机制
 */
router.post('/login', validateLogin, async (req, res) => {
  try {
    const { studentId, password, projectId } = req.body;

    if (!studentId || !password) {
      return error(res, '请输入学号和密码');
    }

    if (!projectId) {
      return error(res, '缺少项目信息', 400);
    }

    // 安全性：检查账号是否被锁定
    const lockIdentifier = `${projectId}:${studentId}`;
    const locked = loginAttemptTracker.isLocked(lockIdentifier);
    if (locked) {
      return res.status(423).json({
        code: 423,
        message: locked.message,
        lockedUntil: locked.lockedUntil
      });
    }

    // 使用项目数据库查询用户
    const dbManager = require('../lib/DatabaseManager');

    if (!dbManager.projectDbExists(projectId)) {
      return error(res, '项目不存在', 404);
    }

    const projectModels = await dbManager.getProjectModels(projectId);
    const { User } = projectModels;

    const user = await User.findOne({ where: { studentId } });
    if (!user) {
      // 安全性：记录失败尝试
      const result = loginAttemptTracker.recordFailure(lockIdentifier);
      return res.status(result.locked ? 423 : 401).json({
        code: result.locked ? 423 : 401,
        message: result.message,
        remainingAttempts: result.remainingAttempts,
        lockedUntil: result.lockedUntil
      });
    }

    const isValid = await user.validatePassword(password);
    if (!isValid) {
      // 安全性：记录失败尝试
      const result = loginAttemptTracker.recordFailure(lockIdentifier);
      return res.status(result.locked ? 423 : 401).json({
        code: result.locked ? 423 : 401,
        message: result.message,
        remainingAttempts: result.remainingAttempts,
        lockedUntil: result.lockedUntil
      });
    }

    // 安全性：登录成功，清除失败记录
    loginAttemptTracker.recordSuccess(lockIdentifier);

    // 生成 token，包含 projectId
    const token = generateToken({ ...user.toJSON(), projectId });

    success(res, {
      token,
      user: { ...user.toSafeObject(), projectId }
    }, '登录成功');
  } catch (err) {
    console.error('登录错误:', err);
    error(res, '登录失败，请稍后重试', 500);
  }
});

/**
 * 用户注册
 * POST /api/auth/register
 */
router.post('/register', validatePasswordMiddleware, async (req, res) => {
  try {
    // 检查注册是否开放（默认关闭）
    const { SystemConfig } = require('../models');
    const registrationEnabled = await SystemConfig.getValue('registration_enabled', 'false');
    if (registrationEnabled !== 'true') {
      return error(res, '注册功能已关闭，请联系管理员', 403);
    }

    const { studentId, name, password, className, phone, projectId } = req.body;

    if (!studentId || !name || !password) {
      return error(res, '请填写必要信息（学号、姓名、密码）');
    }

    if (!projectId) {
      return error(res, '缺少项目信息', 400);
    }

    // 使用项目数据库查询和创建用户
    const dbManager = require('../lib/DatabaseManager');

    if (!dbManager.projectDbExists(projectId)) {
      return error(res, '项目不存在', 404);
    }

    const projectModels = await dbManager.getProjectModels(projectId);
    const { User: ProjectUser } = projectModels;

    // 检查学号是否已存在（在项目数据库中）
    const existing = await ProjectUser.findOne({ where: { studentId } });
    if (existing) {
      return error(res, '该学号已被注册');
    }

    const user = await ProjectUser.create({
      studentId,
      name,
      password,
      className,
      phone,
      role: 'student'
    });

    const token = generateToken(user);

    success(res, {
      token,
      user: user.toSafeObject()
    }, '注册成功');
  } catch (err) {
    console.error('注册错误:', err);
    error(res, '注册失败，请稍后重试', 500);
  }
});

/**
 * 获取当前用户信息
 * GET /api/auth/profile
 */
router.get('/profile', authenticate, async (req, res) => {
  try {
    success(res, req.user.toSafeObject());
  } catch (err) {
    console.error('获取用户信息错误:', err);
    error(res, '获取用户信息失败', 500);
  }
});

/**
 * 修改密码
 * PUT /api/auth/password
 * 安全性：验证旧密码，检查新密码强度
 */
router.put('/password', projectDb, authenticateProject, async (req, res) => {
  try {
    console.log('========== 修改密码请求开始 ==========');
    console.log('用户:', req.user?.studentId, req.user?.name);
    console.log('请求体:', JSON.stringify(req.body, null, 2));
    
    const { oldPassword, newPassword } = req.body;

    // 基本验证
    if (!oldPassword || !newPassword) {
      console.error('缺少必需字段');
      return error(res, '请输入原密码和新密码');
    }

    // 检查新密码格式
    if (newPassword.length < 8 || newPassword.length > 32) {
      console.error('密码长度不符合要求:', newPassword.length);
      return res.status(400).json({
        code: 400,
        message: '密码长度必须在8-32个字符之间',
        errors: [`当前长度: ${newPassword.length}`]
      });
    }

    if (!/[A-Z]/.test(newPassword)) {
      console.error('密码缺少大写字母');
      return res.status(400).json({
        code: 400,
        message: '密码必须包含至少一个大写字母',
        errors: []
      });
    }

    if (!/[a-z]/.test(newPassword)) {
      console.error('密码缺少小写字母');
      return res.status(400).json({
        code: 400,
        message: '密码必须包含至少一个小写字母',
        errors: []
      });
    }

    if (!/[0-9]/.test(newPassword)) {
      console.error('密码缺少数字');
      return res.status(400).json({
        code: 400,
        message: '密码必须包含至少一个数字',
        errors: []
      });
    }

    // 检查禁用词
    const lowerPassword = newPassword.toLowerCase();
    const forbiddenPatterns = ['123456', 'password', 'qwerty', 'admin', 'abc123'];
    for (const pattern of forbiddenPatterns) {
      if (lowerPassword.includes(pattern)) {
        console.error('密码包含禁用词:', pattern);
        return res.status(400).json({
          code: 400,
          message: '密码过于简单，请使用更复杂的密码',
          errors: [`包含禁用词: ${pattern}`]
        });
      }
    }

    // 验证旧密码
    console.log('验证旧密码...');
    const isValid = await req.user.validatePassword(oldPassword);
    if (!isValid) {
      console.error('旧密码错误');
      return error(res, '原密码错误');
    }

    // 更新密码
    console.log('更新密码...');
    req.user.password = newPassword;
    await req.user.save();

    console.log('密码修改成功!');
    console.log('========== 修改密码请求结束 ==========');
    success(res, null, '密码修改成功');
  } catch (err) {
    console.error('========== 修改密码异常 ==========');
    console.error(err);
    error(res, '修改密码失败: ' + err.message, 500);
  }
});


/**
 * 公开API: 获取当前项目的注册状态
 * GET /api/auth/registration-status
 * 不需要认证
 */
router.get('/registration-status', async (req, res) => {
  try {
    const { Project } = require('../models');

    // 获取第一个项目（假设单项目系统）
    const project = await Project.findOne();

    if (!project) {
      // 如果没有项目，默认允许注册
      return success(res, { registrationEnabled: true });
    }

    success(res, {
      registrationEnabled: project.registrationEnabled !== false
    });
  } catch (err) {
    console.error('获取注册状态错误:', err);
    // 发生错误时，为了安全起见，默认允许注册
    success(res, { registrationEnabled: true });
  }
});

/**
 * 获取密码策略配置
 * GET /api/auth/password-policy
 */
router.get('/password-policy', async (req, res) => {
  try {
    const policy = getPasswordPolicy();
    success(res, policy);
  } catch (err) {
    console.error('获取密码策略错误:', err);
    error(res, '获取密码策略失败', 500);
  }
});

/**
 * 用户登出
 * POST /api/auth/logout
 * 安全性：将token加入黑名单，实现即时失效
 */
router.post('/logout', authenticate, (req, res) => {
  try {
    // 从header获取token
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      const decoded = jwt.decode(token);
      
      if (decoded && decoded.exp) {
        // 将token加入黑名单，直到其自然过期
        tokenBlacklist.add(token, decoded.exp * 1000);
      }
    }

    success(res, null, '登出成功');
  } catch (err) {
    console.error('登出错误:', err);
    error(res, '登出失败', 500);
  }
});

module.exports = router;
