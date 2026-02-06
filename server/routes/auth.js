const express = require('express');
const router = express.Router();
const { User } = require('../models');
const { success, error } = require('../utils/response');
const { authenticate, generateToken } = require('../middleware/auth');

/**
 * 用户登录
 * POST /api/auth/login
 */
router.post('/login', async (req, res) => {
  try {
    const { studentId, password, projectId } = req.body;

    if (!studentId || !password) {
      return error(res, '请输入学号和密码');
    }

    if (!projectId) {
      return error(res, '缺少项目信息', 400);
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
      return error(res, '学号或密码错误');
    }

    const isValid = await user.validatePassword(password);
    if (!isValid) {
      return error(res, '学号或密码错误');
    }

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
router.post('/register', async (req, res) => {
  try {
    // 检查注册是否开放（默认关闭）
    const { SystemConfig } = require('../models');
    const registrationEnabled = await SystemConfig.getValue('registration_enabled', 'false');
    if (registrationEnabled !== 'true') {
      return error(res, '注册功能已关闭，请联系管理员', 403);
    }

    const { studentId, name, password, className, phone } = req.body;

    if (!studentId || !name || !password) {
      return error(res, '请填写必要信息（学号、姓名、密码）');
    }

    // 检查学号是否已存在
    const existing = await User.findOne({ where: { studentId } });
    if (existing) {
      return error(res, '该学号已被注册');
    }

    const user = await User.create({
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
 */
router.put('/password', authenticate, async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body;

    if (!oldPassword || !newPassword) {
      return error(res, '请输入原密码和新密码');
    }

    const isValid = await req.user.validatePassword(oldPassword);
    if (!isValid) {
      return error(res, '原密码错误');
    }

    req.user.password = newPassword;
    await req.user.save();

    success(res, null, '密码修改成功');
  } catch (err) {
    console.error('修改密码错误:', err);
    error(res, '修改密码失败', 500);
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
module.exports = router;
