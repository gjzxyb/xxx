const { Sequelize } = require('sequelize');
const bcrypt = require('bcryptjs');
const path = require('path');
const fs = require('fs');

/**
 * 平台数据库配置 - 支持多种数据库类型
 * 
 * 支持的数据库类型:
 * - sqlite: 开发环境 (默认)
 * - postgres: 生产环境推荐
 * - mysql: 生产环境备选
 */

const DB_DIALECT = process.env.DB_DIALECT || 'sqlite';
const DB_LOGGING = process.env.DB_LOGGING === 'true' ? console.log : false;

// 连接池配置
const poolConfig = {
  max: parseInt(process.env.DB_POOL_MAX || '50', 10),
  min: parseInt(process.env.DB_POOL_MIN || '5', 10),
  acquire: 30000,
  idle: 10000,
  evict: 1000
};

/**
 * 创建数据库配置对象
 * @param {string} dbName - 数据库名称 (PostgreSQL/MySQL) 或文件路径 (SQLite)
 * @returns {Object} Sequelize 配置对象
 */
function createDbConfig(dbName) {
  switch (DB_DIALECT) {
    case 'postgres':
    case 'postgresql':
      if (!process.env.DB_HOST || !process.env.DB_USER) {
        throw new Error('PostgreSQL 需要配置 DB_HOST, DB_USER 环境变量');
      }
      
      // 生产环境强制要求密码
      if (process.env.NODE_ENV === 'production' && !process.env.DB_PASSWORD) {
        throw new Error('生产环境必须设置 DB_PASSWORD 环境变量');
      }
      
      return {
        dialect: 'postgres',
        host: process.env.DB_HOST,
        port: parseInt(process.env.DB_PORT || '5432', 10),
        database: dbName,
        username: process.env.DB_USER,
        password: process.env.DB_PASSWORD || '',
        pool: poolConfig,
        logging: DB_LOGGING,
        dialectOptions: {
          ssl: process.env.DB_SSL === 'true' ? {
            require: true,
            rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED !== 'false'
          } : false,
          connectTimeout: 10000
        },
        define: {
          timestamps: true,
          underscored: false
        }
      };

    case 'mysql':
    case 'mariadb':
      if (!process.env.DB_HOST || !process.env.DB_USER) {
        throw new Error('MySQL 需要配置 DB_HOST, DB_USER 环境变量');
      }
      
      // 生产环境强制要求密码
      if (process.env.NODE_ENV === 'production' && !process.env.DB_PASSWORD) {
        throw new Error('生产环境必须设置 DB_PASSWORD 环境变量');
      }
      
      return {
        dialect: 'mysql',
        host: process.env.DB_HOST,
        port: parseInt(process.env.DB_PORT || '3306', 10),
        database: dbName,
        username: process.env.DB_USER,
        password: process.env.DB_PASSWORD || '',
        pool: poolConfig,
        logging: DB_LOGGING,
        dialectOptions: {
          connectTimeout: 10000,
          charset: 'utf8mb4',
          collate: 'utf8mb4_unicode_ci'
        },
        define: {
          timestamps: true,
          underscored: false,
          charset: 'utf8mb4',
          collate: 'utf8mb4_unicode_ci'
        }
      };

    case 'sqlite':
    default:
      // SQLite: dbName 是文件路径
      const dbDir = path.dirname(dbName);
      if (!fs.existsSync(dbDir)) {
        fs.mkdirSync(dbDir, { recursive: true, mode: 0o750 });
      }
      
      return {
        dialect: 'sqlite',
        storage: dbName,
        logging: DB_LOGGING,
        define: {
          timestamps: true,
          underscored: false
        }
      };
  }
}

// 初始化平台数据库
let platformDbPath;
if (DB_DIALECT === 'sqlite') {
  const dbDir = path.join(__dirname, '../../databases');
  if (!fs.existsSync(dbDir)) {
    console.log('Creating databases directory:', dbDir);
    fs.mkdirSync(dbDir, { recursive: true });
  }
  platformDbPath = path.join(dbDir, 'platform.db');
  console.log('Platform DB path:', platformDbPath);
} else {
  // PostgreSQL/MySQL: 使用平台数据库名称
  platformDbPath = process.env.DB_PLATFORM_NAME || 'student_selection_platform';
  console.log('Platform DB name:', platformDbPath);
}

// 平台数据库（存储用户和项目信息）
const platformDb = new Sequelize(createDbConfig(platformDbPath));

// 动态项目数据库连接池
const projectDbPool = new Map();

/**
 * 获取指定项目的数据库连接
 * @param {string} projectId - 项目ID
 * @returns {Sequelize} 数据库实例
 */
