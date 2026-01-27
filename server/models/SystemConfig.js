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
    unique: true,
    allowNull: false,
    comment: '配置键'
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
  tableName: 'system_configs'
});

// 静态方法：获取配置值
SystemConfig.getValue = async function(key, defaultValue = null) {
  const config = await this.findOne({ where: { key } });
  return config ? config.value : defaultValue;
};

// 静态方法：设置配置值
SystemConfig.setValue = async function(key, value, description = null) {
  const [config, created] = await this.findOrCreate({
    where: { key },
    defaults: { value, description }
  });
  if (!created) {
    config.value = value;
    if (description) config.description = description;
    await config.save();
  }
  return config;
};

module.exports = SystemConfig;
