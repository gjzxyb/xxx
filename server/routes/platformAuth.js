const express = require('express');
const router = express.Router();
const { PlatformUser, SystemConfig } = require('../models');
const { generatePlatformToken } = require('../middleware/platformAuth');
const { validatePasswordMiddleware, getPasswordPolicy } = require('../middleware/passwordPolicy');
const loginAttemptTracker = require('../lib/LoginAttemptTracker');

// 临时调试路由 - 登录锁定管理（仅开发环境）
if (process.env.NODE_ENV !== 'production') {
  // 查看当前锁定状态
  router.get('/debug/lock-status', (req, res) => {
    const locks = [];
    const now = Date.now();

    for (const [identifier, record] of loginAttemptTracker.attempts.entries()) {
      const isLocked = record.lockedUntil && now < record.lockedUntil;
      locks.push({
        identifier,
        attempts: record.attempts,
        locked: isLocked,
        lockedUntil: record.lockedUntil ? new Date(record.lockedUntil).toLocaleString() : null,
        remainingTime: record.lockedUntil ? Math.ceil((record.lockedUntil - now) / 1000) : 0
      });
    }

    res.json({
      code: 200,
      totalRecords: loginAttemptTracker.attempts.size,
      locks: locks
    });
  });

  // 清除所有锁定
  router.post('/debug/clear-locks', (req, res) => {
    const sizeBefore = loginAttemptTracker.attempts.size;
    loginAttemptTracker.attempts.clear();
    res.json({
      code: 200,
      message: `已清除 ${sizeBefore} 条锁定记录`,
      cleared: sizeBefore
    });
  });

  // 解锁特定账户
  router.post('/debug/unlock-account', (req, res) => {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ code: 400, message: '请提供邮箱地址' });
    }

    const identifier = `platform:${email}`;
    const existed = loginAttemptTracker.attempts.has(identifier);
    loginAttemptTracker.attempts.delete(identifier);

    res.json({
      code: 200,
      message: existed ? `已解锁账户: ${email}` : `账户未被锁定: ${email}`,
      unlocked: existed
    });
  });
}
const tokenBlacklist = require('../lib/TokenBlacklist');
const jwt = require('jsonwebtoken');

// 复用项目系统的邮件和验证码模块（避免代码重复）
const emailService = require('../utils/emailService');
const verificationCodeManager = require('../lib/VerificationCodeManager');

// 验证码存储（简单内存存储）
// ⚠️  警告：此实现不支持多实例部署
// 生产环境建议：
// 1. 使用 Redis 或其他分布式缓存存储验证码
// 2. 设置合理的过期时间和清理策略
// 3. 考虑使用更复杂的验证码类型（图片验证码等）
const captchaStore = new Map();

// 生成数学验证码
function generateMathCaptcha() {
  const a = Math.floor(Math.random() * 10) + 1;
  const b = Math.floor(Math.random() * 10) + 1;
  const operators = ['+', '-'];
  const op = operators[Math.floor(Math.random() * operators.length)];

  let answer;
  let question;

  if (op === '+') {
    answer = a + b;
    question = `${a} + ${b} = ?`;
  } else {
    // 确保结果不为负数
    const max = Math.max(a, b);
    const min = Math.min(a, b);
    answer = max - min;
    question = `${max} - ${min} = ?`;
  }

  return { question, answer: answer.toString() };
}

/**
 * 获取注册状态
 * GET /api/platform/auth/registration-status
 */
router.get('/registration-status', async (req, res) => {
  try {
    const registrationOpen = await SystemConfig.getValue('registration_open', null, 'true');
    const captchaEnabled = await SystemConfig.getValue('captcha_enabled', null, 'false');

    res.json({
      code: 200,
      data: {
        registrationOpen: registrationOpen === 'true',
        captchaEnabled: captchaEnabled === 'true'
      }
    });
  } catch (error) {
    console.error('获取注册状态错误:', error);
    res.status(500).json({ code: 500, message: '获取注册状态失败' });
  }
});

/**
 * 获取验证码
 * GET /api/platform/auth/captcha
 */
