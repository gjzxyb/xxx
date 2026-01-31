const express = require('express');
const router = express.Router();
const { Project, Collaborator, PlatformUser } = require('../models');
const { authenticate } = require('../middleware/auth');
const { checkProjectAccess, requireProjectAdmin } = require('../middleware/projectAuth');
const { initializeProjectDatabase } = require('../config/database');

/**
 * 获取用户的所有项目（包括协作项目）
 * GET /api/projects
 */
router.get('/', authenticate, async (req, res) => {
  try {
    // 用户拥有的项目
    const ownedProjects = await Project.findAll({
      where: { ownerId: req.user.id },
      order: [['createdAt', 'DESC']]
    });

    // 用户协作的项目
    const collaborations = await Collaborator.findAll({
      where: { userId: req.user.id },
      include: [{
        model: Project,
        as: 'project'
      }]
    });

    const collaboratedProjects = collaborations.map(c => ({
      ...c.project.toJSON(),
      role: c.role
    }));

    res.json({
      code: 200,
      data: {
        owned: ownedProjects,
        collaborated: collaboratedProjects
      }
    });
  } catch (error) {
    console.error('获取项目列表错误:', error);
    res.status(500).json({ code: 500, message: '获取项目列表失败' });
  }
});

/**
 * 创建新项目
 * POST /api/projects
 */
router.post('/', authenticate, async (req, res) => {
  try {
    const { name, description } = req.body;

    if (!name) {
      return res.status(400).json({ code: 400, message: '项目名称不能为空' });
    }

    // 检查用户项目数量限制
    const userProjectCount = await Project.count({
      where: { ownerId: req.user.id }
    });

    if (userProjectCount >= req.user.maxProjects) {
      return res.status(403).json({
        code: 403,
        message: `已达到项目数量上限（${req.user.maxProjects}个）`
      });
    }

    // 生成UUID作为项目ID
    const { v4: uuidv4 } = require('uuid');
    const projectId = uuidv4();

    // 创建项目（直接提供dbFilename）
    const project = await Project.create({
      id: projectId,
      name,
      description,
      ownerId: req.user.id,
      dbFilename: `${projectId}.db`
    });

    // 初始化项目数据库
    await initializeProjectDatabase(project.id);

    res.json({
      code: 200,
      message: '项目创建成功',
      data: project
    });
  } catch (error) {
    console.error('创建项目错误:', error);
    res.status(500).json({ code: 500, message: '创建项目失败' });
  }
});

/**
 * 获取项目详情
 * GET /api/projects/:projectId
 */
router.get('/:projectId', authenticate, checkProjectAccess, async (req, res) => {
  try {
    const project = await Project.findByPk(req.params.projectId, {
      include: [{
        model: PlatformUser,
        as: 'owner',
        attributes: ['id', 'name', 'email']
      }]
    });

    // 获取协作者列表
    const collaborators = await Collaborator.findAll({
      where: { projectId: req.params.projectId },
      include: [{
        model: PlatformUser,
        as: 'user',
        attributes: ['id', 'name', 'email']
      }]
    });

    res.json({
      code: 200,
      data: {
        ...project.toJSON(),
        collaborators,
        userRole: req.userRole
      }
    });
  } catch (error) {
    console.error('获取项目详情错误:', error);
    res.status(500).json({ code: 500, message: '获取项目详情失败' });
  }
});

/**
 * 更新项目信息
 * PUT /api/projects/:projectId
 */
router.put('/:projectId', authenticate, checkProjectAccess, requireProjectAdmin, async (req, res) => {
  try {
    const { name, description } = req.body;

    await req.project.update({
      name: name || req.project.name,
      description: description !== undefined ? description : req.project.description
    });

    res.json({
      code: 200,
      message: '项目更新成功',
      data: req.project
    });
  } catch (error) {
    console.error('更新项目错误:', error);
    res.status(500).json({ code: 500, message: '更新项目失败' });
  }
});

/**
 * 删除项目
 * DELETE /api/projects/:projectId
 */
router.delete('/:projectId', authenticate, checkProjectAccess, async (req, res) => {
  try {
    // 只有所有者可以删除项目
    if (req.userRole !== 'owner') {
      return res.status(403).json({ code: 403, message: '只有项目所有者可以删除项目' });
    }

    // 删除所有协作者
    await Collaborator.destroy({
      where: { projectId: req.params.projectId }
    });

    // 删除项目
    // TODO: 同时删除项目数据库文件
    await req.project.destroy();

    res.json({
      code: 200,
      message: '项目删除成功'
    });
  } catch (error) {
    console.error('删除项目错误:', error);
    res.status(500).json({ code: 500, message: '删除项目失败' });
  }
});

/**
 * 邀请协作者
 * POST /api/projects/:projectId/collaborators
 */
