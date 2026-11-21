const { DataTypes } = require('sequelize');

module.exports = (sequelize) => sequelize.define('SellerFollow', {
  seller_id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    references: { model: 'users', key: 'id' },
    onDelete: 'CASCADE'
  },
  follower_id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    references: { model: 'users', key: 'id' },
    onDelete: 'CASCADE'
  }
}, { tableName: 'seller_follows', timestamps: false });
