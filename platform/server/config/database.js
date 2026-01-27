const { Sequelize } = require('sequelize');
const bcrypt = require('bcryptjs');
const path = require('path');
const fs = require('fs');

// 确保数据库目录存在
const dbDir = path.join(__dirname, '../../databases');
if (!fs.existsSync(dbDir)) {
  console.log('Creating databases directory:', dbDir);
  fs.mkdirSync(dbDir, { recursive: true });
} else {
  console.log('Databases directory exists:', dbDir);
}

const dbPath = path.join(dbDir, 'platform.db');
console.log('Platform DB path:', dbPath);

// 平台数据库（存储用户和项目信息）
const platformDb = new Sequelize({
  dialect: 'sqlite',
  storage: dbPath,
  logging: false
});

// 动态项目数据库连接池
const projectDbPool = new Map();

/**
 * 获取指定项目的数据库连接
 * @param {string} projectId - 项目ID
 * @returns {Sequelize} 数据库实例
 */
function getProjectDb(projectId) {
  if (!projectDbPool.has(projectId)) {
    const projectsDir = path.join(__dirname, '../../databases/projects');
    if (!fs.existsSync(projectsDir)) {
      fs.mkdirSync(projectsDir, { recursive: true });
    }

    const dbPath = path.join(projectsDir, `${projectId}.db`);
    const db = new Sequelize({
      dialect: 'sqlite',
      storage: dbPath,
      logging: false
    });
    projectDbPool.set(projectId, db);
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

  // 测试数据库连接（这会创建空文件）
  await db.authenticate();
  console.log(`项目 ${projectId} 数据库已创建`);

  return db;
}

module.exports = {
  platformDb,
  getProjectDb,
  initializeProjectDatabase
};
