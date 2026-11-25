
const { getSequelize } = require('../config/database');

const initModels = (sequelizeInstance) => {
  const sequelize = sequelizeInstance || getSequelize();

  const User = require('./User')(sequelize);
  const Category = require('./Category')(sequelize);
  const Product = require('./Product')(sequelize);
  const ProductImage = require('./ProductImage')(sequelize);
  const Favorite = require('./Favorite')(sequelize);
  const Conversation = require('./Conversation')(sequelize);
  const Message = require('./Message')(sequelize);
  const Report = require('./Report')(sequelize);
  const Comment = require('./Comment')(sequelize);
  const SellerFollow = require('./SellerFollow')(sequelize);
  const Order = require('./Order')(sequelize);
  const OrderStatusHistory = require('./OrderStatusHistory')(sequelize);

  // Quan hệ User - Product
  User.hasMany(Product, { foreignKey: 'user_id', as: 'products', onDelete: 'CASCADE' });
  Product.belongsTo(User, { foreignKey: 'user_id', as: 'seller' });

  // Quan hệ Category - Product
  Category.hasMany(Product, { foreignKey: 'category_id', as: 'products', onDelete: 'RESTRICT' });
  Product.belongsTo(Category, { foreignKey: 'category_id', as: 'category' });

  // Quan hệ Product - ProductImage
  Product.hasMany(ProductImage, { foreignKey: 'product_id', as: 'images', onDelete: 'CASCADE' });
  ProductImage.belongsTo(Product, { foreignKey: 'product_id', as: 'product' });

  // Quan hệ User - Favorite - Product
  User.hasMany(Favorite, { foreignKey: 'user_id', as: 'favorites', onDelete: 'CASCADE' });
  Favorite.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

  Product.hasMany(Favorite, { foreignKey: 'product_id', as: 'favorites', onDelete: 'CASCADE' });
  Favorite.belongsTo(Product, { foreignKey: 'product_id', as: 'product' });

  User.belongsToMany(Product, {
    through: Favorite,
    foreignKey: 'user_id',
    otherKey: 'product_id',
    as: 'favoritedProducts'
  });

  Product.belongsToMany(User, {
    through: Favorite,
    foreignKey: 'product_id',
    otherKey: 'user_id',
    as: 'favoritedBy'
  });

  // Quan hệ Conversation & Message
  Product.hasMany(Conversation, { foreignKey: 'product_id', as: 'conversations', onDelete: 'CASCADE' });
  Conversation.belongsTo(Product, { foreignKey: 'product_id', as: 'product' });

  User.hasMany(Conversation, { foreignKey: 'buyer_id', as: 'buyerConversations', onDelete: 'CASCADE' });
  User.hasMany(Conversation, { foreignKey: 'seller_id', as: 'sellerConversations', onDelete: 'CASCADE' });
  Conversation.belongsTo(User, { foreignKey: 'buyer_id', as: 'buyer' });
  Conversation.belongsTo(User, { foreignKey: 'seller_id', as: 'seller' });

  Conversation.hasMany(Message, { foreignKey: 'conversation_id', as: 'messages', onDelete: 'CASCADE' });
  Message.belongsTo(Conversation, { foreignKey: 'conversation_id', as: 'conversation' });
  Message.belongsTo(User, { foreignKey: 'sender_id', as: 'sender' });

  // Quan hệ Report
  User.hasMany(Report, { foreignKey: 'reporter_id', as: 'reports', onDelete: 'CASCADE' });
  Report.belongsTo(User, { foreignKey: 'reporter_id', as: 'reporter' });

  Product.hasMany(Report, { foreignKey: 'product_id', as: 'reports', onDelete: 'CASCADE' });
  Report.belongsTo(Product, { foreignKey: 'product_id', as: 'product' });

  // Quan hệ User - Product - Comment
  User.hasMany(Comment, { foreignKey: 'user_id', as: 'comments', onDelete: 'CASCADE' });
  Comment.belongsTo(User, { foreignKey: 'user_id', as: 'user' });
  Product.hasMany(Comment, { foreignKey: 'product_id', as: 'comments', onDelete: 'CASCADE' });
  Comment.belongsTo(Product, { foreignKey: 'product_id', as: 'product' });

  // Đánh giá gắn với đơn hàng đã mua (null với bình luận thường).
  Order.hasMany(Comment, { foreignKey: 'order_id', as: 'reviews', onDelete: 'SET NULL' });
  Comment.belongsTo(Order, { foreignKey: 'order_id', as: 'order' });

  // Quan hệ Order - User - Product
  // SET NULL để giữ lịch sử đơn khi tin đăng/user bị xóa.
  User.hasMany(Order, { foreignKey: 'buyer_id', as: 'buyerOrders', onDelete: 'RESTRICT' });
  User.hasMany(Order, { foreignKey: 'seller_id', as: 'sellerOrders', onDelete: 'SET NULL' });
  Order.belongsTo(User, { foreignKey: 'buyer_id', as: 'buyer' });
  Order.belongsTo(User, { foreignKey: 'seller_id', as: 'seller' });

  Product.hasMany(Order, { foreignKey: 'product_id', as: 'orders', onDelete: 'SET NULL' });
  Order.belongsTo(Product, { foreignKey: 'product_id', as: 'product' });

  // Lịch sử trạng thái đơn hàng
  Order.hasMany(OrderStatusHistory, { foreignKey: 'order_id', as: 'statusHistory', onDelete: 'CASCADE' });
  OrderStatusHistory.belongsTo(Order, { foreignKey: 'order_id', as: 'order' });
  User.hasMany(OrderStatusHistory, { foreignKey: 'changed_by', as: 'orderStatusChanges', onDelete: 'SET NULL' });
  OrderStatusHistory.belongsTo(User, { foreignKey: 'changed_by', as: 'changedBy' });

  return {
    sequelize,
    User,
    Category,
    Product,
    ProductImage,
    Favorite,
    Conversation,
    Message,
    Report,
    Comment,
    SellerFollow,
    Order,
    OrderStatusHistory
  };
};

module.exports = initModels;
