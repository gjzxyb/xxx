const express = require('express');
const router = express.Router();
const { success, error, notFound } = require('../utils/response');
const { projectDb } = require('../middleware/projectDb');
const { authenticateProject, requireProjectAdmin } = require('../middleware/projectAuth');
const { validateSubject, validateIdParam } = require('../middleware/validation');
const { adminLimiter, adminCreateLimiter, adminModifyLimiter } = require('../middleware/rateLimit');
const cacheService = require('../lib/CacheService');

/**
 * 获取所有科目
 * GET /api/subjects
 * 优化：添加Redis缓存，5分钟过期
 */
router.get('/', projectDb, authenticateProject, adminLimiter, async (req, res) => {
  try {
    const { category, active } = req.query;
    const { Subject } = req.projectModels;
    const projectId = req.projectId;

    // 生成缓存键（包含查询参数）
    const cacheKey = cacheService.projectKey(projectId, `subjects:${category || 'all'}:${active || 'all'}`);

    // 尝试从缓存获取
    const cached = await cacheService.get(cacheKey);
    if (cached) {
      return success(res, cached);
    }

    const where = {};
    if (category) where.category = category;
    if (active !== undefined) where.isActive = active === 'true';

    const subjects = await Subject.findAll({
      where,
      order: [['category', 'ASC'], ['name', 'ASC']]
    });

    // 写入缓存（5分钟）
    await cacheService.set(cacheKey, subjects, 300);

    success(res, subjects);
  } catch (err) {
    console.error('获取科目列表错误:', err);
    error(res, '获取科目列表失败', 500);
  }
});

/**
 * 获取单个科目
 * GET /api/subjects/:id
 */
router.get('/:id', projectDb, authenticateProject, adminLimiter, async (req, res) => {
  try {
    const { Subject } = req.projectModels;
    const subject = await Subject.findByPk(req.params.id);

    if (!subject) {
      return notFound(res, '科目不存在');
    }

    success(res, subject);
  } catch (err) {
    console.error('获取科目错误:', err);
    error(res, '获取科目失败', 500);
  }
});

/**
 * 创建科目（管理员）
 * POST /api/subjects
 */
router.post('/', projectDb, authenticateProject, requireProjectAdmin, adminCreateLimiter, validateSubject, async (req, res) => {
  try {
    const { name, category, description, maxCapacity } = req.body;
    const { Subject } = req.projectModels;
    const projectId = req.projectId;

    if (!name || !category) {
      return error(res, '科目名称和类别不能为空');
    }

    const subject = await Subject.create({
      name,
      category,
      description,
      maxCapacity: maxCapacity || null,
      isActive: true,
      currentCount: 0
    });

    // 清除科目列表缓存
    await cacheService.delPattern(cacheService.projectKey(projectId, 'subjects:*'));
    // 清除统计缓存
    await cacheService.del(cacheService.projectKey(projectId, 'stats'));

    success(res, subject, '科目创建成功', 201);
  } catch (err) {
    // 处理唯一约束违反（科目名称重复）
    if (err.name === 'SequelizeUniqueConstraintError') {
      console.warn(`[业务警告] 尝试创建重复科目: ${req.body.name}`);
      return error(res, '科目名称已存在，请使用其他名称', 409);
    }

    // 处理验证错误
    if (err.name === 'SequelizeValidationError') {
      const messages = err.errors.map(e => e.message).join(', ');
      console.warn(`[业务警告] 科目数据验证失败: ${messages}`);
      return error(res, `数据验证失败: ${messages}`, 400);
    }

    // 其他未知错误（真正的系统错误才打印堆栈）
    console.error('[系统错误] 创建科目失败:', err);
    error(res, '创建科目失败，请稍后重试', 500);
  }
});

/**
 * 更新科目（管理员）
 * PUT /api/subjects/:id
 */
router.put('/:id', validateIdParam, projectDb, authenticateProject, requireProjectAdmin, adminModifyLimiter, async (req, res) => {
  try {
    const { name, category, description, maxCapacity, isActive } = req.body;
    const { Subject } = req.projectModels;
    const projectId = req.projectId;

    const subject = await Subject.findByPk(req.params.id);
    if (!subject) {
      return notFound(res, '科目不存在');
    }

    await subject.update({
      name: name || subject.name,
      category: category || subject.category,
      description: description !== undefined ? description : subject.description,
      maxCapacity: maxCapacity !== undefined ? maxCapacity : subject.maxCapacity,
      isActive: isActive !== undefined ? isActive : subject.isActive
    });

    // 清除科目列表缓存
    await cacheService.delPattern(cacheService.projectKey(projectId, 'subjects:*'));
    // 清除统计缓存
    await cacheService.del(cacheService.projectKey(projectId, 'stats'));

    success(res, subject, '科目更新成功');
  } catch (err) {
    console.error('更新科目错误:', err);
    error(res, '更新科目失败', 500);
  }
});

/**
 * 删除科目（管理员）
 * DELETE /api/subjects/:id
 */
router.delete('/:id', validateIdParam, projectDb, authenticateProject, requireProjectAdmin, adminModifyLimiter, async (req, res) => {
  try {
    const { Subject } = req.projectModels;
    const projectId = req.projectId;
    const subject = await Subject.findByPk(req.params.id);

    if (!subject) {
      return notFound(res, '科目不存在');
    }

    await subject.destroy();

    // 清除科目列表缓存
    await cacheService.delPattern(cacheService.projectKey(projectId, 'subjects:*'));
    // 清除统计缓存
    await cacheService.del(cacheService.projectKey(projectId, 'stats'));

    success(res, null, '科目删除成功');
  } catch (err) {
    console.error('删除科目错误:', err);
    error(res, '删除科目失败', 500);
  }
});

module.exports = router;
