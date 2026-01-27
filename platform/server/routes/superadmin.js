const express = require('express');
const router = express.Router();
const { PlatformUser, Project, PlatformConfig } = require('../models');
const { authenticate, requireSuperAdmin } = require('../middleware/auth');

/**
 * 获取所有用户
 * GET /api/superadmin/users
 */
router.get('/users', authenticate, requireSuperAdmin, async (req, res) => {
  try {
    const users = await PlatformUser.findAll({
      attributes: ['id', 'email', 'name', 'maxProjects', 'subscriptionTier', 'isSuperAdmin', 'isDisabled', 'createdAt'],
      order: [['createdAt', 'DESC']]
    });

    // 获取每个用户的项目数量
    const usersWithProjectCount = await Promise.all(
      users.map(async (user) => {
        const projectCount = await Project.count({
          where: { ownerId: user.id }
        });
        return {
          ...user.toJSON(),
          projectCount
        };
      })
    );

    res.json({
      code: 200,
      data: usersWithProjectCount
    });
  } catch (error) {
    console.error('获取用户列表错误:', error);
    res.status(500).json({ code: 500, message: '获取用户列表失败' });
  }
});

/**
 * 更新用户项目限额
 * PUT /api/superadmin/users/:userId/max-projects
 */
router.put('/users/:userId/max-projects', authenticate, requireSuperAdmin, async (req, res) => {
  try {
    const { maxProjects } = req.body;

    if (!maxProjects || maxProjects < 0) {
      return res.status(400).json({ code: 400, message: '项目限额必须大于等于0' });
    }

    const user = await PlatformUser.findByPk(req.params.userId);
    if (!user) {
      return res.status(404).json({ code: 404, message: '用户不存在' });
    }

    await user.update({ maxProjects });

    res.json({
      code: 200,
      message: '项目限额更新成功',
      data: user
    });
  } catch (error) {
    console.error('更新项目限额错误:', error);
    res.status(500).json({ code: 500, message: '更新项目限额失败' });
  }
});

/**
 * 获取平台配置
 * GET /api/superadmin/config
 */
router.get('/config', authenticate, requireSuperAdmin, async (req, res) => {
  try {
    const configs = await PlatformConfig.findAll();
    res.json({
      code: 200,
      data: configs
    });
  } catch (error) {
    console.error('获取配置错误:', error);
    res.status(500).json({ code: 500, message: '获取配置失败' });
  }
});

/**
 * 更新平台配置
 * PUT /api/superadmin/config
 */
router.put('/config', authenticate, requireSuperAdmin, async (req, res) => {
  try {
    const { key, value, description } = req.body;

    if (!key) {
      return res.status(400).json({ code: 400, message: '配置键不能为空' });
    }

    const config = await PlatformConfig.setValue(key, value, description);

    res.json({
      code: 200,
      message: '配置更新成功',
      data: config
    });
  } catch (error) {
    console.error('更新配置错误:', error);
    res.status(500).json({ code: 500, message: '更新配置失败' });
  }
});

/**
 * 获取平台统计
 * GET /api/superadmin/stats
 */
router.get('/stats', authenticate, requireSuperAdmin, async (req, res) => {
  try {
    const totalUsers = await PlatformUser.count();
    const totalProjects = await Project.count();

    const recentUsers = await PlatformUser.count({
      where: {
        createdAt: {
          [require('sequelize').Op.gte]: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
        }
      }
    });

    const recentProjects = await Project.count({
      where: {
        createdAt: {
          [require('sequelize').Op.gte]: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
        }
      }
    });

    res.json({
      code: 200,
      data: {
        totalUsers,
        totalProjects,
        recentUsers, // 最近7天
        recentProjects // 最近7天
      }
    });
  } catch (error) {
    console.error('获取统计数据错误:', error);
    res.status(500).json({ code: 500, message: '获取统计数据失败' });
  }
});

/**
 * 获取所有项目列表（含注册开关状态）
 * GET /api/superadmin/projects
 */
