const { DataTypes, Model } = require('sequelize');

module.exports = (sequelize) => {
  class Product extends Model {}

  Product.init(
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
      },
      user_id: {
        type: DataTypes.INTEGER,
        allowNull: false
      },
      category_id: {
        type: DataTypes.INTEGER,
        allowNull: false
      },
      brand: {
        type: DataTypes.STRING(100),
        allowNull: true
      },
      model: {
        type: DataTypes.STRING(100),
        allowNull: true,
        field: 'product_model'
      },
      title: {
        type: DataTypes.STRING(255),
        allowNull: false
      },
      description: {
        type: DataTypes.TEXT,
        allowNull: false
      },
      price: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: false,
        defaultValue: 0
      },
      condition: {
        type: DataTypes.ENUM('new', 'like_new', 'used', 'other'),
        defaultValue: 'used'
      },
      condition_detail: {
        type: DataTypes.STRING(100),
        allowNull: true
      },
      specs: {
        type: DataTypes.TEXT,
        allowNull: true
      },
      location: {
        type: DataTypes.STRING(150),
        allowNull: false
      },
      phone_contact: {
        type: DataTypes.STRING(20),
        allowNull: true
      },
      status: {
        type: DataTypes.ENUM('pending', 'approved', 'rejected', 'sold', 'hidden'),
        defaultValue: 'pending'
      },
      rejection_reason: {
        type: DataTypes.STRING(255),
        allowNull: true
      },
      views: {
        type: DataTypes.INTEGER,
        defaultValue: 0
      }
    },
    {
      sequelize,
      modelName: 'Product',
      tableName: 'products'
    }
  );

  return Product;
};
