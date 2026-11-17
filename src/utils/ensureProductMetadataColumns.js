const { DataTypes } = require('sequelize');

const ensureProductMetadataColumns = async (sequelize) => {
  const queryInterface = sequelize.getQueryInterface();
  const columns = await queryInterface.describeTable('products');

  for (const [name, type] of [['brand', DataTypes.STRING(100)], ['product_model', DataTypes.STRING(100)]]) {
    if (!columns[name]) {
      await queryInterface.addColumn('products', name, { type, allowNull: true });
    }
  }
};

module.exports = ensureProductMetadataColumns;