router.post('/:projectId/collaborators', authenticate, checkProjectAccess, requireProjectAdmin, async (req, res) => {
  try {
    const { email, role = 'collaborator' } = req.body;

    // 查找用户
    const user = await PlatformUser.findOne({ where: { email } });
    if (!user) {
      return res.status(404).json({ code: 404, message: '用户不存在' });
    }

    // 检查是否已是协作者
    const existing = await Collaborator.findOne({
      where: {
        projectId: req.params.projectId,
        userId: user.id
      }
    });

    if (existing) {
      return res.status(400).json({ code: 400, message: '该用户已是协作者' });
    }

    // 创建协作者
    const collaborator = await Collaborator.create({
      projectId: req.params.projectId,
      userId: user.id,
      role
    });

    res.json({
      code: 200,
      message: '协作者添加成功',
      data: collaborator
    });
  } catch (error) {
    console.error('添加协作者错误:', error);
    res.status(500).json({ code: 500, message: '添加协作者失败' });
  }
});

/**
 * 移除协作者
 * DELETE /api/projects/:projectId/collaborators/:userId
 */
router.delete('/:projectId/collaborators/:userId', authenticate, checkProjectAccess, requireProjectAdmin, async (req, res) => {
  try {
    await Collaborator.destroy({
      where: {
        projectId: req.params.projectId,
        userId: req.params.userId
      }
    });

    res.json({
      code: 200,
      message: '协作者移除成功'
    });
  } catch (error) {
    console.error('移除协作者错误:', error);
    res.status(500).json({ code: 500, message: '移除协作者失败' });
  }
});

/**
 * 获取项目安全设置
 * GET /api/projects/:projectId/security-settings
 */
router.get('/:projectId/security-settings', authenticate, checkProjectAccess, requireProjectAdmin, async (req, res) => {
  try {
    const { getProjectDb } = require('../config/database');
    const projectDb = getProjectDb(req.project.id);

    // 获取配置
    const [results] = await projectDb.query(
      "SELECT `key`, value FROM system_configs WHERE `key` IN ('registration_enabled')"
    );

    const settings = {};
    results.forEach(r => {
      settings[r.key] = r.value;
    });

    res.json({
      code: 200,
      data: {
        registrationEnabled: settings.registration_enabled === 'true',
        adminUsername: settings.admin_username || 'admin'
      }
    });
  } catch (error) {
    console.error('获取安全设置错误:', error);
    res.status(500).json({ code: 500, message: '获取安全设置失败' });
  }
});

/**
 * 更新管理员凭据
 * PUT /api/projects/:projectId/admin-credentials
 */
router.put('/:projectId/admin-credentials', authenticate, checkProjectAccess, requireProjectAdmin, async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ code: 400, message: '用户名和密码不能为空' });
    }

    if (password.length < 6) {
      return res.status(400).json({ code: 400, message: '密码至少需要6位' });
    }

    const { getProjectDb } = require('../config/database');
    const projectDb = getProjectDb(req.project.id);
    const bcrypt = require('bcryptjs');
    const hashedPassword = await bcrypt.hash(password, 10);

    // 更新管理员账号
    await projectDb.query(
      "UPDATE users SET studentId = ?, password = ? WHERE role = 'admin'",
      { replacements: [username, hashedPassword] }
    );

    res.json({
      code: 200,
      message: '管理员凭据已更新'
    });
  } catch (error) {
    console.error('更新管理员凭据错误:', error);
    res.status(500).json({ code: 500, message: '更新管理员凭据失败' });
  }
});

/**
 * 更新注册开关（仅超级管理员可用）
 * PUT /api/projects/:projectId/registration-setting
 */
router.put('/:projectId/registration-setting', authenticate, async (req, res) => {
  try {
    // 只有超级管理员可以控制注册开关
    if (!req.user.isSuperAdmin) {
      return res.status(403).json({ code: 403, message: '只有超级管理员可以控制注册开关' });
    }

    const { enabled } = req.body;
    const project = await Project.findByPk(req.params.projectId);

    if (!project) {
      return res.status(404).json({ code: 404, message: '项目不存在' });
    }

    const { getProjectDb } = require('../config/database');
    const projectDb = getProjectDb(project.id);

    // 更新或插入配置
    await projectDb.query(
      `INSERT INTO system_configs (\`key\`, value, description, createdAt, updatedAt)
       VALUES ('registration_enabled', ?, '用户注册开关', datetime('now'), datetime('now'))
       ON CONFLICT(\`key\`) DO UPDATE SET value = ?, updatedAt = datetime('now')`,
      { replacements: [enabled ? 'true' : 'false', enabled ? 'true' : 'false'] }
    );

    res.json({
      code: 200,
      message: enabled ? '注册功能已开启' : '注册功能已关闭'
    });
  } catch (error) {
    console.error('更新注册设置错误:', error);
    res.status(500).json({ code: 500, message: '更新注册设置失败' });
  }
});

module.exports = router;

