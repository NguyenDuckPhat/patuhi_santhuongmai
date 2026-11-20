const { DataTypes, Model } = require('sequelize');

module.exports = (sequelize) => {
  class Comment extends Model {}

  Comment.init(
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
      user_id: {
        type: DataTypes.INTEGER,
        allowNull: false
      },
      content: {
        type: DataTypes.TEXT,
        allowNull: false,
        validate: {
          notEmpty: true,
          len: [1, 1000]
        }
      },
      status: {
        type: DataTypes.ENUM('PENDING', 'APPROVED', 'REJECTED'),
        allowNull: false,
        defaultValue: 'PENDING'
      }
    },
    {
      sequelize,
      modelName: 'Comment',
      tableName: 'comments',
      timestamps: true,
      underscored: true
    }
  );

  return Comment;
};
