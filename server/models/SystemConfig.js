const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

/**
 * 系统配置模型
 * 存储选科时间等系统配置
 */
const SystemConfig = sequelize.define('SystemConfig', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  key: {
    type: DataTypes.STRING(50),
    allowNull: false,
    comment: '配置键'
  },
  projectId: {
    type: DataTypes.STRING,
    allowNull: true,
    field: 'project_id',
    comment: '项目ID，null表示全局配置'
  },
  value: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: '配置值'
  },
  description: {
    type: DataTypes.STRING(200),
    allowNull: true,
    comment: '配置描述'
  }
}, {
  tableName: 'system_configs',
  indexes: [
    {
      unique: true,
      fields: ['key', 'project_id']
    }
  ]
});

// 静态方法：获取配置值
SystemConfig.getValue = async function(key, projectId = null, defaultValue = null) {
  const where = { key };
  if (projectId !== undefined) {
    where.projectId = projectId;
  }
  const config = await this.findOne({ where });
  return config ? config.value : defaultValue;
};

// 静态方法：设置配置值
SystemConfig.setValue = async function(key, value, projectId = null, description = null) {
  const where = { key };
  if (projectId !== undefined) {
    where.projectId = projectId;
  }
  const [config, created] = await this.findOrCreate({
    where,
    defaults: { value, description, projectId }
  });
  if (!created) {
    config.value = value;
    if (description) config.description = description;
    await config.save();
  }
  return config;
};

module.exports = SystemConfig;