router.get('/captcha', async (req, res) => {
  try {
    const captcha = generateMathCaptcha();
    const captchaId = require('crypto').randomBytes(16).toString('hex');

    // 存储验证码，5分钟后过期
    captchaStore.set(captchaId, {
      answer: captcha.answer,
      expires: Date.now() + 5 * 60 * 1000
    });

    // 清理过期验证码
    for (const [id, data] of captchaStore.entries()) {
      if (data.expires < Date.now()) {
        captchaStore.delete(id);
      }
    }

    res.json({
      code: 200,
      data: {
        captchaId,
        question: captcha.question
      }
    });
  } catch (error) {
    console.error('生成验证码错误:', error);
    res.status(500).json({ code: 500, message: '生成验证码失败' });
  }
});

/**
 * 平台用户登录
 * POST /api/platform/auth/login
 * 安全性：添加登录失败锁定机制
 */
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ code: 400, message: '邮箱和密码不能为空' });
    }

    // 安全性：检查账号是否被锁定（开发环境可选）
    const lockIdentifier = `platform:${email}`;

    // 开发环境：跳过锁定检查（方便调试）
    if (process.env.NODE_ENV !== 'production') {
      console.log(`🔓 开发环境：跳过登录锁定检查 (${email})`);
    } else {
      const locked = await loginAttemptTracker.isLocked(lockIdentifier);
      if (locked) {
        return res.status(423).json({
          code: 423,
          message: locked.message,
          lockedUntil: locked.lockedUntil
        });
      }
    }

    // 查找用户
    const user = await PlatformUser.findOne({ where: { email } });
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

    // 验证密码
    const isValid = await user.comparePassword(password);
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

    // 生成token
    const token = generatePlatformToken(user);

    res.json({
      code: 200,
      message: '登录成功',
      data: {
        token,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          isSuperAdmin: user.isSuperAdmin,
          maxProjects: user.maxProjects
        }
      }
    });
  } catch (error) {
    console.error('平台用户登录错误:', error.message);
    res.status(500).json({ code: 500, message: '登录失败' });
  }
});

/**
 * 平台用户注册
 * POST /api/platform/auth/register
 */
router.post('/register', validatePasswordMiddleware, async (req, res) => {
  try {
    const { email, password, name, captchaId, captchaAnswer } = req.body;

    if (!email || !password || !name) {
      return res.status(400).json({ code: 400, message: '邮箱、密码和姓名不能为空' });
    }

    // 检查注册是否开放
    const registrationOpen = await SystemConfig.getValue('registration_open', null, 'true');
    if (registrationOpen !== 'true') {
      return res.status(403).json({ code: 403, message: '注册已关闭' });
    }

    // 检查验证码
    const captchaEnabled = await SystemConfig.getValue('captcha_enabled', null, 'false');
    if (captchaEnabled === 'true') {
      if (!captchaId || !captchaAnswer) {
        return res.status(400).json({ code: 400, message: '请输入验证码' });
      }

      const captchaData = captchaStore.get(captchaId);
      if (!captchaData) {
        return res.status(400).json({ code: 400, message: '验证码已过期，请刷新' });
      }

      if (captchaData.expires < Date.now()) {
        captchaStore.delete(captchaId);
        return res.status(400).json({ code: 400, message: '验证码已过期，请刷新' });
      }

      if (captchaData.answer !== captchaAnswer.toString().trim()) {
        return res.status(400).json({ code: 400, message: '验证码错误' });
      }

      // 验证成功后删除验证码
      captchaStore.delete(captchaId);
    }

    // 检查邮箱域名限制
    const allowedDomains = await SystemConfig.getValue('allowed_email_domains', null);
    if (allowedDomains) {
      const domains = allowedDomains.split(',').map(d => d.trim());
      const emailDomain = email.split('@')[1];
      if (!domains.includes(emailDomain)) {
        return res.status(403).json({ code: 403, message: '该邮箱域名不允许注册' });
      }
    }

    // 检查邮箱是否已存在
    const existingUser = await PlatformUser.findOne({ where: { email } });
    if (existingUser) {
      return res.status(400).json({ code: 400, message: '该邮箱已被注册' });
    }

    // 创建用户
    const defaultMaxProjects = await SystemConfig.getValue('default_max_projects', null, '3');
    const user = await PlatformUser.create({
      email,
      password,
      name,
      maxProjects: parseInt(defaultMaxProjects)
    });

    // 生成token
    const token = generatePlatformToken(user.id);

    res.json({
      code: 200,
      message: '注册成功',
      data: {
        token,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          maxProjects: user.maxProjects
        }
      }
    });
  } catch (error) {
    console.error('注册错误:', error);
    res.status(500).json({ code: 500, message: '注册失败' });
  }
});

