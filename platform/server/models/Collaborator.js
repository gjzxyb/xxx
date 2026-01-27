const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Collaborator = sequelize.define('Collaborator', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    projectId: {
      type: DataTypes.STRING,
      allowNull: false,
      field: 'project_id'
    },
    userId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'user_id'
    },
    role: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'collaborator',
      validate: {
        isIn: [['owner', 'admin', 'collaborator']]
      }
    },
    invitedAt: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
      field: 'invited_at'
    }
  }, {
    tableName: 'collaborators',
    timestamps: false
  });

  return Collaborator;
};
