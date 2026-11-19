const { DataTypes } = require('sequelize');

const ensureProductMetadataColumns = async (sequelize) => {
  const queryInterface = sequelize.getQueryInterface();
  const columns = await queryInterface.describeTable('products');

  for (const [name, type] of [['brand', DataTypes.STRING(100)], ['product_model', DataTypes.STRING(100)], ['condition_detail', DataTypes.STRING(100)]]) {
    if (!columns[name]) {
      await queryInterface.addColumn('products', name, { type, allowNull: true });
    }
  }

  if (sequelize.getDialect() === 'mysql' && !String(columns.condition?.type || '').includes('other')) {
    await queryInterface.changeColumn('products', 'condition', {
      type: DataTypes.ENUM('new', 'like_new', 'used', 'other'),
      defaultValue: 'used'
    });
  }

  // Đảm bảo các cột bổ sung cho bảng messages
  try {
    const messageColumns = await queryInterface.describeTable('messages');
    if (!messageColumns['image_url']) {
      await queryInterface.addColumn('messages', 'image_url', {
        type: DataTypes.STRING(255),
        allowNull: true
      });
    }
  } catch (e) {
    // Bỏ qua nếu bảng chưa khởi tạo
  }
};

module.exports = ensureProductMetadataColumns;
