const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const PlatformConfig = sequelize.define('PlatformConfig', {
    key: {
      type: DataTypes.STRING,
      primaryKey: true
    },
    value: {
      type: DataTypes.TEXT
    },
    description: {
      type: DataTypes.TEXT
    }
  }, {
    tableName: 'platform_config',
    timestamps: false
  });

  // 静态方法
  PlatformConfig.getValue = async function(key, defaultValue = null) {
    const config = await this.findByPk(key);
    return config ? config.value : defaultValue;
  };

  PlatformConfig.setValue = async function(key, value, description = null) {
    const [config] = await this.upsert({
      key,
      value,
      description
    });
    return config;
  };

  return PlatformConfig;
};
