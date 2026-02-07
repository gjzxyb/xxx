// 加载环境变量配置（必须在最开头）
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

// 验证环境变量配置
const { validateEnv, validateProductionEnv } = require('./utils/validateEnv');
if (!validateEnv() || !validateProductionEnv()) {
  console.error('环境变量验证失败，应用无法启动');
  process.exit(1);
}

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
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

// 安全中间件
const { apiLimiter, authLimiter } = require('./middleware/rateLimiter');
const { errorHandler, notFound } = require('./middleware/errorHandler');

const app = express();
const PORT = process.env.PORT || 3000;

// 确保数据目录存在
const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// ============================================
// 安全中间件配置
// ============================================

// Helmet - 设置安全HTTP响应头
app.use(helmet({
  contentSecurityPolicy: process.env.NODE_ENV === 'production' ? undefined : false,
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));

// CORS配置 - 限制允许的来源，避免跨站攻击
const allowedOrigins = process.env.ALLOWED_ORIGINS 
  ? process.env.ALLOWED_ORIGINS.split(',').map(origin => origin.trim())
  : (process.env.NODE_ENV === 'production' 
      ? [] // 生产环境必须明确指定
      : ['http://localhost:3000', 'http://localhost:5173', 'http://127.0.0.1:3000']); // 开发环境默认本地

if (process.env.NODE_ENV === 'production' && allowedOrigins.length === 0) {
  console.error('❌ 严重错误: 生产环境必须设置ALLOWED_ORIGINS环境变量！');
  process.exit(1);
}

app.use(cors({
  origin: (origin, callback) => {
    // 允许无origin的请求（如移动应用、Postman等）
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.includes(origin) || allowedOrigins.includes('*')) {
      callback(null, true);
    } else {
      if (process.env.NODE_ENV === 'production') {
        callback(new Error(`来源 ${origin} 不在允许列表中`));
      } else {
        console.warn(`⚠️  警告: 来源 ${origin} 不在允许列表中，但开发环境允许访问`);
        callback(null, true);
      }
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
  maxAge: 86400 // 24小时
}));
app.use(express.json({ limit: '10mb' })); // 限制请求体大小
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ============================================
// 速率限制
// ============================================

// 应用通用API速率限制
app.use('/api/', apiLimiter);

// 认证接口使用更严格的速率限制
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);
app.use('/api/platform/auth/login', authLimiter);
app.use('/api/platform/auth/register', authLimiter);

// ============================================
// 静态文件服务
// ============================================

// 静态文件服务（选科系统前端）
app.use(express.static(path.join(__dirname, '../client')));

// 平台管理前端（从 platform/client 迁移）
app.use('/platform', express.static(path.join(__dirname, '../client/platform')));

// 导入项目数据库中间件
const { projectDb } = require('./middleware/projectDb');

// API路由 - 选科系统
app.use('/api/auth', authRoutes);
app.use('/api/subjects', subjectsRoutes);
app.use('/api/selections', selectionsRoutes);
// 为所有管理员路由自动添加 projectDb 中间件
app.use('/api/admin', projectDb, adminRoutes);

// API路由 - 平台管理
app.use('/api/platform/auth', platformAuthRoutes);
app.use('/api/platform/projects', projectsRoutes);
app.use('/api/platform/superadmin', superadminRoutes);

// 健康检查
app.get('/api/health', (req, res) => {
  res.json({ code: 200, message: 'Server is running', data: { time: new Date().toISOString() } });
});

// ============================================
// 错误处理
// ============================================

// 404错误处理
app.use(notFound);

// 统一错误处理中间件（必须放在最后）
app.use(errorHandler);

// 初始化数据
async function initializeData() {
  // 注意：项目管理员不再自动创建
  // 必须通过 SaaS 平台在"安全设置"中为每个项目单独配置管理员凭据
  // 这样可以确保每个项目有独立的管理员账号和密码

  // 创建超级管理员（平台）
  // 安全性：使用环境变量或随机生成的密码，避免硬编码
  const superAdminCount = await PlatformUser.count({
    where: { isSuperAdmin: true }
  });

  if (superAdminCount === 0) {
    const crypto = require('crypto');
    
    // 从环境变量获取管理员配置，如果没有则生成随机密码
    const adminEmail = process.env.ADMIN_EMAIL || 'admin@platform.com';
    const adminPassword = process.env.ADMIN_PASSWORD || (() => {
      const randomPassword = crypto.randomBytes(16).toString('base64').slice(0, 16);
      console.warn('⚠️  警告: 未设置ADMIN_PASSWORD环境变量，已生成随机密码');
      console.warn('⚠️  请立即登录并修改密码！');
      return randomPassword;
    })();

    await PlatformUser.create({
      email: adminEmail,
      password: adminPassword,
      name: process.env.ADMIN_NAME || '超级管理员',
      isSuperAdmin: true,
      maxProjects: 999
    });
    
    console.log('✓ 默认超级管理员已创建');
    console.log('  邮箱:', adminEmail);
    console.log('  密码:', adminPassword);
    console.log('');
    console.log('🔐 安全提示:');
    console.log('  1. 请立即登录系统并修改默认密码');
    console.log('  2. 建议在.env文件中设置ADMIN_EMAIL和ADMIN_PASSWORD');
    console.log('  3. 生产环境务必使用强密码');
    console.log('');
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
      console.log('  请使用您在.env中配置的管理员账号登录');
      console.log('  如未配置，请查看上方的初始化信息');
      console.log('========================================');
    });
  } catch (err) {
    console.error('启动失败:', err);
    process.exit(1);
  }
}

startServer();
