const { getSequelize, testAndConnectDB } = require('../config/database');
const initModels = require('../models');
const ensureProductMetadataColumns = require('./ensureProductMetadataColumns');
const ensureUserMetadataColumns = require('./ensureUserMetadataColumns');

const seedData = async () => {
  try {
    const sequelize = await testAndConnectDB();
    const { User, Category, Product, ProductImage } = initModels(sequelize);

    await sequelize.sync({ force: false });
    await ensureProductMetadataColumns(sequelize);
    await ensureUserMetadataColumns(sequelize);
    console.log('📦 Database synced!');

    // 1. Tạo Danh Mục Sản Phẩm Mặc Định
    const categoriesData = [
      { name: 'Điện Thoại & Máy Tính Bảng', slug: 'dien-thoai-may-tinh-bang', icon: 'bi-phone', description: 'iPhone, Samsung, Xiaomi, iPad, phụ kiện điện thoại' },
      { name: 'Laptop & Máy Tính Bàn', slug: 'laptop-may-tinh-ban', icon: 'bi-laptop', description: 'MacBook, Dell, ThinkPad, linh kiện PC, màn hình' },
      { name: 'Xe Cộ & Phương Tiện', slug: 'xe-co-phuong-tien', icon: 'bi-bicycle', description: 'Xe máy, xe đạp điện, xe hơi đã qua sử dụng' },
      { name: 'Đồ Điện Gia Dụng', slug: 'do-dien-gia-dung', icon: 'bi-tv', description: 'Tủ lạnh, máy giặt, điều hòa, nồi chiên không dầu' },
      { name: 'Thời Trang & Phụ Kiện', slug: 'thoi-trang-phu-kien', icon: 'bi-handbag', description: 'Quần áo nam nữ, giày dép, túi xách, đồng hồ' },
      { name: 'Đồ Dùng Nội Thất', slug: 'do-dung-noi-that', icon: 'bi-lamp', description: 'Bàn ghế làm việc, tủ quần áo, giường nệm' },
      { name: 'Mẹ & Bé - Đồ Chơi', slug: 'me-va-be', icon: 'bi-balloon', description: 'Xe đẩy, đồ chơi phát triển trí tuệ, quần áo trẻ em' }
    ];

    for (const cat of categoriesData) {
      await Category.findOrCreate({
        where: { slug: cat.slug },
        defaults: cat
      });
    }
    console.log('✅ Đã tạo các danh mục mặc định.');

    // 2. Tạo Tài Khoản Quản Trị Viên (Admin) và Thành Viên Thử Nghiệm
    const [adminUser] = await User.findOrCreate({
      where: { username: 'admin' },
      defaults: {
        username: 'admin',
        email: 'admin@patuhi.vn',
        password: 'Admin123@password', // Sẽ được tự động hash qua hook beforeSave
        full_name: 'Quản Trị Viên Patuhi',
        phone: '0901234567',
        role: 'admin',
        status: 'active',
        avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80'
      }
    });

    const [userA] = await User.findOrCreate({
      where: { username: 'nguyenvana' },
      defaults: {
        username: 'nguyenvana',
        email: 'vana@gmail.com',
        password: 'Password123@',
        full_name: 'Nguyễn Văn A',
        phone: '0912345678',
        role: 'member',
        status: 'active',
        avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80'
      }
    });

    const [userB] = await User.findOrCreate({
      where: { username: 'tranb' },
      defaults: {
        username: 'tranb',
        email: 'tranb@gmail.com',
        password: 'Password123@',
        full_name: 'Trần Thị B',
        phone: '0987654321',
        role: 'member',
        status: 'active',
        avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80'
      }
    });

    console.log('✅ Đã tạo tài khoản Admin & Member mẫu:');
    console.log('   👉 Admin: admin / Admin123@password');
    console.log('   👉 Member: nguyenvana / Password123@');
    console.log('   👉 Member: tranb / Password123@');

    // 3. Tạo một số sản phẩm mẫu
    const countProducts = await Product.count();
    if (countProducts === 0) {
      const cats = await Category.findAll();
      const catPhone = cats.find(c => c.slug === 'dien-thoai-may-tinh-bang') || cats[0];
      const catLaptop = cats.find(c => c.slug === 'laptop-may-tinh-ban') || cats[1];
      const catVehicle = cats.find(c => c.slug === 'xe-co-phuong-tien') || cats[2];

      const p1 = await Product.create({
        user_id: userA.id,
        category_id: catPhone.id,
        title: 'iPhone 13 Pro Max 128GB Xanh Sierra bản VN/A pin 89%',
        description: 'Máy nguyên zin 100% chưa qua sửa chữa, ngoại hình đẹp 99% dùng ốp từ lúc đập hộp. Đầy đủ phụ kiện cáp sạc và hộp chính hãng. Cần lên đời nên nhượng lại cho ai thiện chí.',
        price: 13500000,
        condition: 'like_new',
        location: 'Quận 1, TP. Hồ Chí Minh',
        phone_contact: '0912345678',
        status: 'approved',
        views: 125
      });
      await ProductImage.create({
        product_id: p1.id,
        image_url: 'https://images.unsplash.com/photo-1632661674596-df8be070a5c5?w=600&auto=format&fit=crop&q=80',
        is_primary: true
      });

      const p2 = await Product.create({
        user_id: userA.id,
        category_id: catLaptop.id,
        title: 'MacBook Air M2 2022 RAM 16GB SSD 256GB Màu Midnight',
        description: 'Cần bán MacBook Air M2 còn bảo hành Apple Care đến cuối năm. Máy dùng văn phòng chỉ gõ văn bản và lướt web, pin 100%, sạc tầm 30 lần. Fullbox không thiếu thứ gì.',
        price: 21900000,
        condition: 'like_new',
        location: 'Quận Cầu Giấy, Hà Nội',
        phone_contact: '0912345678',
        status: 'approved',
        views: 210
      });
      await ProductImage.create({
        product_id: p2.id,
        image_url: 'https://images.unsplash.com/photo-1611186871348-b1ce696e52c9?w=600&auto=format&fit=crop&q=80',
        is_primary: true
      });

      const p3 = await Product.create({
        user_id: userB.id,
        category_id: catVehicle.id,
        title: 'Xe máy Honda Air Blade 125cc chính chủ biển Hà Nội',
        description: 'Xe máy Air Blade màu xám đen, xe nhà đi giữ gìn bảo dưỡng định kỳ tại Head, thay dầu máy thường xuyên. Xe đi êm ái, tiết kiệm xăng, giấy tờ chính chủ sang tên 1 nốt nhạc.',
        price: 28500000,
        condition: 'used',
        location: 'Quận Đống Đa, Hà Nội',
        phone_contact: '0987654321',
        status: 'approved',
        views: 89
      });
      await ProductImage.create({
        product_id: p3.id,
        image_url: 'https://images.unsplash.com/photo-1558981403-c5f9899a28bc?w=600&auto=format&fit=crop&q=80',
        is_primary: true
      });

      // Tin đang chờ duyệt
      const p4 = await Product.create({
        user_id: userB.id,
        category_id: catPhone.id,
        title: 'Tai nghe Apple AirPods Pro 2 Type-C chính hãng',
        description: 'Được tặng sinh nhật nhưng không có nhu cầu dùng nên cần nhượng lại nguyên seal chưa bóc hộp.',
        price: 4500000,
        condition: 'new',
        location: 'Quận Hải Châu, Đà Nẵng',
        phone_contact: '0987654321',
        status: 'pending',
        views: 12
      });
      await ProductImage.create({
        product_id: p4.id,
        image_url: 'https://images.unsplash.com/photo-1600294037681-c80b4cb5b434?w=600&auto=format&fit=crop&q=80',
        is_primary: true
      });

      console.log('✅ Đã tạo các sản phẩm mẫu thành công!');
    }

    return true;
  } catch (err) {
    console.error('❌ Lỗi chạy seed data:', err.message);
    throw err;
  }
};

if (require.main === module) {
  seedData()
    .then(() => {
      console.log('✨ Seed hoàn tất!');
      process.exit(0);
    })
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}

module.exports = seedData;
