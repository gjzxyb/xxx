const sequelize = require('../config/database');
const User = require('./User');
const Subject = require('./Subject');
const Selection = require('./Selection');
const SystemConfig = require('./SystemConfig');

// 平台模型
const PlatformUser = require('./PlatformUser')(sequelize);
const Project = require('./Project')(sequelize);
const Collaborator = require('./Collaborator')(sequelize);

// 学生用户与选科关联
User.hasOne(Selection, { foreignKey: 'userId', as: 'selection' });
Selection.belongsTo(User, { foreignKey: 'userId', as: 'user' });

// 选科与科目关联
Selection.belongsTo(Subject, { foreignKey: 'physicsOrHistory', as: 'physicsHistorySubject' });
Selection.belongsTo(Subject, { foreignKey: 'electiveOne', as: 'electiveOneSubject' });
Selection.belongsTo(Subject, { foreignKey: 'electiveTwo', as: 'electiveTwoSubject' });

// 平台用户与项目关联
Project.belongsTo(PlatformUser, { foreignKey: 'ownerId', as: 'owner' });
PlatformUser.hasMany(Project, { foreignKey: 'ownerId', as: 'projects' });

// 协作者关联
Collaborator.belongsTo(PlatformUser, { foreignKey: 'userId', as: 'user' });
Collaborator.belongsTo(Project, { foreignKey: 'projectId', as: 'project' });
Project.hasMany(Collaborator, { foreignKey: 'projectId', as: 'collaborators' });

// 学生用户与项目关联
User.belongsTo(Project, { foreignKey: 'projectId', as: 'project' });
Project.hasMany(User, { foreignKey: 'projectId', as: 'students' });

// 科目与项目关联
Subject.belongsTo(Project, { foreignKey: 'projectId', as: 'project' });
Project.hasMany(Subject, { foreignKey: 'projectId', as: 'subjects' });

module.exports = {
  sequelize,
  User,
  Subject,
  Selection,
  SystemConfig,
  PlatformUser,
  Project,
  Collaborator
};
