const sequelize = require('../config/database');
const User = require('./User');
const Subject = require('./Subject');
const Selection = require('./Selection');
const SystemConfig = require('./SystemConfig');

// 定义关联关系
User.hasOne(Selection, { foreignKey: 'userId', as: 'selection' });
Selection.belongsTo(User, { foreignKey: 'userId', as: 'user' });

// 选科与科目关联
Selection.belongsTo(Subject, { foreignKey: 'physicsOrHistory', as: 'physicsHistorySubject' });
Selection.belongsTo(Subject, { foreignKey: 'electiveOne', as: 'electiveOneSubject' });
Selection.belongsTo(Subject, { foreignKey: 'electiveTwo', as: 'electiveTwoSubject' });

module.exports = {
  sequelize,
  User,
  Subject,
  Selection,
  SystemConfig
};
