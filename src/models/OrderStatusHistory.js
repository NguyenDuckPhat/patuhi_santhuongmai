const { DataTypes, Model } = require('sequelize');

const ORDER_STATUSES = ['pending', 'confirmed', 'shipping', 'completed', 'cancelled'];

module.exports = (sequelize) => {
  class OrderStatusHistory extends Model {}

  OrderStatusHistory.init(
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
      },
      order_id: {
        type: DataTypes.INTEGER,
        allowNull: false
      },
      from_status: {
        type: DataTypes.ENUM(...ORDER_STATUSES),
        allowNull: true
      },
      to_status: {
        type: DataTypes.ENUM(...ORDER_STATUSES),
        allowNull: false
      },
      changed_by: {
        type: DataTypes.INTEGER,
        allowNull: true
      },
      changed_by_role: {
        type: DataTypes.ENUM('buyer', 'seller', 'system'),
        allowNull: true
      },
      note: {
        type: DataTypes.STRING(255),
        allowNull: true
      }
    },
    {
      sequelize,
      modelName: 'OrderStatusHistory',
      tableName: 'order_status_history',
      timestamps: true,
      underscored: true,
      updatedAt: false
    }
  );

  return OrderStatusHistory;
};
