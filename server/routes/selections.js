const express = require('express');
const router = express.Router();
const { Project } = require('../models'); // 只需要平台级的 Project 模型
const { success, error, notFound } = require('../utils/response');
const { authenticateProject, requireProjectAdmin } = require('../middleware/projectAuth');
const { projectDb, optionalProjectDb } = require('../middleware/projectDb');

/**
 * 检查选科时间是否开放（基于项目配置）
 * @param {number} projectId - 项目ID
 */
const checkSelectionTime = async (projectId) => {
  const project = await Project.findByPk(projectId);
  if (!project) {
    return { open: false, message: '项目不存在' };
  }

  const { selectionStartTime, selectionEndTime } = project;

  if (!selectionStartTime || !selectionEndTime) {
    return { open: false, message: '选科时间未设置' };
  }

  const now = new Date();
  const start = new Date(selectionStartTime);
  const end = new Date(selectionEndTime);

  if (now < start) {
    return { open: false, message: `选科将于 ${selectionStartTime} 开始` };
  }
  if (now > end) {
    return { open: false, message: `选科已于 ${selectionEndTime} 结束` };
  }

  return { open: true, message: '选科进行中' };
};

/**
 * 获取选科状态（时间是否开放）
 * GET /api/selections/status
 */
router.get('/status', projectDb, authenticateProject, async (req, res) => {
  try {
    const projectId = req.projectId;

    const project = await Project.findByPk(projectId);
    if (!project) {
      return error(res, '项目不存在');
    }

    const status = await checkSelectionTime(projectId);

    success(res, {
      ...status,
      startTime: project.selectionStartTime,
      endTime: project.selectionEndTime
    });
  } catch (err) {
    console.error('获取选科状态错误:', err);
    error(res, '获取选科状态失败', 500);
  }
});

/**
 * 获取我的选科（学生）
 * GET /api/selections/my
 */
router.get('/my', projectDb, authenticateProject, async (req, res) => {
  try {
    const { Selection, Subject, User } = req.projectModels;
    const userId = req.user.id;

    let selection = await Selection.findOne({
      where: { userId },
      include: [
        {
          model: Subject,
          as: 'physicsHistorySubject',
          attributes: ['id', 'name', 'category']
        },
        {
          model: Subject,
          as: 'electiveOneSubject',
          attributes: ['id', 'name', 'category']
        },
        {
          model: Subject,
          as: 'electiveTwoSubject',
          attributes: ['id', 'name', 'category']
        }
      ]
    });

    if (!selection) {
      // 如果没有选科记录，创建一个草稿
      selection = await Selection.create({
        userId,
        status: 'draft'
      });
    }

    success(res, selection);
  } catch (err) {
    console.error('获取我的选科错误:', err);
    error(res, '获取我的选科失败', 500);
  }
});

/**
 * 提交/更新选科
 * POST /api/selections
 */
