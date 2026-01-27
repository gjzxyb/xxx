const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { checkProjectAccess, requireProjectAdmin } = require('../middleware/projectAuth');
const { startProject, stopProject, getProjectStatus } = require('../services/projectLauncher');

/**
 * 启动项目
 * POST /api/projects/:projectId/start
 */
router.post('/:projectId/start', authenticate, checkProjectAccess, requireProjectAdmin, async (req, res) => {
  try {
    const port = await startProject(req.params.projectId);

    res.json({
      code: 200,
      message: '项目启动成功',
      data: {
        port,
        url: `http://localhost:${port}`
      }
    });
  } catch (error) {
    console.error('启动项目失败:', error);
    res.status(500).json({ code: 500, message: error.message || '启动项目失败' });
  }
});

/**
 * 停止项目
 * POST /api/projects/:projectId/stop
 */
router.post('/:projectId/stop', authenticate, checkProjectAccess, requireProjectAdmin, async (req, res) => {
  try {
    await stopProject(req.params.projectId);

    res.json({
      code: 200,
      message: '项目已停止'
    });
  } catch (error) {
    console.error('停止项目失败:', error);
    res.status(500).json({ code: 500, message: error.message || '停止项目失败' });
  }
});

/**
 * 获取项目状态
 * GET /api/projects/:projectId/status
 */
router.get('/:projectId/status', authenticate, checkProjectAccess, async (req, res) => {
  try {
    const status = await getProjectStatus(req.params.projectId);

    res.json({
      code: 200,
      data: status
    });
  } catch (error) {
    console.error('获取项目状态失败:', error);
    res.status(500).json({ code: 500, message: '获取项目状态失败' });
  }
});

module.exports = router;
