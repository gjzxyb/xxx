const { Sequelize } = require('sequelize');
const path = require('path');

const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: path.join(__dirname, '../data/database.sqlite'),
  logging: false,
  define: {
    timestamps: true,
    underscored: false
  }
});

module.exports = sequelize;