router.get('/projects', authenticate, requireSuperAdmin, async (req, res) => {
  try {
    const { getProjectDb } = require('../config/database');

    const projects = await Project.findAll({
      order: [['createdAt', 'DESC']]
    });

    const projectsWithSettings = await Promise.all(projects.map(async (project) => {
      const owner = await PlatformUser.findByPk(project.ownerId);

      // 尝试获取项目的注册设置
      let registrationEnabled = false;
      try {
        const projectDb = getProjectDb(project.id);
        const [results] = await projectDb.query(
          "SELECT value FROM system_config WHERE key = 'registration_enabled'"
        );
        registrationEnabled = results[0]?.value === 'true';
      } catch (e) {
        // 项目数据库可能不存在
      }

      return {
        id: project.id,
        name: project.name,
        status: project.status,
        ownerEmail: owner?.email,
        registrationEnabled
      };
    }));

    res.json({
      code: 200,
      data: projectsWithSettings
    });
  } catch (error) {
    console.error('获取项目列表错误:', error);
    res.status(500).json({ code: 500, message: '获取项目列表失败' });
  }
});

/**
 * 编辑用户信息
 * PUT /api/superadmin/users/:userId
 */
router.put('/users/:userId', authenticate, requireSuperAdmin, async (req, res) => {
  try {
    const { name, email, maxProjects } = req.body;
    const user = await PlatformUser.findByPk(req.params.userId);

    if (!user) {
      return res.status(404).json({ code: 404, message: '用户不存在' });
    }

    // 检查邮箱是否已被其他用户使用
    if (email && email !== user.email) {
      const existingUser = await PlatformUser.findOne({ where: { email } });
      if (existingUser) {
        return res.status(400).json({ code: 400, message: '该邮箱已被使用' });
      }
    }

    const updateData = {};
    if (name) updateData.name = name;
    if (email) updateData.email = email;
    if (maxProjects !== undefined) updateData.maxProjects = maxProjects;

    await user.update(updateData);

    res.json({
      code: 200,
      message: '用户信息更新成功',
      data: user
    });
  } catch (error) {
    console.error('编辑用户错误:', error);
    res.status(500).json({ code: 500, message: '编辑用户失败' });
  }
});

/**
 * 禁用/启用用户
 * PUT /api/superadmin/users/:userId/status
 */
router.put('/users/:userId/status', authenticate, requireSuperAdmin, async (req, res) => {
  try {
    const { isDisabled } = req.body;
    const user = await PlatformUser.findByPk(req.params.userId);

    if (!user) {
      return res.status(404).json({ code: 404, message: '用户不存在' });
    }

    // 不能禁用超级管理员
    if (user.isSuperAdmin) {
      return res.status(403).json({ code: 403, message: '不能禁用超级管理员' });
    }

    await user.update({ isDisabled });

    res.json({
      code: 200,
      message: isDisabled ? '用户已禁用' : '用户已启用',
      data: user
    });
  } catch (error) {
    console.error('更新用户状态错误:', error);
    res.status(500).json({ code: 500, message: '更新用户状态失败' });
  }
});

/**
 * 删除用户及其所有内容
 * DELETE /api/superadmin/users/:userId
 */
router.delete('/users/:userId', authenticate, requireSuperAdmin, async (req, res) => {
  try {
    const user = await PlatformUser.findByPk(req.params.userId);

    if (!user) {
      return res.status(404).json({ code: 404, message: '用户不存在' });
    }

    // 不能删除超级管理员
    if (user.isSuperAdmin) {
      return res.status(403).json({ code: 403, message: '不能删除超级管理员' });
    }

    const { Collaborator } = require('../models');
    const { stopProject } = require('../services/projectLauncher');
    const fs = require('fs');
    const path = require('path');

    // 1. 获取用户的所有项目
    const userProjects = await Project.findAll({
      where: { ownerId: user.id }
    });

    // 2. 停止所有正在运行的项目并删除
    for (const project of userProjects) {
      try {
        await stopProject(project.id);
      } catch (e) {
        console.log('停止项目时出错（可能未运行）:', e.message);
      }

      // 删除项目的协作者记录
      await Collaborator.destroy({
        where: { projectId: project.id }
      });

      // 删除项目数据库文件
      const dbPath = path.join(__dirname, '../databases/projects', project.dbFilename);
      if (fs.existsSync(dbPath)) {
        fs.unlinkSync(dbPath);
      }

      // 删除项目记录
      await project.destroy();
    }

    // 3. 删除用户作为协作者的记录
    await Collaborator.destroy({
      where: { userId: user.id }
    });

    // 4. 删除用户
    await user.destroy();

    res.json({
      code: 200,
      message: '用户及其所有内容已删除',
      data: {
        deletedProjects: userProjects.length
      }
    });
  } catch (error) {
    console.error('删除用户错误:', error);
    res.status(500).json({ code: 500, message: '删除用户失败' });
  }
});

module.exports = router;