router.post('/', projectDb, authenticateProject, async (req, res) => {
  try {
    // 检查时间
    const projectId = req.projectId;
    const timeStatus = await checkSelectionTime(projectId);
    if (!timeStatus.open) {
      return error(res, timeStatus.message);
    }

    const { physicsOrHistory, electiveOne, electiveTwo } = req.body;

    // 验证选科
    if (!physicsOrHistory) {
      return error(res, '请选择物理或历史');
    }
    if (!electiveOne || !electiveTwo) {
      return error(res, '请在化学、生物、政治、地理中选择两科');
    }
    if (electiveOne === electiveTwo) {
      return error(res, '四选二不能选择相同科目');
    }

    // 验证科目存在性和分类
    const { Subject, Selection } = req.projectModels;
    const phSubject = await Subject.findByPk(physicsOrHistory);
    if (!phSubject || phSubject.category !== 'physics_history') {
      return error(res, '物理/历史科目选择无效');
    }

    const elec1 = await Subject.findByPk(electiveOne);
    const elec2 = await Subject.findByPk(electiveTwo);
    if (!elec1 || elec1.category !== 'four_electives' ||
        !elec2 || elec2.category !== 'four_electives') {
      return error(res, '四选二科目选择无效');
    }

    // 使用事务和行锁防止并发竞态条件
    const sequelize = Selection.sequelize;
    const transaction = await sequelize.transaction({
      isolationLevel: require('sequelize').Transaction.ISOLATION_LEVELS.SERIALIZABLE
    });

    try {
      // 在事务中检查容量（带行锁）
      const checkCapacity = async (subject, excludeUserId) => {
        if (subject.maxCapacity <= 0) return true;
        const count = await Selection.count({
          where: {
            [require('sequelize').Op.or]: [
              { physicsOrHistory: subject.id },
              { electiveOne: subject.id },
              { electiveTwo: subject.id }
            ],
            userId: { [require('sequelize').Op.ne]: excludeUserId }
          },
          transaction,
          lock: transaction.LOCK.UPDATE
        });
        return count < subject.maxCapacity;
      };

      if (!await checkCapacity(phSubject, req.userId)) {
        await transaction.rollback();
        return error(res, `${phSubject.name} 已达到选课人数上限`);
      }
      if (!await checkCapacity(elec1, req.userId)) {
        await transaction.rollback();
        return error(res, `${elec1.name} 已达到选课人数上限`);
      }
      if (!await checkCapacity(elec2, req.userId)) {
        await transaction.rollback();
        return error(res, `${elec2.name} 已达到选课人数上限`);
      }

      // 查找或创建选科记录
      let selection = await Selection.findOne({ 
        where: { userId: req.userId },
        transaction,
        lock: transaction.LOCK.UPDATE
      });

      if (selection) {
        selection.physicsOrHistory = physicsOrHistory;
        selection.electiveOne = electiveOne;
        selection.electiveTwo = electiveTwo;
        selection.status = 'submitted';
        selection.submittedAt = new Date();
        await selection.save({ transaction });
      } else {
        selection = await Selection.create({
          userId: req.userId,
          physicsOrHistory,
          electiveOne,
          electiveTwo,
          status: 'submitted',
          submittedAt: new Date()
        }, { transaction });
      }

      // 提交事务
      await transaction.commit();

      // 重新加载关联
      await selection.reload({
        include: [
          { model: Subject, as: 'physicsHistorySubject' },
          { model: Subject, as: 'electiveOneSubject' },
          { model: Subject, as: 'electiveTwoSubject' }
        ]
      });

      success(res, selection, '选科提交成功');
    } catch (err) {
      // 回滚事务
      if (transaction && !transaction.finished) {
        await transaction.rollback();
      }
      console.error('提交选科失败:', err);
      error(res, '提交选科失败', 500);
    }
  } catch (err) {
    console.error('选科提交错误:', err);
    error(res, '选科验证失败', 500);
  }
});

/**
 * 取消选科
 * DELETE /api/selections/my
 */
router.delete('/my', projectDb, authenticateProject, async (req, res) => {
  try {
    const projectId = req.projectId;
    const { Selection } = req.projectModels;
    const timeStatus = await checkSelectionTime(projectId);
    if (!timeStatus.open) {
      return error(res, timeStatus.message);
    }

    const selection = await Selection.findOne({ where: { userId: req.userId } });
    if (!selection) {
      return notFound(res, '未找到选科记录');
    }

    selection.status = 'cancelled';
    await selection.save();

    success(res, null, '选科已取消');
  } catch (err) {
    console.error('取消选科错误:', err);
    error(res, '取消选科失败', 500);
  }
});

/**
 * 获取所有选科记录（管理员）
 * GET /api/selections
 */
