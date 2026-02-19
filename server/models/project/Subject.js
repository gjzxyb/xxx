const { DataTypes } = require('sequelize');

/**
 * 科目模型（用于项目数据库）
 * 新高考3+1+2模式
 * 注意：projectId 字段已移除，每个项目有独立数据库
 */
module.exports = (sequelize) => {
  const Subject = sequelize.define('Subject', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    name: {
      type: DataTypes.STRING(50),
      allowNull: false,
      unique: true,  // 在项目内唯一
      comment: '科目名称'
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
    hooks: {
      // 安全性：防止容量超限的竞态条件
      beforeUpdate: async (subject, options) => {
        if (subject.changed('currentCount')) {
          // 检查是否超过容量限制
          if (subject.maxCapacity > 0 && subject.currentCount > subject.maxCapacity) {
            throw new Error('科目容量已满，无法继续选择');
          }
        }
      }
    },
    validate: {
      // 数据完整性验证
      capacityCheck() {
        if (this.maxCapacity > 0 && this.currentCount > this.maxCapacity) {
          throw new Error('当前人数不能超过最大容量');
        }
      }
    }
  });

  return Subject;
};