/**
 * 获取当前平台用户信息
 * GET /api/platform/auth/me
 */
router.get('/me', require('../middleware/platformAuth').authenticatePlatform, async (req, res) => {
  res.json({
    code: 200,
    data: {
      id: req.user.id,
      email: req.user.email,
      name: req.user.name,
      maxProjects: req.user.maxProjects,
      isSuperAdmin: req.user.isSuperAdmin
    }
  });
});

/**
 * 发送邮箱验证码
 * POST /api/platform/auth/send-verification-code
 */
router.post('/send-verification-code', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ code: 400, message: '邮箱不能为空' });
    }

    // 检查邮箱格式
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ code: 400, message: '邮箱格式不正确' });
    }

    // 检查用户是否存在
    const user = await PlatformUser.findOne({ where: { email } });
    if (!user) {
      return res.status(404).json({ code: 404, message: '该邮箱未注册' });
    }

    // 检查是否可以发送（防止频繁发送）
    const identifier = `platform:${email}`;
    const canSend = await verificationCodeManager.canSend(identifier);
    if (!canSend.allowed) {
      return res.status(429).json({
        code: 429,
        message: canSend.message,
        remainingSeconds: canSend.remainingSeconds
      });
    }

    // 检查邮件服务是否可用
    if (!emailService.isAvailable()) {
      // 尝试初始化
      await emailService.initialize();
      if (!emailService.isAvailable()) {
        return res.status(503).json({
          code: 503,
          message: '邮件服务暂不可用，请使用密码登录'
        });
      }
    }

    // 生成验证码
    const code = verificationCodeManager.generateCode();

    // 发送邮件
    await emailService.sendVerificationCode(email, code);

    // 存储验证码
    await verificationCodeManager.store(identifier, code);

    res.json({
      code: 200,
      message: '验证码已发送，请查收邮件',
      data: {
        expiryMinutes: verificationCodeManager.expiryMinutes
      }
    });
  } catch (error) {
    console.error('发送验证码错误:', error);
    res.status(500).json({
      code: 500,
      message: error.message || '发送验证码失败，请稍后重试'
    });
  }
});

/**
 * 使用验证码登录
 * POST /api/platform/auth/login-with-code
 */
router.post('/login-with-code', async (req, res) => {
  try {
    const { email, code } = req.body;

    console.log('[平台验证码登录] 请求参数:', { email, code: code ? '******' : undefined });

    if (!email || !code) {
      return res.status(400).json({ code: 400, message: '邮箱和验证码不能为空' });
    }

    // 验证验证码
    const identifier = `platform:${email}`;
    console.log('[平台验证码登录] 使用标识符:', identifier);

    const result = await verificationCodeManager.verify(identifier, code);
    console.log('[平台验证码登录] 验证结果:', result);

    if (!result.valid) {
      console.log('[平台验证码登录] 验证码无效:', result.message);
      return res.status(400).json({
        code: 400,
        message: result.message,
        remainingAttempts: result.remainingAttempts
      });
    }

    // 查找用户
    const user = await PlatformUser.findOne({ where: { email } });
    console.log('[平台验证码登录] 用户查询结果:', user ? `找到用户 ${user.id}` : '未找到用户');

    if (!user) {
      return res.status(404).json({ code: 404, message: '用户不存在' });
    }

    // 生成token
    const token = generatePlatformToken(user);

    console.log('[平台验证码登录] 登录成功:', user.id);
    res.json({
      code: 200,
      message: '登录成功',
      data: {
        token,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          isSuperAdmin: user.isSuperAdmin,
          maxProjects: user.maxProjects
        }
      }
    });
  } catch (error) {
    console.error('[平台验证码登录] 错误:', error);
    res.status(500).json({ code: 500, message: '登录失败' });
  }
});

