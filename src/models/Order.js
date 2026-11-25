const { DataTypes, Model } = require('sequelize');

const ORDER_STATUSES = ['pending', 'confirmed', 'shipping', 'completed', 'cancelled'];

module.exports = (sequelize) => {
  class Order extends Model {}

  Order.init(
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
      },
      order_code: {
        type: DataTypes.STRING(30),
        allowNull: false,
        unique: true
      },
      buyer_id: {
        type: DataTypes.INTEGER,
        allowNull: false
      },
      seller_id: {
        type: DataTypes.INTEGER,
        allowNull: true
      },
      product_id: {
        type: DataTypes.INTEGER,
        allowNull: true
      },
      // Snapshot để giữ lịch sử ngay cả khi sản phẩm bị xóa/đổi tên.
      product_title: {
        type: DataTypes.STRING(255),
        allowNull: false
      },
      product_image: {
        type: DataTypes.STRING(255),
        allowNull: true
      },
      seller_name: {
        type: DataTypes.STRING(100),
        allowNull: true
      },
      quantity: {
        type: DataTypes.INTEGER,
        allowNull: false,
        validate: { isInt: true, min: 1, max: 99 }
      },
      unit_price: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: false
      },
      total_amount: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: false
      },
      receiver_name: {
        type: DataTypes.STRING(100),
        allowNull: false
      },
      receiver_phone: {
        type: DataTypes.STRING(20),
        allowNull: false
      },
      shipping_address: {
        type: DataTypes.STRING(300),
        allowNull: false
      },
      note: {
        type: DataTypes.STRING(300),
        allowNull: true
      },
      status: {
        type: DataTypes.ENUM(...ORDER_STATUSES),
        allowNull: false,
        defaultValue: 'pending'
      }
    },
    {
      sequelize,
      modelName: 'Order',
      tableName: 'orders',
      timestamps: true,
      underscored: true,
      indexes: [
        { name: 'idx_orders_buyer', fields: ['buyer_id', 'created_at'] },
        { name: 'idx_orders_seller', fields: ['seller_id', 'created_at'] },
        { name: 'idx_orders_status', fields: ['status'] }
      ]
    }
  );

  Order.STATUSES = ORDER_STATUSES;

  return Order;
};
