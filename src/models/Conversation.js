const { DataTypes, Model } = require('sequelize');

module.exports = (sequelize) => {
  class Conversation extends Model {}

  Conversation.init(
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
      buyer_id: {
        type: DataTypes.INTEGER,
        allowNull: false
      },
      seller_id: {
        type: DataTypes.INTEGER,
        allowNull: false
      },
      last_message: {
        type: DataTypes.TEXT,
        allowNull: true
      },
      last_message_at: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
      }
    },
    {
      sequelize,
      modelName: 'Conversation',
      tableName: 'conversations'
    }
  );

  return Conversation;
};
