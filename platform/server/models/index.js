const { platformDb } = require('../config/database');

// 初始化模型
const PlatformUser = require('./PlatformUser')(platformDb);
const Project = require('./Project')(platformDb);
const Collaborator = require('./Collaborator')(platformDb);
const PlatformConfig = require('./PlatformConfig')(platformDb);

// 建立关联
Project.belongsTo(PlatformUser, { foreignKey: 'ownerId', as: 'owner' });
PlatformUser.hasMany(Project, { foreignKey: 'ownerId', as: 'projects' });

Collaborator.belongsTo(PlatformUser, { foreignKey: 'userId', as: 'user' });
Collaborator.belongsTo(Project, { foreignKey: 'projectId', as: 'project' });

module.exports = {
  platformDb,
  PlatformUser,
  Project,
  Collaborator,
  PlatformConfig
};
