const express = require('express');
const router = express.Router();
const XLSX = require('xlsx');
const { User, Selection, Subject, SystemConfig } = require('../models');
const { success, error } = require('../utils/response');
const { authenticate, requireAdmin } = require('../middleware/auth');

/**
 * 获取所有配置
 * GET /api/admin/config
 */
router.get('/config', authenticate, requireAdmin, async (req, res) => {
  try {
    const configs = await SystemConfig.findAll();
    success(res, configs);
  } catch (err) {
    console.error('获取配置错误:', err);
    error(res, '获取配置失败', 500);
  }
});

/**
 * 更新配置
 * PUT /api/admin/config
 */
router.put('/config', authenticate, requireAdmin, async (req, res) => {
  try {
    const { key, value, description } = req.body;

    if (!key) {
      return error(res, '配置键不能为空');
    }

    const config = await SystemConfig.setValue(key, value, description);
    success(res, config, '配置更新成功');
  } catch (err) {
    console.error('更新配置错误:', err);
    error(res, '更新配置失败', 500);
  }
});

/**
 * 批量设置选科时间
 * PUT /api/admin/selection-time
 */
router.put('/selection-time', authenticate, requireAdmin, async (req, res) => {
  try {
    const { startTime, endTime } = req.body;

    if (!startTime || !endTime) {
      return error(res, '请设置开始时间和结束时间');
    }

    if (new Date(startTime) >= new Date(endTime)) {
      return error(res, '开始时间必须早于结束时间');
    }

    await SystemConfig.setValue('selection_start_time', startTime, '选科开始时间');
    await SystemConfig.setValue('selection_end_time', endTime, '选科结束时间');

    success(res, { startTime, endTime }, '选科时间设置成功');
  } catch (err) {
    console.error('设置选科时间错误:', err);
    error(res, '设置选科时间失败', 500);
  }
});

/**
 * 获取所有学生列表
 * GET /api/admin/students
 */
router.get('/students', authenticate, requireAdmin, async (req, res) => {
  try {
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
      total: count,
      page: parseInt(page),
      limit: parseInt(limit),
      data: rows
    });
  } catch (err) {
    console.error('获取学生列表错误:', err);
    error(res, '获取学生列表失败', 500);
  }
});

/**
 * 导出选科数据为Excel
 * GET /api/admin/export
 */
router.get('/export', authenticate, requireAdmin, async (req, res) => {
  try {
    const selections = await Selection.findAll({
      where: { status: ['submitted', 'confirmed'] },
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['studentId', 'name', 'className']
        },
        { model: Subject, as: 'physicsHistorySubject' },
        { model: Subject, as: 'electiveOneSubject' },
        { model: Subject, as: 'electiveTwoSubject' }
      ],
      order: [[{ model: User, as: 'user' }, 'className', 'ASC']]
    });

    // 构建Excel数据
    const data = selections.map(s => ({
      '学号': s.user?.studentId || '',
      '姓名': s.user?.name || '',
      '班级': s.user?.className || '',
      '物理/历史': s.physicsHistorySubject?.name || '',
      '选科1': s.electiveOneSubject?.name || '',
      '选科2': s.electiveTwoSubject?.name || '',
      '状态': s.status === 'submitted' ? '已提交' : s.status === 'confirmed' ? '已确认' : s.status,
      '提交时间': s.submittedAt ? new Date(s.submittedAt).toLocaleString('zh-CN') : ''
    }));

    // 创建工作簿
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(data);

    // 设置列宽
    ws['!cols'] = [
      { wch: 12 }, // 学号
      { wch: 10 }, // 姓名
      { wch: 12 }, // 班级
      { wch: 8 },  // 物理/历史
      { wch: 8 },  // 选科1
      { wch: 8 },  // 选科2
      { wch: 8 },  // 状态
      { wch: 20 }  // 提交时间
    ];

    XLSX.utils.book_append_sheet(wb, ws, '选科结果');

    // 生成Buffer
    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    // 设置响应头
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=selection_${Date.now()}.xlsx`);
    res.send(buffer);
  } catch (err) {
    console.error('导出Excel错误:', err);
    error(res, '导出失败', 500);
  }
});

/**
 * 批量导入学生（管理员）
 * POST /api/admin/import-students
 */
router.post('/import-students', authenticate, requireAdmin, async (req, res) => {
  try {
    const { students } = req.body;

    if (!Array.isArray(students) || students.length === 0) {
      return error(res, '请提供学生数据');
    }

    const results = { success: 0, failed: 0, errors: [] };

    for (const student of students) {
      try {
        const { studentId, name, className, password = '123456' } = student;

        if (!studentId || !name) {
          results.failed++;
          results.errors.push(`缺少必要字段: ${JSON.stringify(student)}`);
          continue;
        }

        const existing = await User.findOne({ where: { studentId } });
        if (existing) {
          results.failed++;
          results.errors.push(`学号已存在: ${studentId}`);
          continue;
        }

        await User.create({
          studentId,
          name,
          className,
          password,
          role: 'student'
        });
        results.success++;
      } catch (e) {
        results.failed++;
        results.errors.push(e.message);
      }
    }

    success(res, results, `导入完成：成功 ${results.success} 人，失败 ${results.failed} 人`);
  } catch (err) {
    console.error('导入学生错误:', err);
    error(res, '导入失败', 500);
  }
});

/**
 * 添加学生
 * POST /api/admin/students
 */
router.post('/students', authenticate, requireAdmin, async (req, res) => {
  try {
    const { studentId, name, className, password } = req.body;

    if (!studentId || !name) {
      return error(res, '学号和姓名不能为空');
    }

    // 检查学号是否已存在
    const exists = await User.findOne({ where: { studentId } });
    if (exists) {
      return error(res, '学号已存在');
    }

    const user = await User.create({
      studentId,
      name,
      className: className || null,
      password: password || studentId, // 默认密码为学号
      role: 'student'
    });

    success(res, user, '学生添加成功');
  } catch (err) {
    console.error('添加学生错误:', err);
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

    const user = await User.findByPk(id);
    if (!user || user.role !== 'student') {
      return error(res, '学生不存在', 404);
    }

    // 如果修改学号，检查新学号是否已存在
    if (studentId && studentId !== user.studentId) {
      const exists = await User.findOne({ where: { studentId } });
      if (exists) {
        return error(res, '学号已存在');
      }
    }

    await user.update({
      studentId: studentId || user.studentId,
      name: name || user.name,
      className: className !== undefined ? className : user.className
    });

    success(res, user, '学生信息更新成功');
  } catch (err) {
    console.error('更新学生错误:', err);
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

    const user = await User.findByPk(id);
    if (!user || user.role !== 'student') {
      return error(res, '学生不存在', 404);
    }

    // 同时删除该学生的选科记录
    await Selection.destroy({ where: { userId: id } });
    await user.destroy();

    success(res, null, '学生删除成功');
  } catch (err) {
    console.error('删除学生错误:', err);
    error(res, '删除学生失败', 500);
  }
});

/**
 * 重置学生密码
 * POST /api/admin/students/:id/reset-password
 */
router.post('/students/:id/reset-password', authenticate, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    const user = await User.findByPk(id);
    if (!user || user.role !== 'student') {
      return error(res, '学生不存在', 404);
    }

    // 重置密码为学号
    await user.update({ password: user.studentId });

    success(res, null, `密码已重置为：${user.studentId}`);
  } catch (err) {
    console.error('重置密码错误:', err);
    error(res, '重置密码失败', 500);
  }
});

module.exports = router;
