const express = require('express');
const router = express.Router();
const { Project } = require('../models'); // 平台级模型
const { success, error } = require('../utils/response');
const { authenticateProject, requireProjectAdmin } = require('../middleware/projectAuth');

/**
 * 获取概览统计数据
 * GET /api/admin/overview
 */
router.get('/overview', authenticateProject, requireProjectAdmin, async (req, res) => {
  try {
    const { User, Subject, Selection } = req.projectModels;

    const totalStudents = await User.count({ where: { role: 'student' } });
    const selectedCount = await Selection.count({ where: { status: 'submitted' } });
    const notSelectedCount = totalStudents - selectedCount;
    const totalSubjects = await Subject.count();

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
router.put('/selection-time', authenticateProject, requireProjectAdmin, async (req, res) => {
  try {
    const { selectionStartTime, selectionEndTime } = req.body;
    const projectId = req.projectId;

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
router.get('/students', authenticateProject, requireProjectAdmin, async (req, res) => {
  try {
    const { User, Selection, Subject } = req.projectModels;
    const { className, page = 1, limit = 20 } = req.query;

    const where = { role: 'student' };
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
router.post('/students', authenticateProject, requireProjectAdmin, async (req, res) => {
  try {
    const { User } = req.projectModels;
    const { studentId, name, className, password } = req.body;

    if (!studentId || !name) {
      return error(res, '学号和姓名不能为空');
    }

    // 检查学号是否已存在
    const existingStudent = await User.findOne({ where: { studentId, role: 'student' } });
    if (existingStudent) {
      return error(res, '学号已存在');
    }

    const student = await User.create({
      studentId,
      name,
      className,
      password: password || studentId,
      role: 'student'
    });

    success(res, {
      id: student.id,
      studentId: student.studentId,
      name: student.name,
      className: student.className
    }, '添加成功');
  } catch (err) {
    console.error('添加学生失败:', err);
    error(res, '添加失败', 500);
  }
});

/**
 * 批量导入学生
 * POST /api/admin/import-students
 */
router.post('/import-students', authenticateProject, requireProjectAdmin, async (req, res) => {
  try {
    const { User } = req.projectModels;
    const { students } = req.body;

    if (!Array.isArray(students) || students.length === 0) {
      return error(res, '导入数据不能为空');
    }

    let successCount = 0;
    let failed = 0;
    const errors = [];

    for (const student of students) {
      try {
        const { studentId, name, className, password } = student;

        if (!studentId || !name) {
          errors.push(`学号 ${studentId || '未知'}: 学号和姓名不能为空`);
          failed++;
          continue;
        }

        const existingStudent = await User.findOne({ where: { studentId, role: 'student' } });
        if (existingStudent) {
          errors.push(`学号 ${studentId}: 已存在`);
          failed++;
          continue;
        }

        await User.create({
          studentId,
          name,
          className,
          password: password || studentId,
          role: 'student'
        });

        successCount++;
      } catch (err) {
        errors.push(`学号 ${student.studentId || '未知'}: ${err.message}`);
        failed++;
      }
    }

    res.json({
      code: 200,
      data: { success: successCount, failed, errors },
      message: `导入完成，成功 ${successCount} 人，失败 ${failed} 人`
    });
  } catch (err) {
    console.error('批量导入失败:', err);
    error(res, '导入失败', 500);
  }
});

/**
 * 获取注册开关状态
 * GET /api/admin/registration-setting
 */
router.get('/registration-setting', authenticateProject, requireProjectAdmin, async (req, res) => {
  try {
    const projectId = req.projectId;
    const project = await Project.findByPk(projectId);

    if (!project) {
      return error(res, '项目不存在', 404);
    }

    success(res, {
      registrationEnabled: project.registrationEnabled || false
    });
  } catch (err) {
    console.error('获取注册设置失败:', err);
    error(res, '获取注册设置失败', 500);
  }
});

/**
 * 切换注册开关
 * PUT /api/admin/registration-setting
 */
router.put('/registration-setting', authenticateProject, requireProjectAdmin, async (req, res) => {
  try {
    const { enabled } = req.body;
    const projectId = req.projectId;

    const project = await Project.findByPk(projectId);
    if (!project) {
      return error(res, '项目不存在', 404);
    }

    await project.update({ registrationEnabled: enabled });

    success(res, null, `注册已${enabled ? '开启' : '关闭'}`);
  } catch (err) {
    console.error('切换注册开关失败:', err);
    error(res, '操作失败', 500);
  }
});


/**
 * 更新学生信息
 * PUT /api/admin/students/:id
 */
router.put('/students/:id', authenticateProject, requireProjectAdmin, async (req, res) => {
  try {
    const { User } = req.projectModels;
    const { studentId, name, className } = req.body;
    const id = req.params.id;

    const student = await User.findByPk(id);
    if (!student || student.role !== 'student') {
      return error(res, '学生不存在');
    }

    // 检查学号冲突（如果修改了学号）
    if (studentId && studentId !== student.studentId) {
      const existing = await User.findOne({ where: { studentId, role: 'student' } });
      if (existing) {
        return error(res, '该学号已被使用');
      }
    }

    await student.update({
      studentId: studentId || student.studentId,
      name: name || student.name,
      className: className !== undefined ? className : student.className
    });

    success(res, student, '更新成功');
  } catch (err) {
    console.error('更新学生失败:', err);
    error(res, '更新失败', 500);
  }
});

/**
 * 删除学生
 * DELETE /api/admin/students/:id
 */
router.delete('/students/:id', authenticateProject, requireProjectAdmin, async (req, res) => {
  try {
    const { User } = req.projectModels;
    const id = req.params.id;

    const student = await User.findByPk(id);
    if (!student || student.role !== 'student') {
      return error(res, '学生不存在');
    }

    await student.destroy();
    success(res, null, '删除成功');
  } catch (err) {
    console.error('删除学生失败:', err);
    error(res, '删除失败', 500);
  }
});

/**
 * 重置学生密码
 * POST /api/admin/students/:id/reset-password
 */
router.post('/students/:id/reset-password', authenticateProject, requireProjectAdmin, async (req, res) => {
  try {
    const { User } = req.projectModels;
    const id = req.params.id;

    const student = await User.findByPk(id);
    if (!student || student.role !== 'student') {
      return error(res, '学生不存在');
    }

    // 重置密码为学号
    await student.update({
      password: student.studentId
    });

    success(res, null, '密码已重置为学号');
  } catch (err) {
    console.error('重置密码失败:', err);
    error(res, '重置失败', 500);
  }
});

module.exports = router;
