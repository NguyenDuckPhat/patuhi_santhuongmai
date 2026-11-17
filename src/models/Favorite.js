const { DataTypes, Model } = require('sequelize');

module.exports = (sequelize) => {
  class Favorite extends Model {}

  Favorite.init(
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
      product_id: {
        type: DataTypes.INTEGER,
        allowNull: false
      }
    },
    {
      sequelize,
      modelName: 'Favorite',
      tableName: 'favorites',
      indexes: [
        {
          unique: true,
          fields: ['user_id', 'product_id']
        }
      ]
    }
  );

  return Favorite;
};
