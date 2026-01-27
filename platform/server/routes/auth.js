const express = require('express');
const router = express.Router();
const { PlatformUser, PlatformConfig } = require('../models');
const { generateToken } = require('../middleware/auth');

/**
 * 用户注册
 * POST /api/auth/register
 */
router.post('/register', async (req, res) => {
  try {
    const { email, password, name } = req.body;

    if (!email || !password || !name) {
      return res.status(400).json({ code: 400, message: '邮箱、密码和姓名不能为空' });
    }

    // 检查邮箱域名限制
    const allowedDomains = await PlatformConfig.getValue('allowed_email_domains');
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
    const defaultMaxProjects = await PlatformConfig.getValue('default_max_projects', '3');
    const user = await PlatformUser.create({
      email,
      password,
      name,
      maxProjects: parseInt(defaultMaxProjects)
    });

    // 生成token
    const token = generateToken(user.id);

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
 * 用户登录
 * POST /api/auth/login
 */
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ code: 400, message: '邮箱和密码不能为空' });
    }

    // 查找用户
    const user = await PlatformUser.findOne({ where: { email } });
    if (!user) {
      return res.status(401).json({ code: 401, message: '邮箱或密码错误' });
    }

    // 验证密码
    const isValidPassword = await user.comparePassword(password);
    if (!isValidPassword) {
      return res.status(401).json({ code: 401, message: '邮箱或密码错误' });
    }

    // 生成token
    const token = generateToken(user.id);

    res.json({
      code: 200,
      message: '登录成功',
      data: {
        token,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          maxProjects: user.maxProjects,
          isSuperAdmin: user.isSuperAdmin
        }
      }
    });
  } catch (error) {
    console.error('登录错误:', error);
    res.status(500).json({ code: 500, message: '登录失败' });
  }
});

/**
 * 获取当前用户信息
 * GET /api/auth/me
 */
router.get('/me', require('../middleware/auth').authenticate, async (req, res) => {
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

module.exports = router;
