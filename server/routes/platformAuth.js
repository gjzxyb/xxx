const express = require('express');
const router = express.Router();
const { PlatformUser, SystemConfig } = require('../models');
const { generatePlatformToken } = require('../middleware/platformAuth');
const { validatePasswordMiddleware, getPasswordPolicy } = require('../middleware/passwordPolicy');
const loginAttemptTracker = require('../lib/LoginAttemptTracker');
const tokenBlacklist = require('../lib/TokenBlacklist');
const jwt = require('jsonwebtoken');

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

    // 安全性：检查账号是否被锁定
    const lockIdentifier = `platform:${email}`;
    const locked = loginAttemptTracker.isLocked(lockIdentifier);
    if (locked) {
      return res.status(423).json({
        code: 423,
        message: locked.message,
        lockedUntil: locked.lockedUntil
      });
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

module.exports = router;
