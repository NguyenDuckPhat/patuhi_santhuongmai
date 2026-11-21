const http = require('http');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });

const app = require('./src/app');
const initSocketIO = require('./src/config/socket');
const { testAndConnectDB } = require('./src/config/database');
const initModels = require('./src/models');
const seedData = require('./src/utils/seedData');
const ensureProductMetadataColumns = require('./src/utils/ensureProductMetadataColumns');
<<<<<<< Updated upstream
const ensureUserMetadataColumns = require('./src/utils/ensureUserMetadataColumns');
=======
const ensureSellerColumns = require('./src/utils/ensureSellerColumns');
>>>>>>> Stashed changes

const DEFAULT_PORT = parseInt(process.env.PORT, 10) || 3000;

const startServer = async () => {
  try {
    console.log('🚀 Đang khởi động hệ thống Sàn Thương Mại Điện Tử Patuhi...');

    // 1. Kết nối cơ sở dữ liệu
    const sequelize = await testAndConnectDB();

    // 2. Khởi tạo Models và đồng bộ bảng
    const models = initModels(sequelize);
    await sequelize.sync({ force: false });
    await ensureProductMetadataColumns(sequelize);
<<<<<<< Updated upstream
    await ensureUserMetadataColumns(sequelize);
=======
    await ensureSellerColumns(sequelize);
>>>>>>> Stashed changes
    console.log('✅ Đã đồng bộ cấu trúc bảng thành công!');

    // 3. Tự động kiểm tra và tạo dữ liệu mẫu nếu chưa có dữ liệu
    const userCount = await models.User.count();
    if (userCount === 0) {
      console.log('🌱 Phát hiện cơ sở dữ liệu trống, đang nạp dữ liệu mẫu ban đầu...');
      await seedData();
    }

    // 4. Khởi tạo HTTP Server & Socket.IO
    const server = http.createServer(app);
    const io = initSocketIO(server);
    app.set('io', io);

    // 5. Khởi động lắng nghe với cơ chế tự động chuyển cổng nếu bị chiếm dụng (EADDRINUSE)
    let currentPort = DEFAULT_PORT;

    const tryListen = () => {
      const onError = (err) => {
        if (err.code === 'EADDRINUSE') {
          console.warn(`⚠️ Cổng ${currentPort} đang bị ứng dụng khác chiếm dụng.`);
          currentPort++;
          console.log(`🔄 Tự động chuyển sang cổng mới: ${currentPort}...`);
          server.removeListener('error', onError);
          setTimeout(tryListen, 300);
        } else {
          console.error('❌ Lỗi máy chủ:', err.message);
          process.exit(1);
        }
      };

      server.once('error', onError);

      server.listen(currentPort, () => {
        server.removeListener('error', onError);
        console.log('========================================================');
        console.log(`🌐 Server đang chạy thành công tại: http://localhost:${currentPort}`);
        console.log(`📊 Bảng điều khiển Quản trị: http://localhost:${currentPort}/admin`);
        console.log(`🔑 Tài khoản Admin: admin | Mật khẩu: Admin123@password`);
        console.log(`👤 Tài khoản Member: nguyenvana | Mật khẩu: Password123@`);
        console.log('========================================================');
      });
    };

    tryListen();

    return server;
  } catch (error) {
    console.error('❌ Lỗi nghiêm trọng khi khởi động máy chủ:', error);
    process.exit(1);
  }
};

if (require.main === module) {
  startServer();
}

module.exports = { startServer, app };