router.get('/', projectDb, authenticateProject, requireProjectAdmin, async (req, res) => {
  try {
    const { User, Subject, Selection } = req.projectModels;
    const { status, className, page = 1, limit = 20 } = req.query;

    const where = {};
    if (status) where.status = status;

    const include = [
      {
        model: User,
        as: 'user',
        attributes: ['id', 'studentId', 'name', 'className']
      },
      { model: Subject, as: 'physicsHistorySubject' },
      { model: Subject, as: 'electiveOneSubject' },
      { model: Subject, as: 'electiveTwoSubject' }
    ];

    if (className) {
      include[0].where = { className };
    }

    const offset = (page - 1) * limit;
    const { count, rows } = await Selection.findAndCountAll({
      where,
      include,
      offset,
      limit: parseInt(limit),
      order: [['submittedAt', 'DESC']]
    });

    success(res, {
      total: count,
      page: parseInt(page),
      limit: parseInt(limit),
      data: rows
    });
  } catch (err) {
    console.error('获取选科列表错误:', err);
    error(res, '获取选科列表失败', 500);
  }
});

/**
 * 导出选科列表为Excel（管理员）
 * GET /api/selections/export
 */
router.get('/export', projectDb, authenticateProject, requireProjectAdmin, async (req, res) => {
  try {
    const { status, className } = req.query;
    const XLSX = require('xlsx');

    const where = {};
    if (status) where.status = status;

    const include = [
      {
        model: User,
        as: 'user',
        attributes: ['id', 'studentId', 'name', 'className']
      },
      { model: Subject, as: 'physicsHistorySubject' },
      { model: Subject, as: 'electiveOneSubject' },
      { model: Subject, as: 'electiveTwoSubject' }
    ];

    if (className) {
      include[0].where = { className };
    }

    const selections = await Selection.findAll({
      where,
      include,
      order: [['submittedAt', 'DESC']]
    });

    // 准备Excel数据
    const excelData = selections.map((sel, i) => ({
      '序号': i + 1,
      '学号': sel.user?.studentId || '',
      '姓名': sel.user?.name || '',
      '班级': sel.user?.className || '',
      '首选科目': sel.physicsHistorySubject?.name || '',
      '再选科目1': sel.electiveOneSubject?.name || '',
      '再选科目2': sel.electiveTwoSubject?.name || '',
      '状态': sel.status === 'submitted' ? '已提交' : sel.status === 'confirmed' ? '已确认' : '已取消',
      '提交时间': sel.submittedAt ? new Date(sel.submittedAt).toLocaleString('zh-CN') : ''
    }));

    // 创建工作簿
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(excelData);
    ws['!cols'] = [
      { wch: 6 }, { wch: 12 }, { wch: 10 }, { wch: 12 },
      { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 8 }, { wch: 18 }
    ];
    XLSX.utils.book_append_sheet(wb, ws, '选科列表');

    // 生成Buffer并发送
    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=selections_${Date.now()}.xlsx`);
    res.send(buffer);
  } catch (err) {
    console.error('导出选科列表错误:', err);
    error(res, '导出失败', 500);
  }
});

/**
 * 选科统计（管理员）
 * GET /api/selections/stats
 */
router.get('/stats', projectDb, async (req, res) => {
  try {
    // 手动验证token和管理员权限（因为需要在项目数据库中验证）
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ code: 401, message: '请先登录' });
    }

    const token = authHeader.substring(7);
    const jwt = require('jsonwebtoken');
    const JWT_SECRET = process.env.JWT_SECRET;
    
    if (!JWT_SECRET) {
      console.error('JWT_SECRET未配置！请在.env文件中设置JWT_SECRET');
      return res.status(500).json({ code: 500, message: '服务器配置错误' });
    }

    let decoded;
    try {
      decoded = jwt.verify(token, JWT_SECRET);
    } catch (err) {
      return res.status(401).json({ code: 401, message: '无效的认证信息' });
    }

    const { User, Subject, Selection } = req.projectModels;

    // 在项目数据库中查找用户
    const user = await User.findByPk(decoded.userId);
    if (!user || user.role !== 'admin') {
      return res.status(403).json({ code: 403, message: '无权访问' });
    }

    const subjects = await Subject.findAll();
    const stats = [];

    for (const subject of subjects) {
      const count = await Selection.count({
        where: {
          status: { [require('sequelize').Op.in]: ['submitted', 'confirmed'] },
          [require('sequelize').Op.or]: [
            { physicsOrHistory: subject.id },
            { electiveOne: subject.id },
            { electiveTwo: subject.id }
          ]
        }
      });

      stats.push({
        id: subject.id,
        name: subject.name,
        category: subject.category,
        maxCapacity: subject.maxCapacity,
        currentCount: count,
        remaining: subject.maxCapacity > 0 ? subject.maxCapacity - count : '不限'
      });
    }

    const totalStudents = await User.count({ where: { role: 'student' } });
    const submittedCount = await Selection.count({
      where: { status: { [require('sequelize').Op.in]: ['submitted', 'confirmed'] } }
    });

    success(res, {
      overview: {
        totalStudents,
        submittedCount,
        pendingCount: totalStudents - submittedCount
      },
      subjects: stats
    });
  } catch (err) {
    console.error('获取统计错误:', err);
    error(res, '获取统计失败', 500);
  }
});

/**
 * 导出选科组合统计为Excel（管理员）
 * GET /api/selections/combinations/export
 */
router.get('/combinations/export', projectDb, authenticateProject, requireProjectAdmin, async (req, res) => {
  try {
    const { User, Subject, Selection } = req.projectModels;
    const { Op } = require('sequelize');
    const XLSX = require('xlsx');

    // 获取所有有效选科记录
    const selections = await Selection.findAll({
      where: { status: { [Op.in]: ['submitted', 'confirmed'] } },
      include: [
        { model: Subject, as: 'physicsHistorySubject', attributes: ['id', 'name'] },
        { model: Subject, as: 'electiveOneSubject', attributes: ['id', 'name'] },
        { model: Subject, as: 'electiveTwoSubject', attributes: ['id', 'name'] },
        { model: User, as: 'user', attributes: ['studentId', 'name', 'className'] }
      ]
    });

    // 统计组合
    const combinationMap = {};

    for (const sel of selections) {
      const phName = sel.physicsHistorySubject?.name || '未知';
      const electives = [
        sel.electiveOneSubject?.name || '未知',
        sel.electiveTwoSubject?.name || '未知'
      ].sort();

      const combinationKey = `${phName}+${electives[0]}+${electives[1]}`;

      if (!combinationMap[combinationKey]) {
        combinationMap[combinationKey] = {
          physicsHistory: phName,
          elective1: electives[0],
          elective2: electives[1],
          students: []
        };
      }
      combinationMap[combinationKey].students.push({
        studentId: sel.user?.studentId || '',
        name: sel.user?.name || '',
        className: sel.user?.className || ''
      });
    }

    // 转为数组并按人数排序
    const combinations = Object.values(combinationMap)
      .sort((a, b) => b.students.length - a.students.length);

    // 统计数据
    let physicsCount = 0;
    let historyCount = 0;
    for (const combo of combinations) {
      if (combo.physicsHistory === '物理') {
        physicsCount += combo.students.length;
      } else {
        historyCount += combo.students.length;
      }
    }

    // 创建工作簿
    const wb = XLSX.utils.book_new();

    // Sheet 1: 组合统计汇总
    const summaryData = combinations.map((combo, i) => ({
      '排名': i + 1,
      '选科组合': `${combo.physicsHistory}+${combo.elective1}+${combo.elective2}`,
      '首选科目': combo.physicsHistory,
      '再选科目1': combo.elective1,
      '再选科目2': combo.elective2,
      '人数': combo.students.length,
      '占比': selections.length > 0 ? (combo.students.length / selections.length * 100).toFixed(1) + '%' : '0%'
    }));

    // 添加汇总行
    summaryData.push({});
    summaryData.push({ '排名': '汇总', '选科组合': '', '首选科目': '', '再选科目1': '', '再选科目2': '', '人数': '', '占比': '' });
    summaryData.push({ '排名': '', '选科组合': '物理方向总人数', '首选科目': '', '再选科目1': '', '再选科目2': '', '人数': physicsCount, '占比': selections.length > 0 ? (physicsCount / selections.length * 100).toFixed(1) + '%' : '0%' });
    summaryData.push({ '排名': '', '选科组合': '历史方向总人数', '首选科目': '', '再选科目1': '', '再选科目2': '', '人数': historyCount, '占比': selections.length > 0 ? (historyCount / selections.length * 100).toFixed(1) + '%' : '0%' });
    summaryData.push({ '排名': '', '选科组合': '总人数', '首选科目': '', '再选科目1': '', '再选科目2': '', '人数': selections.length, '占比': '100%' });
    summaryData.push({ '排名': '', '选科组合': '组合数量', '首选科目': '', '再选科目1': '', '再选科目2': '', '人数': combinations.length, '占比': '' });

    const ws1 = XLSX.utils.json_to_sheet(summaryData);
    ws1['!cols'] = [{ wch: 6 }, { wch: 25 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 8 }, { wch: 8 }];
    XLSX.utils.book_append_sheet(wb, ws1, '组合统计汇总');

    // Sheet 2: 各组合详细名单
    const detailData = [];
    for (const combo of combinations) {
      const comboName = `${combo.physicsHistory}+${combo.elective1}+${combo.elective2}`;
      for (const student of combo.students) {
        detailData.push({
          '选科组合': comboName,
          '首选科目': combo.physicsHistory,
          '再选科目1': combo.elective1,
          '再选科目2': combo.elective2,
          '学号': student.studentId,
          '姓名': student.name,
          '班级': student.className
        });
      }
    }

    const ws2 = XLSX.utils.json_to_sheet(detailData);
    ws2['!cols'] = [{ wch: 25 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 12 }, { wch: 10 }, { wch: 12 }];
    XLSX.utils.book_append_sheet(wb, ws2, '选科详细名单');

    // 生成Buffer并发送
    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=combination_stats_${Date.now()}.xlsx`);
    res.send(buffer);
  } catch (err) {
    console.error('导出组合统计错误:', err);
    error(res, '导出失败', 500);
  }
});

