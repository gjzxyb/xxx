const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

/**
 * 选科记录模型
 * 记录学生的选科结果
 */
const Selection = sequelize.define('Selection', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  userId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    comment: '用户ID'
  },
  physicsOrHistory: {
    type: DataTypes.INTEGER,
    allowNull: true,
    comment: '物理或历史科目ID（二选一）'
  },
  electiveOne: {
    type: DataTypes.INTEGER,
    allowNull: true,
    comment: '四选二-第一科'
  },
  electiveTwo: {
    type: DataTypes.INTEGER,
    allowNull: true,
    comment: '四选二-第二科'
  },
  status: {
    type: DataTypes.ENUM('draft', 'submitted', 'confirmed', 'cancelled'),
    defaultValue: 'draft',
    comment: '状态: draft=草稿, submitted=已提交, confirmed=已确认, cancelled=已取消'
  },
  submittedAt: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: '提交时间'
  },
  confirmedAt: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: '确认时间'
  },
  remark: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: '备注'
  }
}, {
  tableName: 'selections'
});

module.exports = Selection;
