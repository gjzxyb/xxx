const { DataTypes } = require('sequelize');
const bcrypt = require('bcryptjs');

/**
 * 项目用户模型（用于项目数据库）
 * 注意：projectId 字段已移除，因为每个项目有独立数据库
 */
module.exports = (sequelize) => {
  const User = sequelize.define('User', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    studentId: {
      type: DataTypes.STRING(20),
      allowNull: false,
      unique: true,  // 在项目内唯一
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
  }, {
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
  });

  // 验证密码
  User.prototype.validatePassword = async function(password) {
    return bcrypt.compare(password, this.password);
  };

  // 返回用户信息（隐藏密码）
  User.prototype.toSafeObject = function() {
    const { password, ...safeUser } = this.toJSON();
    return safeUser;
  };

  return User;
};