function getProjectDb(projectId) {
  if (!projectDbPool.has(projectId)) {
    let dbIdentifier;
    
    if (DB_DIALECT === 'sqlite') {
      // SQLite: 每个项目一个文件
      const projectsDir = path.join(__dirname, '../../databases/projects');
      if (!fs.existsSync(projectsDir)) {
        fs.mkdirSync(projectsDir, { recursive: true });
      }
      dbIdentifier = path.join(projectsDir, `${projectId}.db`);
    } else {
      // PostgreSQL/MySQL: 使用 schema 或数据库名前缀
      const prefix = process.env.DB_PROJECT_PREFIX || 'project_';
      dbIdentifier = `${prefix}${projectId}`;
    }
    
    const db = new Sequelize(createDbConfig(dbIdentifier));
    projectDbPool.set(projectId, db);
    
    console.log(`✓ 项目数据库连接已创建: ${projectId}`);
  }
  return projectDbPool.get(projectId);
}

/**
 * 初始化新项目的数据库
 * 只创建空的数据库文件，协作系统启动时会自动创建表结构
 * @param {string} projectId - 项目ID
 */
async function initializeProjectDatabase(projectId) {
  const db = getProjectDb(projectId);

  // 测试数据库连接（这会创建空文件或数据库）
  await db.authenticate();
  console.log(`✓ 项目 ${projectId} 数据库已初始化`);

  return db;
}

/**
 * 关闭指定项目的数据库连接
 * @param {string} projectId - 项目ID
 */
async function closeProjectDb(projectId) {
  if (projectDbPool.has(projectId)) {
    const db = projectDbPool.get(projectId);
    await db.close();
    projectDbPool.delete(projectId);
    console.log(`✓ 项目 ${projectId} 数据库连接已关闭`);
  }
}

/**
 * 关闭所有数据库连接
 */
async function closeAllConnections() {
  console.log('关闭所有数据库连接...');
  
  // 关闭平台数据库
  await platformDb.close();
  
  // 关闭所有项目数据库
  for (const [projectId, db] of projectDbPool.entries()) {
    await db.close();
    console.log(`✓ 项目 ${projectId} 数据库连接已关闭`);
  }
  projectDbPool.clear();
  
  console.log('✓ 所有数据库连接已关闭');
}

// 测试平台数据库连接
platformDb.authenticate()
  .then(() => {
    console.log('✓ 平台数据库连接成功');
  })
  .catch(err => {
    console.error('✗ 平台数据库连接失败:', err.message);
  });

// 连接池监控（仅生产环境且非 SQLite）
if (process.env.NODE_ENV === 'production' && DB_DIALECT !== 'sqlite') {
  const monitorInterval = parseInt(process.env.DB_POOL_MONITOR_INTERVAL || '60000', 10);
  
  setInterval(() => {
    try {
      // 监控平台数据库连接池
      const platformPool = platformDb.connectionManager.pool;
      if (platformPool) {
        const stats = {
          timestamp: new Date().toISOString(),
          database: 'platform',
          size: platformPool.size || 0,
          available: platformPool.available || 0,
          using: platformPool.using || 0,
          waiting: platformPool.waiting || 0
        };
        
        console.log('[平台连接池监控]', JSON.stringify(stats));
        
        // 连接池使用率告警
        const utilizationRate = (stats.using / poolConfig.max) * 100;
        if (utilizationRate > 80) {
          console.warn(`⚠️  平台连接池使用率过高: ${utilizationRate.toFixed(1)}% (${stats.using}/${poolConfig.max})`);
        }
        
        // 等待连接告警
        if (stats.waiting > 5) {
          console.warn(`⚠️  平台数据库有 ${stats.waiting} 个请求正在等待连接`);
        }
      }
      
      // 监控项目数据库连接池
      if (projectDbPool.size > 0) {
        console.log(`[项目数据库] 当前活跃项目数: ${projectDbPool.size}`);
        
        for (const [projectId, db] of projectDbPool.entries()) {
          try {
            const projectPool = db.connectionManager.pool;
            if (projectPool) {
              const projectStats = {
                projectId,
                size: projectPool.size || 0,
                available: projectPool.available || 0,
                using: projectPool.using || 0,
                waiting: projectPool.waiting || 0
              };
              
              if (projectStats.using > 0 || projectStats.waiting > 0) {
                console.log(`[项目连接池] ${projectId}:`, JSON.stringify(projectStats));
              }
            }
          } catch (err) {
            // 忽略单个项目的监控错误
          }
        }
      }
    } catch (err) {
      console.error('连接池监控出错:', err.message);
    }
  }, monitorInterval);
  
  console.log(`✓ 平台连接池监控已启用 (间隔: ${monitorInterval}ms)`);
}

module.exports = {
  platformDb,
  getProjectDb,
  initializeProjectDatabase,
  closeProjectDb,
  closeAllConnections
};
