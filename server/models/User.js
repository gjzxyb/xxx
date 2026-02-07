/**
 * 主数据库用户模型
 * 使用统一的模型工厂函数，包含 projectId 字段用于多租户隔离
 */
const sequelize = require('../config/database');
const createUserModel = require('./BaseUserModel');

// 创建包含 projectId 的用户模型（主数据库）
const User = createUserModel(sequelize, { includeProjectId: true });

module.exports = User;
