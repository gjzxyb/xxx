const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

/**
 * 科目模型 - 新高考3+1+2模式
 * 3: 语文、数学、外语（必选，不在此表）
 * 1: 物理或历史（二选一）
 * 2: 化学、生物、政治、地理（四选二）
 */
const Subject = sequelize.define('Subject', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  name: {
    type: DataTypes.STRING(50),
    allowNull: false,
    comment: '科目名称'
  },
  projectId: {
    type: DataTypes.STRING,
    allowNull: true,
    field: 'project_id',
    comment: '项目ID（租户隔离）'
  },
  category: {
    type: DataTypes.ENUM('physics_history', 'four_electives'),
    allowNull: false,
    comment: '分类: physics_history=物理/历史二选一, four_electives=四选二'
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: '科目描述'
  },
  maxCapacity: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    comment: '最大容量，0表示不限'
  },
  currentCount: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    comment: '当前已选人数'
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
    comment: '是否启用'
  }
}, {
  tableName: 'subjects',
  indexes: [
    {
      unique: true,
      fields: ['name', 'project_id']
    }
  ]
});

module.exports = Subject;
