const { DataTypes, Model } = require('sequelize');

module.exports = (sequelize) => {
  class Message extends Model {}

  Message.init(
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
      },
      conversation_id: {
        type: DataTypes.INTEGER,
        allowNull: false
      },
      sender_id: {
        type: DataTypes.INTEGER,
        allowNull: false
      },
      content: {
        type: DataTypes.TEXT,
        allowNull: false
      },
      is_read: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
      },
      image_url: {
        type: DataTypes.STRING(500),
        allowNull: true
      },
      is_recalled: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
      },
      recalled_at: {
        type: DataTypes.DATE,
        allowNull: true
      }
    },
    {
      sequelize,
      modelName: 'Message',
      tableName: 'messages'
    }
  );

  return Message;
};
