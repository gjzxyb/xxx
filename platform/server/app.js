const express = require('express');
const cors = require('cors');
const path = require('path');
const { platformDb, PlatformUser, PlatformConfig } = require('./models');

const app = express();
const PORT = process.env.PLATFORM_PORT || 4000;

// 中间件
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 静态文件服务
app.use(express.static(path.join(__dirname, '../client')));

// API路由
app.use('/api/auth', require('./routes/auth'));
app.use('/api/projects', require('./routes/projects'));
app.use('/api/projects', require('./routes/projectLifecycle')); // 项目生命周期
app.use('/api/superadmin', require('./routes/superadmin'));

// 注意：项目内系统路由需要通过代理实现，暂时未实现
// TODO: 实现项目路由代理到现有系统

// 初始化数据库
async function initializeDatabase() {
  try {
    await platformDb.sync();
    console.log('✓ 平台数据库已连接');

    // 检查并添加 is_disabled 列（如果不存在）
    try {
      await platformDb.query("SELECT is_disabled FROM platform_users LIMIT 1");
    } catch (e) {
      if (e.message.includes('no such column')) {
        console.log('  添加 is_disabled 列...');
        await platformDb.query("ALTER TABLE platform_users ADD COLUMN is_disabled INTEGER DEFAULT 0");
        console.log('  ✓ is_disabled 列已添加');
      }
    }

    // 检查是否需要创建超级管理员
    const adminCount = await PlatformUser.count({
      where: { isSuperAdmin: true }
    });

    if (adminCount === 0) {
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

    // 设置默认配置
    const defaultMaxProjects = await PlatformConfig.findByPk('default_max_projects');
    if (!defaultMaxProjects) {
      await PlatformConfig.setValue('default_max_projects', '3', '新用户默认项目数量限制');
      await PlatformConfig.setValue('allowed_email_domains', '', '允许注册的邮箱域名（逗号分隔，留空表示不限制）');
    }
  } catch (error) {
    console.error('数据库初始化失败:', error);
    process.exit(1);
  }
}

// 启动服务器
async function startServer() {
  await initializeDatabase();

  app.listen(PORT, () => {
    console.log('========================================');
    console.log('  多租户分科自选 SaaS 平台');
    console.log('========================================');
    console.log(`  平台访问: http://localhost:${PORT}`);
    console.log(`  API地址:  http://localhost:${PORT}/api`);
    console.log('----------------------------------------');
    console.log('  默认超管: admin@platform.com / admin123');
    console.log('========================================');
  });
}

startServer();
