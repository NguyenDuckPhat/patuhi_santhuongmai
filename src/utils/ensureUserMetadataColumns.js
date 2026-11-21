const { DataTypes } = require('sequelize');

const ensureUserMetadataColumns = async (sequelize) => {
  try {
    const queryInterface = sequelize.getQueryInterface();
    const columns = await queryInterface.describeTable('users');

    if (!columns['google_id']) {
      await queryInterface.addColumn('users', 'google_id', {
        type: DataTypes.STRING(100),
        allowNull: true
      });
      console.log('✅ Đã bổ sung cột google_id vào bảng users.');
    }
  } catch (err) {
    console.warn('Lưu ý kiểm tra bảng users:', err.message);
  }
};

module.exports = ensureUserMetadataColumns;
