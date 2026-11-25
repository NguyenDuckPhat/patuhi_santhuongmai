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
      // Liên kết với đơn hàng đã mua để tính số đơn "chưa đánh giá".
      // Null với bình luận thông thường trên trang sản phẩm.
      order_id: {
        type: DataTypes.INTEGER,
        allowNull: true
      },
      content: {
        type: DataTypes.TEXT,
        allowNull: false,
        validate: {
          notEmpty: true,
          len: [1, 1000]
        }
      },
      rating: {
        type: DataTypes.INTEGER,
        allowNull: true,
        validate: { isInt: true, min: 1, max: 5 }
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
