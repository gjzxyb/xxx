/**
 * 项目数据库中间件
 * 自动根据请求中的 projectId 加载项目数据库模型
 */
const dbManager = require('../lib/DatabaseManager');

/**
 * 项目数据库中间件
 * 从 URL 参数、查询参数或用户信息中提取 projectId，并加载项目模型
 */
async function projectDb(req, res, next) {
  try {
    // 优先级：URL参数 > 查询参数 > 用户信息
    const projectId = req.params.projectId ||
                      req.query.projectId ||
                      req.user?.projectId ||
                      req.body?.projectId;

    if (!projectId) {
      return res.status(400).json({
        code: 400,
        message: '缺少项目信息'
      });
    }

    // 检查项目数据库是否存在
    if (!dbManager.projectDbExists(projectId)) {
      return res.status(404).json({
        code: 404,
        message: '项目不存在或数据库未初始化'
      });
    }

    // 加载项目模型
    const projectModels = await dbManager.getProjectModels(projectId);

    // 将模型附加到请求对象
    req.projectId = projectId;
    req.projectModels = projectModels;
    req.projectDb = projectModels.sequelize;

    next();
  } catch (error) {
    console.error('项目数据库中间件错误:', error);
    res.status(500).json({
      code: 500,
      message: '加载项目数据库失败'
    });
  }
}

/**
 * 可选的项目数据库中间件
 * 如果有 projectId 则加载，否则跳过
 */
async function optionalProjectDb(req, res, next) {
  const projectId = req.params.projectId ||
                    req.query.projectId ||
                    req.user?.projectId ||
                    req.body?.projectId;

  if (!projectId) {
    return next();
  }

  try {
    if (dbManager.projectDbExists(projectId)) {
      const projectModels = await dbManager.getProjectModels(projectId);
      req.projectId = projectId;
      req.projectModels = projectModels;
      req.projectDb = projectModels.sequelize;
    }
    next();
  } catch (error) {
    console.error('可选项目数据库中间件错误:', error);
    next(); // 继续执行，不中断请求
  }
}

module.exports = {
  projectDb,
  optionalProjectDb
};
