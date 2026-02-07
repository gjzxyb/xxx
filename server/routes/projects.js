const express = require('express');
const router = express.Router();
const { Project, Collaborator, PlatformUser, User, Subject } = require('../models');
const { authenticatePlatform } = require('../middleware/platformAuth');
// 检查选科是否在开放时段
function checkSelectionOpen(project) {
  if (project.status !== 'running') return false;

  const now = new Date();

  // 检查开始时间
  if (project.selectionStartTime && now < new Date(project.selectionStartTime)) {
    return false; // 未到开始时间
  }

  // 检查结束时间
  if (project.selectionEndTime && now > new Date(project.selectionEndTime)) {
    return false; // 已过结束时间
  }

  return true; // 在时段内
}

/**
 * 获取所有公开项目（无需认证）
 * GET /api/projects/public
 * 安全性：只返回必要的公开信息，隐藏敏感字段
 */
router.get('/public', async (req, res) => {
  try {
    // 只返回状态为 'running' 的项目，且只暴露最少信息
    const projects = await Project.findAll({
      attributes: ['id', 'name', 'status'], // 移除 description，减少信息泄露
      where: { status: 'running' }, // 只显示运行中的项目
      order: [['createdAt', 'DESC']],
      limit: 50 // 限制返回数量，防止信息收集
    });

    // 进一步脱敏处理
    const sanitizedProjects = projects.map(p => ({
      id: p.id,
      name: p.name,
      // 不返回详细描述和其他敏感信息
    }));

    res.json({
      code: 200,
      data: sanitizedProjects
    });
  } catch (error) {
    console.error('获取公开项目列表错误:', error.message);
    res.status(500).json({ code: 500, message: '获取项目列表失败' });
  }
});

/**
 * 获取用户的所有项目（包括协作项目）
 * GET /api/platform/projects
 */
