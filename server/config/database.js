const { Sequelize } = require('sequelize');
const path = require('path');

// 支持通过环境变量指定数据库路径（用于多租户部署）
const dbPath = process.env.DB_PATH || path.join(__dirname, '../data/database.sqlite');

const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: dbPath,
  logging: false,
  define: {
    timestamps: true,
    underscored: false
  }
});

module.exports = sequelize;
