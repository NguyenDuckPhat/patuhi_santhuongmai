const { DataTypes, Model } = require('sequelize');

module.exports = (sequelize) => {
  class ProductImage extends Model {}

  ProductImage.init(
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
      },
      product_id: {
        type: DataTypes.INTEGER,
        allowNull: false
      },
      image_url: {
        type: DataTypes.STRING(255),
        allowNull: false
      },
      is_primary: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
      }
    },
    {
      sequelize,
      modelName: 'ProductImage',
      tableName: 'product_images'
    }
  );

  return ProductImage;
};
