const { Sequelize } = require('sequelize');
const path = require('path');
require('dotenv').config();

const dialect = process.env.DB_DIALECT || 'mysql';
let sequelize;

if (dialect === 'sqlite') {
  sequelize = new Sequelize({
    dialect: 'sqlite',
    storage: path.join(__dirname, '../../database.sqlite'),
    logging: false
  });
} else {
  // Cấu hình MySQL mặc định
  sequelize = new Sequelize(
    process.env.DB_NAME || 'patuhi_santhuongmai',
    process.env.DB_USER || 'root',
    process.env.DB_PASS || '',
    {
      host: process.env.DB_HOST || '127.0.0.1',
      port: process.env.DB_PORT || 3306,
      dialect: 'mysql',
      logging: false,
      pool: {
        max: 10,
        min: 0,
        acquire: 30000,
        idle: 10000
      },
      define: {
        timestamps: true,
        underscored: true
      }
    }
  );
}

// Hàm khởi tạo và kết nối DB an toàn (tự động tạo DB nếu dùng MySQL, fallback SQLite nếu MySQL chưa bật)
const testAndConnectDB = async () => {
  if (dialect === 'mysql') {
    try {
      // Thử tạo DB nếu chưa có bằng mysql2 kết nối trực tiếp
      const mysql = require('mysql2/promise');
      const connection = await mysql.createConnection({
        host: process.env.DB_HOST || '127.0.0.1',
        port: process.env.DB_PORT || 3306,
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASS || ''
      });
      await connection.query(`CREATE DATABASE IF NOT EXISTS \`${process.env.DB_NAME || 'patuhi_santhuongmai'}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`);
      await connection.end();

      await sequelize.authenticate();
      console.log('✅ Đã kết nối cơ sở dữ liệu MySQL thành công!');
      return sequelize;
    } catch (err) {
      console.warn('⚠️ Không thể kết nối MySQL (Có thể MySQL trong Laragon chưa khởi động).');
      console.warn(`Chi tiết lỗi: ${err.message}`);
      console.log('🔄 Đang tự động chuyển sang chế độ SQLite dự phòng (database.sqlite)...');
      
      // Fallback sang SQLite để toàn bộ ứng dụng vẫn hoạt động 100%
      sequelize = new Sequelize({
        dialect: 'sqlite',
        storage: path.join(__dirname, '../../database.sqlite'),
        logging: false,
        define: {
          timestamps: true,
          underscored: true
        }
      });
      await sequelize.authenticate();
      console.log('✅ Đã kết nối cơ sở dữ liệu SQLite dự phòng thành công!');
      return sequelize;
    }
  } else {
    await sequelize.authenticate();
    console.log('✅ Đã kết nối SQLite thành công!');
    return sequelize;
  }
};

const getSequelize = () => sequelize;

module.exports = {
  sequelize,
  getSequelize,
  testAndConnectDB
};
