const { DataTypes } = require('sequelize');

module.exports = async (sequelize) => {
  const queryInterface = sequelize.getQueryInterface();
  const messages = await queryInterface.describeTable('messages');
  if (!messages.image_url) {
    await queryInterface.addColumn('messages', 'image_url', { type: DataTypes.STRING(500), allowNull: true });
  }
  if (!messages.is_recalled) {
    await queryInterface.addColumn('messages', 'is_recalled', { type: DataTypes.BOOLEAN, defaultValue: false });
  }
  if (!messages.recalled_at) {
    await queryInterface.addColumn('messages', 'recalled_at', { type: DataTypes.DATE, allowNull: true });
  }
};
