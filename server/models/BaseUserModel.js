const { DataTypes } = require('sequelize');
const bcrypt = require('bcryptjs');

/**
 * 用户模型工厂函数
 * @param {Sequelize} sequelize - Sequelize 实例
 * @param {Object} options - 配置选项
 * @param {boolean} options.includeProjectId - 是否包含 projectId 字段（主数据库需要，项目数据库不需要）
 * @returns {Model} User 模型
 */
function createUserModel(sequelize, options = {}) {
  const { includeProjectId = false } = options;

  // 基础字段定义
  const fields = {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    studentId: {
      type: DataTypes.STRING(20),
      allowNull: false,
      comment: '学号'
    },
    name: {
      type: DataTypes.STRING(50),
      allowNull: false,
      comment: '姓名'
    },
    password: {
      type: DataTypes.STRING(100),
      allowNull: false,
      comment: '密码(加密)'
    },
    className: {
      type: DataTypes.STRING(50),
      allowNull: true,
      comment: '班级'
    },
    role: {
      type: DataTypes.ENUM('student', 'admin'),
      defaultValue: 'student',
      comment: '角色'
    },
    phone: {
      type: DataTypes.STRING(20),
      allowNull: true,
      comment: '手机号'
    }
  };

  // 如果是主数据库，添加 projectId 字段
  if (includeProjectId) {
    fields.projectId = {
      type: DataTypes.STRING,
      allowNull: true,
      field: 'project_id',
      comment: '所属项目ID（租户隔离）'
    };
  }

  // 模型选项
  const modelOptions = {
    tableName: 'users',
    hooks: {
      beforeCreate: async (user) => {
        if (user.password) {
          user.password = await bcrypt.hash(user.password, 10);
        }
      },
      beforeUpdate: async (user) => {
        if (user.changed('password')) {
          user.password = await bcrypt.hash(user.password, 10);
        }
      }
    }
  };

  // 根据是否包含 projectId 设置不同的索引
  if (includeProjectId) {
    modelOptions.indexes = [
      {
        unique: true,
        fields: ['studentId', 'project_id'],
        name: 'unique_student_per_project'
      }
    ];
  } else {
    // 项目数据库中 studentId 直接唯一
    fields.studentId.unique = true;
  }

  // 创建模型
  const User = sequelize.define('User', fields, modelOptions);

  // 添加实例方法：验证密码
  User.prototype.validatePassword = async function(password) {
    return bcrypt.compare(password, this.password);
  };

  // 添加实例方法：返回安全的用户信息（隐藏密码）
  User.prototype.toSafeObject = function() {
    const { password, ...safeUser } = this.toJSON();
    return safeUser;
  };

  return User;
}

module.exports = createUserModel;
