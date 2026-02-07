const express = require('express');
const router = express.Router();
const { success, error, notFound } = require('../utils/response');
const { projectDb } = require('../middleware/projectDb');
const { authenticateProject, requireProjectAdmin } = require('../middleware/projectAuth');
const { validateSubject, validateIdParam } = require('../middleware/validation');

/**
 * 获取所有科目
 * GET /api/subjects
 */
router.get('/', projectDb, authenticateProject, async (req, res) => {
  try {
    const { category, active } = req.query;
    const { Subject } = req.projectModels;

    const where = {};
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
router.get('/:id', projectDb, authenticateProject, async (req, res) => {
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
router.post('/', projectDb, authenticateProject, requireProjectAdmin, validateSubject, async (req, res) => {
  try {
    const { name, category, description, maxCapacity } = req.body;
    const { Subject } = req.projectModels;

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
router.put('/:id', validateIdParam, projectDb, authenticateProject, requireProjectAdmin, async (req, res) => {
  try {
    const { name, category, description, maxCapacity, isActive } = req.body;
    const { Subject } = req.projectModels;

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
router.delete('/:id', validateIdParam, projectDb, authenticateProject, requireProjectAdmin, async (req, res) => {
  try {
    const { Subject } = req.projectModels;
    const subject = await Subject.findByPk(req.params.id);

    if (!subject) {
      return notFound(res, '科目不存在');
    }

    await subject.destroy();
    success(res, null, '科目删除成功');
  } catch (err) {
    console.error('删除科目错误:', err);
    error(res, '删除科目失败', 500);
  }
});

module.exports = router;
