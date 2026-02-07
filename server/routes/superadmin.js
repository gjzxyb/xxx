const express = require('express');
const router = express.Router();
const { Op } = require('sequelize');
const { PlatformUser, Project, SystemConfig, Collaborator, User, Subject } = require('../models');
const { authenticatePlatform, requireSuperAdmin } = require('../middleware/platformAuth');
const { validatePagination } = require('../utils/validation');

/**
 * 获取所有用户列表
 * GET /api/platform/superadmin/users
 */
router.get('/users', authenticatePlatform, requireSuperAdmin, async (req, res) => {
  try {
    // 使用验证工具进行参数验证和边界检查
    const { page, limit } = validatePagination(req.query.page, req.query.limit);
    const offset = (page - 1) * limit;
    const search = req.query.search || '';

    const where = {};
    if (search) {
      where[Op.or] = [
        { email: { [Op.like]: `%${search}%` } },
        { name: { [Op.like]: `%${search}%` } }
      ];
    }

    const { rows: users, count: total } = await PlatformUser.findAndCountAll({
      where,
      limit,
      offset,
      order: [['createdAt', 'DESC']]
    });

    // 获取每个用户的项目数
    const usersWithProjects = await Promise.all(users.map(async (user) => {
      const projectCount = await Project.count({ where: { ownerId: user.id } });
      return {
        ...user.toJSON(),
        projectCount
      };
    }));

    res.json({
      code: 200,
      data: {
        users: usersWithProjects,
        total,
        page,
        limit,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('获取用户列表错误:', error);
    res.status(500).json({ code: 500, message: '获取用户失败' });
  }
});

/**
 * 获取系统统计信息
 * GET /api/platform/superadmin/stats
 */
router.get('/stats', authenticatePlatform, requireSuperAdmin, async (req, res) => {
  try {
    const totalUsers = await PlatformUser.count();
    const totalProjects = await Project.count();
    const activeProjects = await Project.count({ where: { status: 'running' } });

    // 计算总学生数
    const projects = await Project.findAll();
    let totalStudents = 0;
    for (const project of projects) {
      const studentCount = await User.count({ where: { projectId: project.id } });
      totalStudents += studentCount;
    }

    res.json({
      code: 200,
      data: {
        totalUsers,
        totalProjects,
        activeProjects,
        totalStudents
      }
    });
  } catch (error) {
    console.error('获取统计信息错误:', error);
    res.status(500).json({ code: 500, message: '获取统计信息失败' });
  }
});

/**
 * 获取系统配置
 * GET /api/platform/superadmin/config
 */
router.get('/config', authenticatePlatform, requireSuperAdmin, async (req, res) => {
  try {
    const configs = await SystemConfig.findAll();
    const configMap = {};
    configs.forEach(config => {
      configMap[config.key] = {
        value: config.value,
        description: config.description
      };
    });

    res.json({
      code: 200,
      data: configMap
    });
  } catch (error) {
    console.error('获取配置错误:', error);
    res.status(500).json({ code: 500, message: '获取配置失败' });
  }
});

/**
 * 更新系统配置
 * PUT /api/platform/superadmin/config
 */
router.put('/config', authenticatePlatform, requireSuperAdmin, async (req, res) => {
  try {
    const updates = req.body;

    for (const [key, data] of Object.entries(updates)) {
      await SystemConfig.setValue(key, data.value, null, data.description);
    }

    res.json({
      code: 200,
      message: '配置已更新'
    });
  } catch (error) {
    console.error('更新配置错误:', error);
    res.status(500).json({ code: 500, message: '更新配置失败' });
  }
});

/**
 * 更新用户状态（启用/禁用）
 * PUT /api/platform/superadmin/users/:userId/status
 */
router.put('/users/:userId/status', authenticatePlatform, requireSuperAdmin, async (req, res) => {
  try {
    const { userId } = req.params;
    const { isDisabled } = req.body;

    const user = await PlatformUser.findByPk(userId);
    if (!user) {
      return res.status(404).json({ code: 404, message: '用户不存在' });
    }

    // 不允许禁用自己
    if (user.id === req.user.id) {
      return res.status(400).json({ code: 400, message: '不能禁用自己的账号' });
    }

    await user.update({ isDisabled });

    res.json({
      code: 200,
      message: isDisabled ? '用户已禁用' : '用户已启用'
    });
  } catch (error) {
    console.error('更新用户状态错误:', error);
    res.status(500).json({ code: 500, message: '更新用户状态失败' });
  }
});

/**
 * 编辑用户信息
 * PUT /api/platform/superadmin/users/:userId
 */
router.put('/users/:userId', authenticatePlatform, requireSuperAdmin, async (req, res) => {
  try {
    const { userId } = req.params;
    const { email, name, maxProjects, password } = req.body;

    const user = await PlatformUser.findByPk(userId);
    if (!user) {
      return res.status(404).json({ code: 404, message: '用户不存在' });
    }

    // 不允许修改超级管理员的邮箱和姓名（除非是自己）
    if (user.isSuperAdmin && user.id !== req.user.id) {
      return res.status(403).json({ code: 403, message: '不能修改其他超级管理员的信息' });
    }

    // 检查邮箱是否已被其他用户使用
    if (email && email !== user.email) {
      const { Op } = require('sequelize');
      const existingUser = await PlatformUser.findOne({
        where: {
          email,
          id: { [Op.ne]: userId }
        }
      });
      if (existingUser) {
        return res.status(400).json({ code: 400, message: '该邮箱已被使用' });
      }
    }

    // 准备更新数据
    const updateData = {};
    if (email) updateData.email = email;
    if (name) updateData.name = name;
    if (maxProjects !== undefined) updateData.maxProjects = parseInt(maxProjects);
    if (password && password.trim()) {
      // 如果提供了密码，则更新密码
      updateData.password = password;
    }

    await user.update(updateData);

    res.json({
      code: 200,
      message: '用户信息已更新'
    });
  } catch (error) {
    console.error('编辑用户错误:', error);
    res.status(500).json({ code: 500, message: '编辑用户失败' });
  }
});


/**
 * 更新用户项目限制
 * PUT /api/platform/superadmin/users/:userId/projects
 */
router.put('/users/:userId/projects', authenticatePlatform, requireSuperAdmin, async (req, res) => {
  try {
    const { userId } = req.params;
    const { maxProjects } = req.body;

    if (!maxProjects || maxProjects < 0) {
      return res.status(400).json({ code: 400, message: '无效的项目数限制' });
    }

    const user = await PlatformUser.findByPk(userId);
    if (!user) {
      return res.status(404).json({ code: 404, message: '用户不存在' });
    }

    await user.update({ maxProjects });

    res.json({
      code: 200,
      message: '项目限制已更新'
    });
  } catch (error) {
    console.error('更新项目限制错误:', error);
    res.status(500).json({ code: 500, message: '更新项目限制失败' });
  }
});

/**
 * 删除用户
 * DELETE /api/platform/superadmin/users/:userId
 */
router.delete('/users/:userId', authenticatePlatform, requireSuperAdmin, async (req, res) => {
  try {
    const { userId } = req.params;

    const user = await PlatformUser.findByPk(userId);
    if (!user) {
      return res.status(404).json({ code: 404, message: '用户不存在' });
    }

    // 不允许删除自己
    if (user.id === req.user.id) {
      return res.status(400).json({ code: 400, message: '不能删除自己的账号' });
    }

    // 删除用户的所有项目和相关数据
    const projects = await Project.findAll({ where: { ownerId: userId } });
    for (const project of projects) {
      // 删除项目中的学生
      await User.destroy({ where: { projectId: project.id } });
      // 删除项目中的科目
      await Subject.destroy({ where: { projectId: project.id } });
      // 删除协作者
      await Collaborator.destroy({ where: { projectId: project.id } });
      // 删除项目
      await project.destroy();
    }

    // 删除用户作为协作者的记录
    await Collaborator.destroy({ where: { userId } });

    // 删除用户
    await user.destroy();

    res.json({
      code: 200,
      message: '用户已删除',
      data: {
        deletedProjects: projects.length
      }
    });
  } catch (error) {
    console.error('删除用户错误:', error);
    res.status(500).json({ code: 500, message: '删除用户失败' });
  }
});

/**
 * 添加平台用户（协作管理员）
 * POST /api/platform/superadmin/users
 */
router.post('/users', authenticatePlatform, requireSuperAdmin, async (req, res) => {
  try {
    const { email, name, password, role } = req.body;

    if (!email || !name || !password) {
      return res.status(400).json({ code: 400, message: '请填写必要信息' });
    }

    // 验证邮箱格式
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ code: 400, message: '邮箱格式不正确' });
    }

    // 验证密码长度
    if (password.length < 6) {
      return res.status(400).json({ code: 400, message: '密码至少6位' });
    }

    // 检查邮箱是否已存在
    const existing = await PlatformUser.findOne({ where: { email } });
    if (existing) {
      return res.status(400).json({ code: 400, message: '该邮箱已被使用' });
    }

    // 创建用户
    const user = await PlatformUser.create({
      email,
      name,
      password,
      isSuperAdmin: role === 'superadmin',
      maxProjects: role === 'superadmin' ? 999 : 5
    });

    res.json({
      code: 200,
      message: '管理员创建成功',
      data: {
        id: user.id,
        email: user.email,
        name: user.name,
        isSuperAdmin: user.isSuperAdmin
      }
    });
  } catch (error) {
    console.error('创建管理员错误:', error);
    res.status(500).json({ code: 500, message: '创建失败' });
  }
});

