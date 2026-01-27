const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

// 导入模型和路由
const { sequelize, User, Subject, SystemConfig } = require('./models');
const authRoutes = require('./routes/auth');
const subjectsRoutes = require('./routes/subjects');
const selectionsRoutes = require('./routes/selections');
const adminRoutes = require('./routes/admin');

const app = express();
const PORT = process.env.PORT || 3000;

// 确保数据目录存在
const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// 中间件
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 静态文件服务（前端）
app.use(express.static(path.join(__dirname, '../client')));

// API路由
app.use('/api/auth', authRoutes);
app.use('/api/subjects', subjectsRoutes);
app.use('/api/selections', selectionsRoutes);
app.use('/api/admin', adminRoutes);

// 健康检查
app.get('/api/health', (req, res) => {
  res.json({ code: 200, message: 'Server is running', data: { time: new Date().toISOString() } });
});

// 前端路由回退
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../client/index.html'));
});

// 初始化数据
async function initializeData() {
  // 创建默认管理员
  const adminExists = await User.findOne({ where: { role: 'admin' } });
  if (!adminExists) {
    await User.create({
      studentId: 'admin',
      name: '管理员',
      password: 'admin123',
      role: 'admin'
    });
    console.log('✓ 默认管理员已创建 (账号: admin, 密码: admin123)');
  }

  // 创建默认科目 (3+1+2模式)
  const subjectCount = await Subject.count();
  if (subjectCount === 0) {
    const subjects = [
      // 物理/历史二选一
      { name: '物理', category: 'physics_history', description: '理科方向首选科目' },
      { name: '历史', category: 'physics_history', description: '文科方向首选科目' },
      // 四选二
      { name: '化学', category: 'four_electives', description: '自然科学基础学科' },
      { name: '生物', category: 'four_electives', description: '生命科学基础学科' },
      { name: '政治', category: 'four_electives', description: '社会科学基础学科' },
      { name: '地理', category: 'four_electives', description: '人文与自然交叉学科' }
    ];

    for (const subj of subjects) {
      await Subject.create(subj);
    }
    console.log('✓ 默认科目已创建');
  }

  // 设置默认选科时间（如果未设置）
  const startTime = await SystemConfig.getValue('selection_start_time');
  if (!startTime) {
    const now = new Date();
    const endTime = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // 30天后
    await SystemConfig.setValue('selection_start_time', now.toISOString().slice(0, 16), '选科开始时间');
    await SystemConfig.setValue('selection_end_time', endTime.toISOString().slice(0, 16), '选科结束时间');
    console.log('✓ 默认选科时间已设置');
  }
}

// 启动服务器
async function startServer() {
  try {
    // 同步数据库
    await sequelize.sync({ alter: false });
    console.log('✓ 数据库已连接');

    // 初始化数据
    await initializeData();

    // 启动服务
    app.listen(PORT, () => {
      console.log('========================================');
      console.log('  学生分科自选系统 - 服务已启动');
      console.log('========================================');
      console.log(`  本地访问: http://localhost:${PORT}`);
      console.log(`  API地址:  http://localhost:${PORT}/api`);
      console.log('----------------------------------------');
      console.log('  默认管理员: admin / admin123');
      console.log('========================================');
    });
  } catch (err) {
    console.error('启动失败:', err);
    process.exit(1);
  }
}

startServer();
