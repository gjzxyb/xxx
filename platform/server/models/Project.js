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
    dbFilename: {
      type: DataTypes.STRING,
      allowNull: false,
      field: 'db_filename'
    },
    port: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: '项目服务端口'
    },
    status: {
      type: DataTypes.ENUM('stopped', 'starting', 'running', 'error'),
      defaultValue: 'stopped',
      comment: '项目状态'
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