/**
 * 获取所有项目列表
 * GET /api/platform/superadmin/projects
 */
router.get('/projects', authenticatePlatform, requireSuperAdmin, async (req, res) => {
  try {
    const projects = await Project.findAll({
      order: [['createdAt', 'DESC']],
      include: [{
        model: PlatformUser,
        as: 'owner',
        attributes: ['id', 'email', 'name']
      }]
    });

    // 为每个项目添加所有者邮箱
    const projectsData = projects.map(p => ({
      id: p.id,
      name: p.name,
      description: p.description,
      status: p.status,
      registrationEnabled: p.registrationEnabled,
      ownerEmail: p.owner ? p.owner.email : '-',
      createdAt: p.createdAt
    }));

    res.json({
      code: 200,
      data: projectsData  // 直接返回数组，与前端期望一致
    });
  } catch (error) {
    console.error('获取项目列表错误:', error);
    res.status(500).json({ code: 500, message: '获取项目失败' });
  }
});

/**
 * 删除项目
 * DELETE /api/platform/superadmin/projects/:projectId
 */
router.delete('/projects/:projectId', authenticatePlatform, requireSuperAdmin, async (req, res) => {
  try {
    const { projectId } = req.params;

    const project = await Project.findByPk(projectId);
    if (!project) {
      return res.status(404).json({ code: 404, message: '项目不存在' });
    }

    // 删除项目数据库文件
    const dbManager = require('../lib/DatabaseManager');
    if (dbManager.projectDbExists(projectId)) {
      await dbManager.deleteProjectDatabase(projectId);
    }

    // 删除协作者记录
    await Collaborator.destroy({ where: { projectId } });

    // 删除项目记录
    await project.destroy();

    res.json({
      code: 200,
      message: '项目已删除'
    });
  } catch (error) {
    console.error('删除项目错误:', error);
    res.status(500).json({ code: 500, message: '删除项目失败' });
  }
});

module.exports = router;
