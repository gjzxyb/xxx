const express = require('express');
const router = express.Router();
const { Subject } = require('../models');
const { success, error, notFound } = require('../utils/response');
const { authenticate, requireAdmin } = require('../middleware/auth');

/**
 * 获取所有科目
 * GET /api/subjects
 * 使用认证中间件，根据projectId过滤
 */
router.get('/', authenticate, async (req, res) => {
  try {
    const { category, active } = req.query;
    const projectId = req.user.projectId;

    const where = { projectId };
    if (category) where.category = category;
    if (active !== undefined) where.isActive = active === 'true';

    const subjects = await Subject.findAll({
      where,
      order: [['category', 'ASC'], ['name', 'ASC']]
    });

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
router.get('/:id', async (req, res) => {
  try {
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
router.post('/', authenticate, requireAdmin, async (req, res) => {
  try {
    const { name, category, description, maxCapacity } = req.body;
    const projectId = req.user.projectId;

    if (!name || !category) {
      return error(res, '请填写科目名称和分类');
    }

    if (!['physics_history', 'four_electives'].includes(category)) {
      return error(res, '无效的科目分类');
    }

    const existing = await Subject.findOne({ where: { name, projectId } });
    if (existing) {
      return error(res, '该科目已存在');
    }

    const subject = await Subject.create({
      name,
      category,
      description,
      maxCapacity: maxCapacity || 0,
      projectId
    });

    success(res, subject, '科目创建成功');
  } catch (err) {
    console.error('创建科目错误:', err);
    error(res, '创建科目失败', 500);
  }
});

/**
 * 更新科目（管理员）
 * PUT /api/subjects/:id
 */
router.put('/:id', authenticate, requireAdmin, async (req, res) => {
  try {
    const subject = await Subject.findByPk(req.params.id);
    if (!subject) {
      return notFound(res, '科目不存在');
    }

    const { name, category, description, maxCapacity, isActive } = req.body;

    if (name) subject.name = name;
    if (category) subject.category = category;
    if (description !== undefined) subject.description = description;
    if (maxCapacity !== undefined) subject.maxCapacity = maxCapacity;
    if (isActive !== undefined) subject.isActive = isActive;

    await subject.save();
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
router.delete('/:id', authenticate, requireAdmin, async (req, res) => {
  try {
    const subject = await Subject.findByPk(req.params.id);
    if (!subject) {
      return notFound(res, '科目不存在');
    }

    if (subject.currentCount > 0) {
      return error(res, '该科目已有学生选择，无法删除');
    }

    await subject.destroy();
    success(res, null, '科目删除成功');
  } catch (err) {
    console.error('删除科目错误:', err);
    error(res, '删除科目失败', 500);
  }
});

module.exports = router;