/**
 * 平台用户登出
 * POST /api/platform/auth/logout
 * 安全性：将token加入黑名单，实现即时失效
 */
router.post('/logout', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      const decoded = jwt.decode(token);

      if (decoded && decoded.exp) {
        tokenBlacklist.add(token, decoded.exp * 1000);
      }
    }

    res.json({ code: 200, message: '登出成功' });
  } catch (error) {
    console.error('登出错误:', error.message);
    res.status(500).json({ code: 500, message: '登出失败' });
  }
});

// ===========================
// 用户账号管理 API
// ===========================

// 修改邮箱
router.put('/user/email', require('../middleware/platformAuth').authenticatePlatform, async (req, res) => {
  try {
    const { newEmail, password } = req.body;
    const userId = req.user.id;

    // 验证必填字段
    if (!newEmail || !password) {
      return res.status(400).json({
        code: 400,
        message: '请提供新邮箱和当前密码'
      });
    }

    // 验证邮箱格式
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(newEmail)) {
      return res.status(400).json({
        code: 400,
        message: '邮箱格式不正确'
      });
    }

    // 查找当前用户
    const user = await PlatformUser.findByPk(userId);
    if (!user) {
      return res.status(404).json({
        code: 404,
        message: '用户不存在'
      });
    }

    // 验证当前密码
    const bcrypt = require('bcryptjs');
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({
        code: 401,
        message: '当前密码不正确'
      });
    }

    // 检查新邮箱是否已被使用
    const existingUser = await PlatformUser.findOne({ where: { email: newEmail } });
    if (existingUser && existingUser.id !== userId) {
      return res.status(409).json({
        code: 409,
        message: '该邮箱已被其他用户使用'
      });
    }

    // 更新邮箱
    await user.update({ email: newEmail });

    res.json({
      code: 200,
      message: '邮箱修改成功',
      data: { email: newEmail }
    });

  } catch (error) {
    console.error('修改邮箱失败:', error);
    res.status(500).json({
      code: 500,
      message: '修改邮箱失败，请稍后重试'
    });
  }
});

// 修改密码
router.put('/user/password', require('../middleware/platformAuth').authenticatePlatform, async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body;
    const userId = req.user.id;

    // 验证必填字段
    if (!oldPassword || !newPassword) {
      return res.status(400).json({
        code: 400,
        message: '请提供当前密码和新密码'
      });
    }

    // 验证新密码强度
    if (newPassword.length < 8 || newPassword.length > 32) {
      return res.status(400).json({
        code: 400,
        message: '密码长度必须在8-32个字符之间'
      });
    }

    // 查找当前用户
    const user = await PlatformUser.findByPk(userId);
    if (!user) {
      return res.status(404).json({
        code: 404,
        message: '用户不存在'
      });
    }

    // 验证当前密码
    const bcrypt = require('bcryptjs');
    const isPasswordValid = await bcrypt.compare(oldPassword, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({
        code: 401,
        message: '当前密码不正确'
      });
    }

    // 检查新密码是否与旧密码相同
    const isSamePassword = await bcrypt.compare(newPassword, user.password);
    if (isSamePassword) {
      return res.status(400).json({
        code: 400,
        message: '新密码不能与当前密码相同'
      });
    }

    // 更新密码（模型的 beforeUpdate hook 会自动哈希）
    await user.update({ password: newPassword });

    res.json({
      code: 200,
      message: '密码修改成功，请重新登录'
    });

  } catch (error) {
    console.error('修改密码失败:', error);
    res.status(500).json({
      code: 500,
      message: '修改密码失败，请稍后重试'
    });
  }
});

module.exports = router;
