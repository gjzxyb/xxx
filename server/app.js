const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

// 导入模型和路由
const { sequelize, User, Subject, SystemConfig, PlatformUser, Project } = require('./models');
const authRoutes = require('./routes/auth');
const subjectsRoutes = require('./routes/subjects');
const selectionsRoutes = require('./routes/selections');
const adminRoutes = require('./routes/admin');

// 平台路由
const platformAuthRoutes = require('./routes/platformAuth');
const projectsRoutes = require('./routes/projects');
const superadminRoutes = require('./routes/superadmin');

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

// 静态文件服务（选科系统前端）
app.use(express.static(path.join(__dirname, '../client')));

// 平台管理前端（从 platform/client 迁移）
app.use('/platform', express.static(path.join(__dirname, '../client/platform')));

// API路由 - 选科系统
app.use('/api/auth', authRoutes);
app.use('/api/subjects', subjectsRoutes);
app.use('/api/selections', selectionsRoutes);
app.use('/api/admin', adminRoutes);

// API路由 - 平台管理
app.use('/api/platform/auth', platformAuthRoutes);
app.use('/api/platform/projects', projectsRoutes);
app.use('/api/platform/superadmin', superadminRoutes);

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
  // 注意：项目管理员不再自动创建
  // 必须通过 SaaS 平台在"安全设置"中为每个项目单独配置管理员凭据
  // 这样可以确保每个项目有独立的管理员账号和密码

  // 创建超级管理员（平台）
  const superAdminCount = await PlatformUser.count({
    where: { isSuperAdmin: true }
  });

  if (superAdminCount === 0) {
    await PlatformUser.create({
      email: 'admin@platform.com',
      password: 'admin123',
      name: '超级管理员',
      isSuperAdmin: true,
      maxProjects: 999
    });
    console.log('✓ 默认超级管理员已创建');
    console.log('  邮箱: admin@platform.com');
    console.log('  密码: admin123');
  }

  // 创建默认科目 (3+1+2模式) - 仅全局配置，项目可自行管理
  const globalSubjectCount = await Subject.count({ where: { projectId: null } });
  if (globalSubjectCount === 0) {
    const subjects = [
      // 物理/历史二选一
      { name: '物理', category: 'physics_history', description: '理科方向首选科目', projectId: null },
      { name: '历史', category: 'physics_history', description: '文科方向首选科目', projectId: null },
      // 四选二
      { name: '化学', category: 'four_electives', description: '自然科学基础学科', projectId: null },
      { name: '生物', category: 'four_electives', description: '生命科学基础学科', projectId: null },
      { name: '政治', category: 'four_electives', description: '社会科学基础学科', projectId: null },
      { name: '地理', category: 'four_electives', description: '人文与自然交叉学科', projectId: null }
    ];

    for (const subj of subjects) {
      await Subject.create(subj);
    }
    console.log('✓ 默认科目模板已创建');
  }

  // 设置默认配置
  const defaultMaxProjects = await SystemConfig.getValue('default_max_projects', null);
  if (!defaultMaxProjects) {
    await SystemConfig.setValue('default_max_projects', '3', null, '新用户默认项目数量限制');
    await SystemConfig.setValue('allowed_email_domains', '', null, '允许注册的邮箱域名（逗号分隔，留空表示不限制）');
    await SystemConfig.setValue('registration_open', 'true', null, '平台注册开关');
    await SystemConfig.setValue('captcha_enabled', 'false', null, '验证码开关');
    console.log('✓ 默认平台配置已设置');
  }
}

async function startServer() {
  try {
    // 同步数据库（创建缺失的表，但不删除现有数据）
    // alter: false 表示不修改现有表结构，只创建新表
    // 注意：生产环境应使用 migrations 来管理数据库变更
    await sequelize.sync({ alter: false });
    console.log('✓ 数据库已同步');

    // 初始化数据
    await initializeData();

    // 启动服务
    app.listen(PORT, () => {
      console.log('========================================');
      console.log('  学生分科自选系统 (内嵌式 SaaS)');
      console.log('========================================');
      console.log(`  系统访问: http://localhost:${PORT}`);
      console.log(`  平台管理: http://localhost:${PORT}/platform`);
      console.log(`  API地址:  http://localhost:${PORT}/api`);
      console.log('----------------------------------------');
      console.log('  选科管理: admin / admin123');
      console.log('  超级管理: admin@platform.com / admin123');
      console.log('========================================');
    });
  } catch (err) {
    console.error('启动失败:', err);
    process.exit(1);
  }
}

startServer();
