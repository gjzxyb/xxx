const { Sequelize } = require('sequelize');
const path = require('path');
const fs = require('fs');

// 安全性：数据库路径配置
// 1. 优先使用环境变量指定的路径
// 2. 确保数据目录存在且有适当权限
// 3. 生产环境建议使用绝对路径并设置适当的文件权限
const dbPath = process.env.DB_PATH || path.join(__dirname, '../data/database.sqlite');

// 确保数据库目录存在
const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true, mode: 0o750 });
  console.log('✓ 数据库目录已创建:', dbDir);
}

// 生产环境安全检查
if (process.env.NODE_ENV === 'production') {
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

const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: dbPath,
  logging: process.env.DB_LOGGING === 'true' ? console.log : false,
  define: {
    timestamps: true,
    underscored: false
  }
});

console.log('✓ 数据库配置:', dbPath);

module.exports = sequelize;
