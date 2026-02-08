const { Sequelize } = require('sequelize');
const path = require('path');
const fs = require('fs');

/**
 * 数据库配置 - 支持多种数据库类型
 * 
 * 支持的数据库类型:
 * - sqlite: 开发环境 (默认)
 * - postgres: 生产环境推荐
 * - mysql: 生产环境备选
 * 
 * 环境变量配置:
 * - DB_DIALECT: 数据库类型 (sqlite/postgres/mysql)
 * - DB_HOST: 数据库主机 (postgres/mysql)
 * - DB_PORT: 数据库端口 (postgres/mysql)
 * - DB_NAME: 数据库名称 (postgres/mysql)
 * - DB_USER: 数据库用户 (postgres/mysql)
 * - DB_PASSWORD: 数据库密码 (postgres/mysql)
 * - DB_PATH: SQLite 数据库文件路径
 * - DB_POOL_MAX: 最大连接数 (默认50)
 * - DB_POOL_MIN: 最小连接数 (默认5)
 * - DB_LOGGING: 是否启用SQL日志
 */

const DB_DIALECT = process.env.DB_DIALECT || 'sqlite';
const DB_LOGGING = process.env.DB_LOGGING === 'true' ? console.log : false;

// 连接池配置 (PostgreSQL/MySQL)
const poolConfig = {
  max: parseInt(process.env.DB_POOL_MAX || '50', 10),      // 最大连接数
  min: parseInt(process.env.DB_POOL_MIN || '5', 10),       // 最小连接数
  acquire: 30000,   // 获取连接的最大等待时间(ms)
  idle: 10000,      // 连接空闲超时时间(ms)
  evict: 1000       // 连接池检查空闲连接的间隔(ms)
};

let sequelizeConfig;

switch (DB_DIALECT) {
  case 'postgres':
  case 'postgresql':
    // PostgreSQL 配置 (生产环境推荐)
    if (!process.env.DB_HOST || !process.env.DB_NAME || !process.env.DB_USER) {
      throw new Error('PostgreSQL 需要配置 DB_HOST, DB_NAME, DB_USER 环境变量');
    }
    
    // 生产环境强制要求密码
    if (process.env.NODE_ENV === 'production' && !process.env.DB_PASSWORD) {
      throw new Error('生产环境必须设置 DB_PASSWORD 环境变量');
    }
    
    sequelizeConfig = {
      dialect: 'postgres',
      host: process.env.DB_HOST,
      port: parseInt(process.env.DB_PORT || '5432', 10),
      database: process.env.DB_NAME,
      username: process.env.DB_USER,
      password: process.env.DB_PASSWORD || '',
      pool: poolConfig,
      logging: DB_LOGGING,
      dialectOptions: {
        ssl: process.env.DB_SSL === 'true' ? {
          require: true,
          rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED !== 'false'
        } : false,
        // 连接超时设置
        connectTimeout: 10000
      },
      define: {
        timestamps: true,
        underscored: false
      }
    };
    
    console.log('✓ 数据库配置: PostgreSQL @', process.env.DB_HOST);
    console.log('✓ 连接池配置:', `max=${poolConfig.max}, min=${poolConfig.min}`);
    break;

  case 'mysql':
  case 'mariadb':
    // MySQL/MariaDB 配置
    if (!process.env.DB_HOST || !process.env.DB_NAME || !process.env.DB_USER) {
      throw new Error('MySQL 需要配置 DB_HOST, DB_NAME, DB_USER 环境变量');
    }
    
    // 生产环境强制要求密码
    if (process.env.NODE_ENV === 'production' && !process.env.DB_PASSWORD) {
      throw new Error('生产环境必须设置 DB_PASSWORD 环境变量');
    }
    
    sequelizeConfig = {
      dialect: 'mysql',
      host: process.env.DB_HOST,
      port: parseInt(process.env.DB_PORT || '3306', 10),
      database: process.env.DB_NAME,
      username: process.env.DB_USER,
      password: process.env.DB_PASSWORD || '',
      pool: poolConfig,
      logging: DB_LOGGING,
      dialectOptions: {
        connectTimeout: 10000,
        // 字符集配置
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
    
    console.log('✓ 数据库配置: MySQL @', process.env.DB_HOST);
    console.log('✓ 连接池配置:', `max=${poolConfig.max}, min=${poolConfig.min}`);
    break;

  case 'sqlite':
  default:
    // SQLite 配置 (开发环境默认)
    const dbPath = process.env.DB_PATH || path.join(__dirname, '../data/database.sqlite');
    
    // 确保数据库目录存在
    const dbDir = path.dirname(dbPath);
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true, mode: 0o750 });
      console.log('✓ 数据库目录已创建:', dbDir);
    }
    
    // 生产环境安全检查
    if (process.env.NODE_ENV === 'production') {
      console.warn('⚠️  警告: 生产环境不推荐使用 SQLite，建议切换到 PostgreSQL 或 MySQL');
      
      // 检查数据库文件权限（仅Unix系统）
      if (process.platform !== 'win32' && fs.existsSync(dbPath)) {
        const stats = fs.statSync(dbPath);
        const mode = (stats.mode & parseInt('777', 8)).toString(8);
        if (mode !== '600' && mode !== '640' && mode !== '660') {
          console.warn('⚠️  警告: 数据库文件权限过于宽松 (当前:', mode, ')');
          console.warn('⚠️  建议执行: chmod 600', dbPath);
        }
      }
      
      // 确保使用绝对路径
      if (!path.isAbsolute(dbPath)) {
        console.warn('⚠️  警告: 生产环境建议使用绝对路径配置数据库位置');
      }
    }
    
    sequelizeConfig = {
      dialect: 'sqlite',
      storage: dbPath,
      logging: DB_LOGGING,
      define: {
        timestamps: true,
        underscored: false
      }
    };
    
    console.log('✓ 数据库配置: SQLite @', dbPath);
    break;
}

const sequelize = new Sequelize(sequelizeConfig);

// 测试数据库连接
sequelize.authenticate()
  .then(() => {
    console.log('✓ 数据库连接成功');
  })
  .catch(err => {
    console.error('✗ 数据库连接失败:', err.message);
    if (DB_DIALECT !== 'sqlite') {
      console.error('请检查数据库配置和网络连接');
    }
  });

// 连接池监控（仅生产环境且非 SQLite）
if (process.env.NODE_ENV === 'production' && DB_DIALECT !== 'sqlite') {
  const monitorInterval = parseInt(process.env.DB_POOL_MONITOR_INTERVAL || '60000', 10);
  
  setInterval(() => {
    try {
      const pool = sequelize.connectionManager.pool;
      if (pool) {
        const stats = {
          timestamp: new Date().toISOString(),
          size: pool.size || 0,
          available: pool.available || 0,
          using: pool.using || 0,
          waiting: pool.waiting || 0
        };
        
        console.log('[连接池监控]', JSON.stringify(stats));
        
        // 连接池使用率告警
        const utilizationRate = (stats.using / poolConfig.max) * 100;
        if (utilizationRate > 80) {
          console.warn(`⚠️  连接池使用率过高: ${utilizationRate.toFixed(1)}% (${stats.using}/${poolConfig.max})`);
        }
        
        // 等待连接告警
        if (stats.waiting > 5) {
          console.warn(`⚠️  有 ${stats.waiting} 个请求正在等待数据库连接`);
        }
      }
    } catch (err) {
      console.error('连接池监控出错:', err.message);
    }
  }, monitorInterval);
  
  console.log(`✓ 连接池监控已启用 (间隔: ${monitorInterval}ms)`);
}

module.exports = sequelize;
