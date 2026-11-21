const { DataTypes } = require('sequelize');

module.exports = async (sequelize) => {
  const queryInterface = sequelize.getQueryInterface();
  const users = await queryInterface.describeTable('users');
  if (!users.last_active_at) {
    await queryInterface.addColumn('users', 'last_active_at', { type: DataTypes.DATE });
  }
  const comments = await queryInterface.describeTable('comments');
  if (!comments.rating) {
    await queryInterface.addColumn('comments', 'rating', { type: DataTypes.INTEGER });
  }
};
