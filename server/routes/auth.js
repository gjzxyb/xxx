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
const emailService = require('../utils/emailService');
const verificationCodeManager = require('../lib/VerificationCodeManager');
const { loginLimiter, registerLimiter, passwordResetLimiter, verificationCodeLimiter, codeLoginLimiter } = require('../middleware/rateLimit');

/**
 * 用户登录
 * POST /api/auth/login
 * 安全性：添加登录失败锁定机制 + 速率限制
 */
router.post('/login', loginLimiter, validateLogin, async (req, res) => {
  try {
    const { studentId, password, projectId } = req.body;

    // 输入验证
    if (!studentId || typeof studentId !== 'string' || studentId.trim().length === 0) {
      return error(res, '请输入有效的学号', 400);
    }

    if (!password || typeof password !== 'string' || password.length === 0) {
      return error(res, '请输入密码', 400);
    }

    if (!projectId || typeof projectId !== 'string') {
      return error(res, '缺少项目信息', 400);
    }

    // 安全性：检查账号是否被锁定（基于学号，避免同一IP下多用户受影响）
    const lockIdentifier = `${projectId}:${studentId}`;
    const locked = await loginAttemptTracker.isLocked(lockIdentifier);
    if (locked) {
      return res.status(423).json({
        code: 423,
        message: locked.message,
        lockedUntil: locked.lockedUntil
      });
    }

    // 使用项目数据库查询用户
    const dbManager = require('../lib/DatabaseManager');

    // 验证项目ID格式
    try {
      dbManager.validateProjectId(projectId);
    } catch (validationError) {
      console.error('项目ID验证失败:', validationError.message);
      return error(res, '无效的项目ID', 400);
    }

    if (!dbManager.projectDbExists(projectId)) {
      return error(res, '项目不存在', 404);
    }

    const projectModels = await dbManager.getProjectModels(projectId);
    const { User } = projectModels;

    const user = await User.findOne({ where: { studentId: studentId.trim() } });
    if (!user) {
      // 安全性：记录失败尝试
      const result = await loginAttemptTracker.recordFailure(lockIdentifier);
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
      const result = await loginAttemptTracker.recordFailure(lockIdentifier);
      return res.status(result.locked ? 423 : 401).json({
        code: result.locked ? 423 : 401,
        message: result.message,
        remainingAttempts: result.remainingAttempts,
        lockedUntil: result.lockedUntil
      });
    }

    // 安全性：登录成功，清除失败记录
    await loginAttemptTracker.recordSuccess(lockIdentifier);

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
 * 安全性：速率限制
 */
router.post('/register', registerLimiter, validatePasswordMiddleware, async (req, res) => {
  try {
    // 检查注册是否开放（默认关闭）
    const { SystemConfig } = require('../models');
    const registrationEnabled = await SystemConfig.getValue('registration_enabled', 'false');
    if (registrationEnabled !== 'true') {
      return error(res, '注册功能已关闭，请联系管理员', 403);
    }

    const { studentId, name, password, className, phone, projectId } = req.body;

    // 输入验证
    if (!studentId || typeof studentId !== 'string' || studentId.trim().length === 0) {
      return error(res, '请输入有效的学号', 400);
    }

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return error(res, '请输入姓名', 400);
    }

    if (!password || typeof password !== 'string' || password.length < 8) {
      return error(res, '密码长度至少8个字符', 400);
    }

    if (!projectId || typeof projectId !== 'string') {
      return error(res, '缺少项目信息', 400);
    }

    // 验证学号长度
    if (studentId.trim().length > 20) {
      return error(res, '学号长度不能超过20个字符', 400);
    }

    // 验证姓名长度
    if (name.trim().length > 50) {
      return error(res, '姓名长度不能超过50个字符', 400);
    }

    // 使用项目数据库查询和创建用户
    const dbManager = require('../lib/DatabaseManager');

    // 验证项目ID格式
    try {
      dbManager.validateProjectId(projectId);
    } catch (validationError) {
      console.error('项目ID验证失败:', validationError.message);
      return error(res, '无效的项目ID', 400);
    }

    if (!dbManager.projectDbExists(projectId)) {
      return error(res, '项目不存在', 404);
    }

    const projectModels = await dbManager.getProjectModels(projectId);
    const { User: ProjectUser } = projectModels;

    // 检查学号是否已存在（在项目数据库中）
    const existing = await ProjectUser.findOne({ where: { studentId: studentId.trim() } });
    if (existing) {
      return error(res, '该学号已被注册');
    }

    const user = await ProjectUser.create({
      studentId: studentId.trim(),
      name: name.trim(),
      password,
      className: className ? className.trim() : null,
      phone: phone ? phone.trim() : null,
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
 * 支持同时更新邮箱地址（可选）
 */
router.put('/password', projectDb, authenticateProject, async (req, res) => {
  try {
    // 安全日志：记录操作但不记录敏感信息
    console.log('修改密码请求开始 - 用户ID:', req.user?.id);

    const { oldPassword, newPassword, email } = req.body;

    // 基本验证
    if (!oldPassword || !newPassword) {
      return error(res, '请输入原密码和新密码');
    }

    // 验证邮箱格式（如果提供）
    if (email !== undefined && email !== null && email !== '') {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return res.status(400).json({
          code: 400,
          message: '邮箱格式不正确',
          errors: []
        });
      }
    }

    // 检查新密码格式
    if (newPassword.length < 8 || newPassword.length > 32) {
      return res.status(400).json({
        code: 400,
        message: '密码长度必须在8-32个字符之间',
        errors: [`当前长度: ${newPassword.length}`]
      });
    }

    if (!/[A-Z]/.test(newPassword)) {
      return res.status(400).json({
        code: 400,
        message: '密码必须包含至少一个大写字母',
        errors: []
      });
    }

    if (!/[a-z]/.test(newPassword)) {
      return res.status(400).json({
        code: 400,
        message: '密码必须包含至少一个小写字母',
        errors: []
      });
    }

    if (!/[0-9]/.test(newPassword)) {
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
        return res.status(400).json({
          code: 400,
          message: '密码过于简单，请使用更复杂的密码',
          errors: [`包含禁用词: ${pattern}`]
        });
      }
    }

    // 验证旧密码
    const isValid = await req.user.validatePassword(oldPassword);
    if (!isValid) {
      return error(res, '原密码错误');
    }

    // 检查邮箱是否已被其他用户使用
    if (email !== undefined && email !== null && email !== '') {
      const { User } = req.projectModels;
      const existingUser = await User.findOne({
        where: { email }
      });

      // 如果找到了用户，且不是当前用户自己，则拒绝
      if (existingUser && existingUser.id !== req.user.id) {
        return res.status(400).json({
          code: 400,
          message: '该邮箱已被其他账号绑定',
          errors: []
        });
      }
    }

    // 更新密码
    req.user.password = newPassword;

    // 更新邮箱（如果提供）
    if (email !== undefined && email !== null && email !== '') {
      req.user.email = email;
      console.log('更新用户邮箱 - 用户ID:', req.user?.id);
    }

    await req.user.save();

    // 安全日志：记录成功但不记录密码信息
    console.log('密码修改成功 - 用户ID:', req.user?.id);
    success(res, null, email ? '密码和邮箱修改成功' : '密码修改成功');
  } catch (err) {
    // 安全日志：记录错误但不暴露敏感信息
    console.error('修改密码失败 - 用户ID:', req.user?.id, '错误:', err.message);
    error(res, '修改密码失败，请稍后重试', 500);
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
 * 发送邮箱验证码
 * POST /api/auth/send-verification-code
 */
router.post('/send-verification-code', verificationCodeLimiter, async (req, res) => {
  try {
    const { email, projectId } = req.body;

    // 验证邮箱格式
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || !emailRegex.test(email)) {
      return error(res, '请输入有效的邮箱地址', 400);
    }

    if (!projectId) {
      return error(res, '缺少项目信息', 400);
    }

    // 检查邮件服务是否可用
    if (!emailService.isAvailable()) {
      await emailService.initialize();
      if (!emailService.isAvailable()) {
        return error(res, '邮件服务暂不可用，请使用密码登录', 503);
      }
    }

    // 检查是否可以发送（防止频繁发送）
    const identifier = `${projectId}:${email}`;
    const canSendResult = await verificationCodeManager.canSend(identifier);
    if (!canSendResult.allowed) {
      return res.status(429).json({
        code: 429,
        message: canSendResult.message,
        remainingSeconds: canSendResult.remainingSeconds
      });
    }

    // 验证该邮箱是否绑定了用户
    const dbManager = require('../lib/DatabaseManager');
    if (!dbManager.projectDbExists(projectId)) {
      return error(res, '项目不存在', 404);
    }

    const projectModels = await dbManager.getProjectModels(projectId);
    const { User } = projectModels;

    const user = await User.findOne({ where: { email } });
    if (!user) {
      return error(res, '该邮箱未绑定账号', 404);
    }

    // 生成验证码
    const code = verificationCodeManager.generateCode();

    // 发送邮件
    await emailService.sendVerificationCode(email, code);

    // 存储验证码
    await verificationCodeManager.store(identifier, code);

    success(res, {
      message: '验证码已发送到您的邮箱',
      expiryMinutes: 5
    });
  } catch (err) {
    console.error('发送验证码错误:', err);
    error(res, '发送验证码失败：' + err.message, 500);
  }
});

/**
 * 邮箱验证码登录
 * POST /api/auth/login-with-code
 */
router.post('/login-with-code', codeLoginLimiter, async (req, res) => {
  try {
    const { email, code, projectId } = req.body;

    console.log('[验证码登录] 请求参数:', { email, code: code ? '******' : undefined, projectId });

    // 验证必填字段
    if (!email || !code) {
      console.log('[验证码登录] 缺少必填字段');
      return error(res, '请输入邮箱和验证码', 400);
    }

    if (!projectId) {
      console.log('[验证码登录] 缺少项目信息');
      return error(res, '缺少项目信息', 400);
    }

    // 验证验证码
    const identifier = `${projectId}:${email}`;
    const verifyResult = await verificationCodeManager.verify(identifier, code);
    console.log('[验证码登录] 验证码验证结果:', verifyResult);

    if (!verifyResult.valid) {
      console.log('[验证码登录] 验证码无效:', verifyResult.message);
      return res.status(400).json({
        code: 400,
        message: verifyResult.message,
        remainingAttempts: verifyResult.remainingAttempts
      });
    }

    // 查询用户
    const dbManager = require('../lib/DatabaseManager');
    if (!dbManager.projectDbExists(projectId)) {
      console.log('[验证码登录] 项目不存在:', projectId);
      return error(res, '项目不存在', 404);
    }

    const projectModels = await dbManager.getProjectModels(projectId);
    const { User } = projectModels;

    const user = await User.findOne({ where: { email } });
    console.log('[验证码登录] 用户查询结果:', user ? `找到用户 ${user.id}` : '未找到用户');

    if (!user) {
      console.log('[验证码登录] 用户不存在:', email);
      return error(res, '用户不存在', 404);
    }

    // 生成 token
    const token = generateToken({ ...user.toJSON(), projectId });

    console.log('[验证码登录] 登录成功:', user.id);
    success(res, {
      token,
      user: { ...user.toSafeObject(), projectId }
    }, '登录成功');
  } catch (err) {
    console.error('[验证码登录] 错误:', err);
    error(res, '登录失败，请稍后重试', 500);
  }
});

module.exports = router;