router.get('/', authenticatePlatform, async (req, res) => {
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
 * POST /api/platform/projects
 */
router.post('/', authenticatePlatform, async (req, res) => {
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

    // 创建项目
    const project = await Project.create({
      name,
      description,
      ownerId: req.user.id,
      status: 'active'
    });

    // 初始化项目数据库
    const dbManager = require('../lib/DatabaseManager');
    try {
      await dbManager.initProjectDb(project.id);
      console.log(`✓ 项目数据库已创建: ${project.id}`);
    } catch (dbError) {
      // 如果数据库初始化失败，回滚项目创建
      await project.destroy();
      throw new Error('项目数据库初始化失败: ' + dbError.message);
    }

    res.json({
      code: 200,
      message: '项目创建成功',
      data: project
    });
  } catch (error) {
    console.error('创建项目错误:', error);
    res.status(500).json({ code: 500, message: error.message || '创建项目失败' });
  }
});

/**
 * 获取项目详情
 * GET /api/platform/projects/:projectId
 */
router.get('/:projectId', authenticatePlatform, async (req, res) => {
  try {
    const project = await Project.findByPk(req.params.projectId, {
      include: [{
        model: PlatformUser,
        as: 'owner',
        attributes: ['id', 'name', 'email']
      }]
    });

    if (!project) {
      return res.status(404).json({ code: 404, message: '项目不存在' });
    }

    // 检查访问权限
    const userRole = await getProjectRole(req.user.id, project.id);
    if (!userRole) {
      return res.status(403).json({ code: 403, message: '无权访问此项目' });
    }

    // 获取协作者列表
    const collaborators = await Collaborator.findAll({
      where: { projectId: req.params.projectId },
      include: [{
        model: PlatformUser,
        as: 'user',
        attributes: ['id', 'name', 'email']
      }]
    });

    // 获取项目统计
    const studentCount = await User.count({ where: { projectId: project.id } });
    const subjectCount = await Subject.count({ where: { projectId: project.id } });

    res.json({
      code: 200,
      data: {
        ...project.toJSON(),
        isSelectionOpen: checkSelectionOpen(project),
        collaborators,
        userRole,
        stats: {
          students: studentCount,
          subjects: subjectCount
        }
      }
    });
  } catch (error) {
    console.error('获取项目详情错误:', error);
    res.status(500).json({ code: 500, message: '获取项目详情失败' });
  }
});

/**
 * 更新项目信息
 * PUT /api/platform/projects/:projectId
 */
router.put('/:projectId', authenticatePlatform, async (req, res) => {
  try {
    const { name, description, status } = req.body;
    const project = await Project.findByPk(req.params.projectId);

    if (!project) {
      return res.status(404).json({ code: 404, message: '项目不存在' });
    }

    // 检查权限
    const userRole = await getProjectRole(req.user.id, project.id);
    if (userRole !== 'owner' && userRole !== 'admin') {
      return res.status(403).json({ code: 403, message: '无权修改此项目' });
    }

    await project.update({
      name: name || project.name,
      description: description !== undefined ? description : project.description,
      status: status || project.status
    });

    res.json({
      code: 200,
      message: '项目更新成功',
      data: project
    });
  } catch (error) {
    console.error('更新项目错误:', error);
    res.status(500).json({ code: 500, message: '更新项目失败' });
  }
});

/**
 * 删除项目
 * DELETE /api/platform/projects/:projectId
 */
router.delete('/:projectId', authenticatePlatform, async (req, res) => {
  try {
    const project = await Project.findByPk(req.params.projectId);

    if (!project) {
      return res.status(404).json({ code: 404, message: '项目不存在' });
    }

    // 只有所有者可以删除项目
    if (project.ownerId !== req.user.id) {
      return res.status(403).json({ code: 403, message: '只有项目所有者可以删除项目' });
    }

    // 删除所有协作者
    await Collaborator.destroy({
      where: { projectId: req.params.projectId }
    });

    // 删除项目相关数据
    await User.destroy({ where: { projectId: project.id } });
    await Subject.destroy({ where: { projectId: project.id } });

    // 删除项目
    await project.destroy();

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
 * 启动项目（启用项目访问）
 * POST /api/platform/projects/:projectId/start
 */
router.post('/:projectId/start', authenticatePlatform, async (req, res) => {
  try {
    const project = await Project.findByPk(req.params.projectId);

    if (!project) {
      return res.status(404).json({ code: 404, message: '项目不存在' });
    }

    // 检查权限
    const userRole = await getProjectRole(req.user.id, project.id);
    if (!userRole) {
      return res.status(403).json({ code: 403, message: '无权启动此项目' });
    }

    // 检查项目状态
    if (project.status === 'running') {
      return res.json({
        code: 200,
        message: '项目已在运行中',
        data: {
          projectId: project.id,
          url: `/admin.html?projectId=${project.id}`
        }
      });
    }

    // 更新项目状态为运行中（多租户模式，无需分配端口）
    await project.update({
      status: 'running'
    });

    res.json({
      code: 200,
      message: '项目已启用',
      data: {
        projectId: project.id,
        url: `/admin.html?projectId=${project.id}`
      }
    });
  } catch (error) {
    console.error('启动项目错误:', error);
    res.status(500).json({ code: 500, message: '启动项目失败' });
  }
});

/**
 * 停止项目（禁用项目访问）
 * POST /api/platform/projects/:projectId/stop
 */
router.post('/:projectId/stop', authenticatePlatform, async (req, res) => {
  try {
    const project = await Project.findByPk(req.params.projectId);

    if (!project) {
      return res.status(404).json({ code: 404, message: '项目不存在' });
    }

    // 检查权限
    const userRole = await getProjectRole(req.user.id, project.id);
    if (!userRole) {
      return res.status(403).json({ code: 403, message: '无权停止此项目' });
    }

    // 更新项目状态为已停止
    await project.update({
      status: 'stopped'
    });

    res.json({
      code: 200,
      message: '项目已禁用'
    });
  } catch (error) {
    console.error('停止项目错误:', error);
    res.status(500).json({ code: 500, message: '停止项目失败' });
  }
});

/**
 * 邀请协作者
 * POST /api/platform/projects/:projectId/collaborators
 */
router.post('/:projectId/collaborators', authenticatePlatform, async (req, res) => {
  try {
    const { email, role = 'collaborator' } = req.body;
    const project = await Project.findByPk(req.params.projectId);

    if (!project) {
      return res.status(404).json({ code: 404, message: '项目不存在' });
    }

    // 检查权限
    const userRole = await getProjectRole(req.user.id, project.id);
    if (userRole !== 'owner' && userRole !== 'admin') {
      return res.status(403).json({ code: 403, message: '无权添加协作者' });
    }

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
 * DELETE /api/platform/projects/:projectId/collaborators/:userId
 */
router.delete('/:projectId/collaborators/:userId', authenticatePlatform, async (req, res) => {
  try {
    const project = await Project.findByPk(req.params.projectId);

    if (!project) {
      return res.status(404).json({ code: 404, message: '项目不存在' });
    }

    // 检查权限
    const userRole = await getProjectRole(req.user.id, project.id);
    if (userRole !== 'owner' && userRole !== 'admin') {
      return res.status(403).json({ code: 403, message: '无权移除协作者' });
    }

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

// 辅助函数：获取用户在项目中的角色
async function getProjectRole(userId, projectId) {
  const project = await Project.findByPk(projectId);
  if (!project) return null;

  if (project.ownerId === userId) {
    return 'owner';
  }

  const collaboration = await Collaborator.findOne({
    where: { projectId, userId }
  });

  return collaboration ? collaboration.role : null;
}

/**
 * 设置项目管理员凭据
 * PUT /api/platform/projects/:projectId/admin-credentials
 */
router.put('/:projectId/admin-credentials', authenticatePlatform, async (req, res) => {
  try {
    const { username, password } = req.body;
    const project = await Project.findByPk(req.params.projectId);

    if (!project) {
      return res.status(404).json({ code: 404, message: '项目不存在' });
    }

    // 只有项目所有者可以设置管理员凭据
    if (project.ownerId !== req.user.id) {
      return res.status(403).json({ code: 403, message: '只有项目所有者可以设置管理员凭据' });
    }

    if (!username || !password) {
      return res.status(400).json({ code: 400, message: '账号和密码不能为空' });
    }

    if (password.length < 6) {
      return res.status(400).json({ code: 400, message: '密码至少需要6位' });
    }

    // 使用项目数据库
    const dbManager = require('../lib/DatabaseManager');
    const projectModels = await dbManager.getProjectModels(project.id);
    const { User } = projectModels;

    // 先删除该项目的所有旧admin用户
    await User.destroy({
      where: {
        role: 'admin'
      }
    });

    // 创建新admin用户（在项目数据库中）
    await User.create({
      studentId: username,
      password: password,
      name: '管理员',
      role: 'admin'
    });

    res.json({
      code: 200,
      message: '管理员凭据已更新',
      data: {
        username: username
      }
    });
  } catch (error) {
    console.error('设置管理员凭据错误:', error);
    res.status(500).json({ code: 500, message: '设置管理员凭据失败' });
  }
});

/**
 * 设置项目注册控制
 * PUT /api/platform/projects/:projectId/registration-setting
 */
router.put('/:projectId/registration-setting', authenticatePlatform, async (req, res) => {
  try {
    const { enabled } = req.body;
    const project = await Project.findByPk(req.params.projectId);

    if (!project) {
      return res.status(404).json({ code: 404, message: '项目不存在' });
    }

    // 更新注册设置
    await project.update({
      registrationEnabled: enabled
    });

    res.json({
      code: 200,
      message: enabled ? '已开启学生注册' : '已关闭学生注册',
      data: {
        projectId: project.id,
        registrationEnabled: enabled
      }
    });
  } catch (error) {
    console.error('更新项目注册设置错误:', error);
    res.status(500).json({ code: 500, message: '更新失败' });
  }
});

module.exports = router;
