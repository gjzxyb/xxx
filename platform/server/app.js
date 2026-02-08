const express = require('express');
const cors = require('cors');
const path = require('path');
const { platformDb, PlatformUser, PlatformConfig } = require('./models');

const app = express();
const PORT = process.env.PLATFORM_PORT || 4001;

// 中间件 - 配置CORS以限制来源
const corsOptions = {
  origin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',') : ['http://localhost:3000', 'http://localhost:4001'],
  credentials: true,
  optionsSuccessStatus: 200
};
app.use(cors(corsOptions));
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
      // 从环境变量读取初始管理员密码，若未设置则生成随机密码
      const crypto = require('crypto');
      const initialPassword = process.env.INITIAL_ADMIN_PASSWORD || crypto.randomBytes(16).toString('hex');
      
      await PlatformUser.create({
        email: process.env.INITIAL_ADMIN_EMAIL || 'admin@platform.com',
        password: initialPassword,
        name: '超级管理员',
        isSuperAdmin: true,
        maxProjects: 999
      });
      console.log('✓ 默认超级管理员已创建');
      console.log('  邮箱:', process.env.INITIAL_ADMIN_EMAIL || 'admin@platform.com');
      console.log('  密码:', initialPassword);
      console.log('  ⚠️  请立即登录并修改密码！');
      if (!process.env.INITIAL_ADMIN_PASSWORD) {
        console.log('  💡 提示: 可在.env中设置INITIAL_ADMIN_PASSWORD和INITIAL_ADMIN_EMAIL自定义初始管理员账户');
      }
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

// 优雅关闭处理
let server;
const { closeAllConnections } = require('./config/database');

async function gracefulShutdown(signal) {
  console.log(`\n收到 ${signal} 信号，正在优雅关闭...`);
  
  if (server) {
    // 停止接收新的请求
    server.close(async () => {
      console.log('✓ HTTP 服务器已关闭');
      
      try {
        // 关闭所有数据库连接（平台数据库 + 所有项目数据库）
        await closeAllConnections();
        
        console.log('✓ 应用已安全退出');
        process.exit(0);
      } catch (err) {
        console.error('✗ 关闭数据库连接时出错:', err);
        process.exit(1);
      }
    });
    
    // 强制退出超时（30秒）
    setTimeout(() => {
      console.error('⚠️  强制退出：关闭超时');
      process.exit(1);
    }, 30000);
  } else {
    process.exit(0);
  }
}

// 注册信号处理器
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// 捕获未处理的异常
process.on('uncaughtException', (err) => {
  console.error('未捕获的异常:', err);
  gracefulShutdown('uncaughtException');
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('未处理的 Promise 拒绝:', reason);
  gracefulShutdown('unhandledRejection');
});

// 启动服务器
async function startServer() {
  await initializeDatabase();

  server = app.listen(PORT, () => {
    console.log('========================================');
    console.log('  多租户分科自选 SaaS 平台');
    console.log('========================================');
    console.log(`  平台访问: http://localhost:${PORT}`);
    console.log(`  API地址:  http://localhost:${PORT}/api`);
    console.log('----------------------------------------');
    console.log('  默认超管: admin@platform.com / admin123');
    console.log('========================================');
    console.log('  提示: 按 Ctrl+C 优雅关闭服务器');
    console.log('========================================');
  });
}

startServer();
