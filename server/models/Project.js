const { DataTypes } = require('sequelize');
const { v4: uuidv4 } = require('uuid');

module.exports = (sequelize) => {
  const Project = sequelize.define('Project', {
    id: {
      type: DataTypes.STRING,
      primaryKey: true,
      defaultValue: () => uuidv4()
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false
    },
    description: {
      type: DataTypes.TEXT
    },
    ownerId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'owner_id'
    },
    status: {
      type: DataTypes.ENUM('active', 'inactive', 'archived', 'running', 'stopped'),
      defaultValue: 'active',
      comment: '项目状态：active-活跃, inactive-未激活, archived-已归档, running-运行中, stopped-已停止'
    },
    port: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: '项目运行端口'
    },
    registrationEnabled: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
      allowNull: false,
      comment: '是否允许学生注册（协作系统注册控制）'
    },
    selectionStartTime: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: '选科开始时间（为null表示立即开始）'
    },
    selectionEndTime: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: '选科结束时间（为null表示无截止时间）'
    },
    createdAt: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
      field: 'created_at'
    }
  }, {
    tableName: 'projects',
    timestamps: false
  });

  return Project;
};
