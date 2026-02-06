const { DataTypes } = require('sequelize');
const bcrypt = require('bcryptjs');

module.exports = (sequelize) => {
  const PlatformUser = sequelize.define('PlatformUser', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    email: {
      type: DataTypes.STRING,
      unique: true,
      allowNull: false,
      validate: {
        isEmail: true
      }
    },
    password: {
      type: DataTypes.STRING,
      allowNull: false
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false
    },
    maxProjects: {
      type: DataTypes.INTEGER,
      defaultValue: 3,
      field: 'max_projects'
    },
    subscriptionTier: {
      type: DataTypes.STRING,
      defaultValue: 'free',
      field: 'subscription_tier'
    },
    isSuperAdmin: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      field: 'is_super_admin'
    },
    isDisabled: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      field: 'is_disabled'
    },
    createdAt: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
      field: 'created_at'
    }
  }, {
    tableName: 'platform_users',
    timestamps: false,
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

  PlatformUser.prototype.comparePassword = async function(password) {
    return await bcrypt.compare(password, this.password);
  };

  return PlatformUser;
};
