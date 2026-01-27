const { Project, Collaborator } = require('../models');

/**
 * 项目权限检查中间件
 * 验证用户是否有权限访问指定项目
 */
async function checkProjectAccess(req, res, next) {
  const projectId = req.params.projectId || req.body.projectId;

  if (!projectId) {
    return res.status(400).json({ code: 400, message: '缺少项目ID' });
  }

  try {
    const project = await Project.findByPk(projectId);
    if (!project) {
      return res.status(404).json({ code: 404, message: '项目不存在' });
    }

    // 检查是否是项目所有者
    if (project.ownerId === req.user.id) {
      req.project = project;
      req.userRole = 'owner';
      return next();
    }

    // 检查是否是协作者
    const collaborator = await Collaborator.findOne({
      where: {
        projectId,
        userId: req.user.id
      }
    });

    if (collaborator) {
      req.project = project;
      req.userRole = collaborator.role;
      return next();
    }

    return res.status(403).json({ code: 403, message: '无权访问此项目' });
  } catch (error) {
    console.error('项目权限检查错误:', error);
    res.status(500).json({ code: 500, message: '权限检查失败' });
  }
}

/**
 * 要求项目管理员权限
 */
function requireProjectAdmin(req, res, next) {
  if (req.userRole !== 'owner' && req.userRole !== 'admin') {
    return res.status(403).json({ code: 403, message: '需要项目管理员权限' });
  }
  next();
}

module.exports = {
  checkProjectAccess,
  requireProjectAdmin
};
