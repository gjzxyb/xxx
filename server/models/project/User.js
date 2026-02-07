/**
 * 项目数据库用户模型
 * 使用统一的模型工厂函数，不包含 projectId 字段（项目已隔离）
 */
const createUserModel = require('../BaseUserModel');

module.exports = (sequelize) => {
  // 创建不包含 projectId 的用户模型（项目数据库）
  return createUserModel(sequelize, { includeProjectId: false });
};