/**
 * 选科组合统计（管理员）
 * GET /api/selections/combinations
 */
router.get('/combinations', projectDb, authenticateProject, requireProjectAdmin, async (req, res) => {
  try {
    const { Subject, Selection } = req.projectModels;
    const { Op } = require('sequelize');

    // 获取所有有效选科记录
    const selections = await Selection.findAll({
      where: { status: { [Op.in]: ['submitted', 'confirmed'] } },
      include: [
        { model: Subject, as: 'physicsHistorySubject', attributes: ['id', 'name'] },
        { model: Subject, as: 'electiveOneSubject', attributes: ['id', 'name'] },
        { model: Subject, as: 'electiveTwoSubject', attributes: ['id', 'name'] }
      ]
    });

    // 统计组合
    const combinationMap = {};

    for (const sel of selections) {
      const phName = sel.physicsHistorySubject?.name || '未知';
      // 对再选科目排序，确保相同组合归为一类
      const electives = [
        sel.electiveOneSubject?.name || '未知',
        sel.electiveTwoSubject?.name || '未知'
      ].sort();

      const combinationKey = `${phName}+${electives[0]}+${electives[1]}`;
      const combinationLabel = `${phName} + ${electives[0]} + ${electives[1]}`;

      if (!combinationMap[combinationKey]) {
        combinationMap[combinationKey] = {
          combination: combinationLabel,
          physicsHistory: phName,
          electives: electives,
          count: 0
        };
      }
      combinationMap[combinationKey].count++;
    }

    // 转为数组并按人数排序
    const combinations = Object.values(combinationMap)
      .sort((a, b) => b.count - a.count);

    // 统计物理方向和历史方向
    let physicsCount = 0;
    let historyCount = 0;

    for (const combo of combinations) {
      if (combo.physicsHistory === '物理') {
        physicsCount += combo.count;
      } else if (combo.physicsHistory === '历史') {
        historyCount += combo.count;
      }
    }

    success(res, {
      total: selections.length,
      physicsCount,
      historyCount,
      combinationCount: combinations.length,
      combinations
    });
  } catch (err) {
    console.error('获取组合统计错误:', err);
    error(res, '获取组合统计失败', 500);
  }
});

module.exports = router;

