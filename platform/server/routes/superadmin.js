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
      attributes: ['id', 'email', 'name', 'maxProjects', 'subscriptionTier', 'createdAt'],
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

module.exports = router;
