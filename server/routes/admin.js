const express = require('express');
const router = express.Router();
const { Project, User, Subject, Selection } = require('../models');
const { authenticate, requireAdmin } = require('../middleware/auth');
const { success, error } = require('../utils/response');


/**
 * 获取概览统计数据
 * GET /api/admin/overview
 */
router.get('/overview', authenticate, requireAdmin, async (req, res) => {
  try {
    const projectId = req.user.projectId;

    const totalStudents = await User.count({ where: { role: 'student', projectId } });
    const selectedCount = await Selection.count({ where: { projectId, status: 'submitted' } });
    const notSelectedCount = totalStudents - selectedCount;
    const totalSubjects = await Subject.count({ where: { projectId } });

    success(res, {
      totalStudents,
      selectedCount,
      notSelectedCount,
      totalSubjects
    });
  } catch (err) {
    console.error('获取概览失败:', err);
    error(res, '获取概览失败', 500);
  }
});

/**
 * 更新项目选科时间设置
 * PUT /api/admin/selection-time
 */
router.put('/selection-time', authenticate, requireAdmin, async (req, res) => {
  try {
    const { selectionStartTime, selectionEndTime } = req.body;
    const projectId = req.user.projectId;

    const project = await Project.findByPk(projectId);
    if (!project) {
      return error(res, '项目不存在');
    }

    // 验证：结束时间必须晚于开始时间
    if (selectionStartTime && selectionEndTime) {
      if (new Date(selectionEndTime) <= new Date(selectionStartTime)) {
        return error(res, '结束时间必须晚于开始时间');
      }
    }

    await project.update({
      selectionStartTime: selectionStartTime || null,
      selectionEndTime: selectionEndTime || null
    });

    success(res, null, '时间设置已更新');
  } catch (err) {
    console.error('更新选科时间错误:', err);
    error(res, '更新失败', 500);
  }
});

/**
 * 获取所有学生列表
 * GET /api/admin/students
 */
router.get('/students', authenticate, requireAdmin, async (req, res) => {
  try {
    const { className, page = 1, limit = 20 } = req.query;
    const projectId = req.user.projectId;

    const where = { role: 'student', projectId };
    if (className) where.className = className;

    const offset = (page - 1) * limit;
    const { count, rows } = await User.findAndCountAll({
      where,
      attributes: { exclude: ['password'] },
      include: [{
        model: Selection,
        as: 'selection',
        include: [
          { model: Subject, as: 'physicsHistorySubject' },
          { model: Subject, as: 'electiveOneSubject' },
          { model: Subject, as: 'electiveTwoSubject' }
        ]
      }],
      offset,
      limit: parseInt(limit),
      order: [['className', 'ASC'], ['studentId', 'ASC']]
    });

    success(res, {
      data: rows,
      total: count,
      page: parseInt(page),
      limit: parseInt(limit)
    });
  } catch (err) {
    console.error('获取学生列表失败:', err);
    error(res, '获取学生列表失败', 500);
  }
});


/**
 * 添加学生
 * POST /api/admin/students
 */
router.post('/students', authenticate, requireAdmin, async (req, res) => {
  try {
    const { studentId, name, className, password } = req.body;
    const projectId = req.user.projectId;

    if (!studentId || !name) {
      return error(res, '学号和姓名不能为空');
    }

    // 检查学号是否已存在
    const existing = await User.findOne({ where: { studentId, projectId } });
    if (existing) {
      return error(res, '该学号已存在');
    }

    const student = await User.create({
      studentId,
      name,
      className,
      password: password || studentId,
      role: 'student',
      projectId
    });

    success(res, student.toSafeObject(), '学生添加成功');
  } catch (err) {
    console.error('添加学生失败:', err);
    error(res, '添加学生失败', 500);
  }
});


/**
 * 更新学生信息
 * PUT /api/admin/students/:id
 */
router.put('/students/:id', authenticate, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { studentId, name, className } = req.body;
    const projectId = req.user.projectId;

    const student = await User.findOne({ where: { id, projectId, role: 'student' } });
    if (!student) {
      return error(res, '学生不存在');
    }

    // 如果修改学号，检查新学号是否已存在
    if (studentId && studentId !== student.studentId) {
      const { Op } = require('sequelize');
      const existing = await User.findOne({ 
        where: { 
          studentId, 
          projectId,
          id: { [Op.ne]: id }
        }
      });
      if (existing) {
        return error(res, '该学号已存在');
      }
    }

    await student.update({
      studentId: studentId || student.studentId,
      name: name || student.name,
      className: className !== undefined ? className : student.className
    });

    success(res, student.toSafeObject(), '学生信息更新成功');
  } catch (err) {
    console.error('更新学生失败:', err);
    error(res, '更新学生失败', 500);
  }
});

/**
 * 删除学生
 * DELETE /api/admin/students/:id
 */
router.delete('/students/:id', authenticate, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const projectId = req.user.projectId;

    const student = await User.findOne({ where: { id, projectId, role: 'student' } });
    if (!student) {
      return error(res, '学生不存在');
    }

    await Selection.destroy({ where: { userId: id } });
    await student.destroy();

    success(res, null, '学生删除成功');
  } catch (err) {
    console.error('删除学生失败:', err);
    error(res, '删除学生失败', 500);
  }
});

/**
 * 获取注册控制状态
 * GET /api/admin/registration-status
 */
router.get('/registration-status', authenticate, requireAdmin, async (req, res) => {
  try {
    const projectId = req.user.projectId;
    const project = await Project.findByPk(projectId);

    if (!project) {
      return error(res, '项目不存在');
    }

    success(res, {
      registrationEnabled: project.registrationEnabled
    });
  } catch (err) {
    console.error('获取注册状态失败:', err);
    error(res, '获取注册状态失败', 500);
  }
});

/**
 * 设置注册控制
 * PUT /api/admin/registration-control
 */
router.put('/registration-control', authenticate, requireAdmin, async (req, res) => {
  try {
    const { enabled } = req.body;
    const projectId = req.user.projectId;

    const project = await Project.findByPk(projectId);
    if (!project) {
      return error(res, '项目不存在');
    }

    await project.update({
      registrationEnabled: enabled
    });

    success(res, null, enabled ? '已开启学生注册' : '已关闭学生注册');
  } catch (err) {
    console.error('设置注册控制失败:', err);
    error(res, '设置注册控制失败', 500);
  }
});

module.exports = router;
