/**
 * Automated Test Suite for Patuhi Marketplace
 * Tests all 35 user requirements:
 * Auth, RBAC (Guest, Member, Admin), Products, Search & Filter, Favorites, Chat, Reports, Admin moderation & Statistics
 */

const http = require('http');
const app = require('../src/app');
const { testAndConnectDB } = require('../src/config/database');
const initModels = require('../src/models');
const seedData = require('../src/utils/seedData');

let server;
let baseUrl;

const request = async (method, path, body = null, token = null) => {
  const url = `${baseUrl}${path}`;
  const headers = { 'Content-Type': 'application/json' };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined
  });

  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch (e) {
    data = text;
  }

  return { status: res.status, ok: res.ok, data };
};

const runTests = async () => {
  console.log('🧪 Bắt đầu chạy bộ kiểm thử toàn diện hệ thống Patuhi...\n');
  let passedCount = 0;
  let failedCount = 0;

  const assert = (condition, testName, extra = '') => {
    if (condition) {
      console.log(`  ✅ [PASS] ${testName}`);
      passedCount++;
    } else {
      console.error(`  ❌ [FAIL] ${testName} ${extra}`);
      failedCount++;
    }
  };

  try {
    // 1. Chuẩn bị Server và Cơ sở dữ liệu
    const sequelize = await testAndConnectDB();
    const models = initModels(sequelize);
    await sequelize.sync({ force: false });
    await seedData();

    server = http.createServer(app);
    await new Promise((resolve) => {
      server.listen(0, '127.0.0.1', () => {
        const port = server.address().port;
        baseUrl = `http://127.0.0.1:${port}`;
        console.log(`📡 Test server đang chạy tại ${baseUrl}\n`);
        resolve();
      });
    });

    // ----------------------------------------------------
    // TEST 1: Healthcheck API
    // ----------------------------------------------------
    console.log('📌 NHÓM 1: KHỞI TẠO & KIỂM TRA HỆ THỐNG');
    const health = await request('GET', '/api/health');
    assert(health.status === 200 && health.data.status === 'online', '1. Khởi tạo Express & Route Healthcheck');

    // ----------------------------------------------------
    // TEST 2: Đăng ký tài khoản (Requirement 5)
    // ----------------------------------------------------
    console.log('\n📌 NHÓM 2: XÁC THỰC, PHÂN QUYỀN & TÀI KHOẢN');
    const randomUser = `testuser_${Date.now()}`;
    const regRes = await request('POST', '/api/auth/register', {
      username: randomUser,
      email: `${randomUser}@gmail.com`,
      password: 'TestPassword123@',
      full_name: 'Người Dùng Test',
      phone: '0988776655'
    });
    assert(regRes.status === 201 && regRes.data.success, '2. Đăng ký tài khoản thành viên mới');
    const memberToken = regRes.data.data.token;
    const memberUser = regRes.data.data.user;

    // ----------------------------------------------------
    // TEST 3: Đăng nhập & Đăng xuất (Requirement 6)
    // ----------------------------------------------------
    const loginRes = await request('POST', '/api/auth/login', {
      username: randomUser,
      password: 'TestPassword123@'
    });
    assert(loginRes.status === 200 && loginRes.data.data.token, '3. Đăng nhập thành công với tài khoản vừa tạo');

    const logoutRes = await request('POST', '/api/auth/logout');
    assert(logoutRes.status === 200 && logoutRes.data.success, '4. Đăng xuất tài khoản');

    // ----------------------------------------------------
    // TEST 4: Middleware xác thực và thông tin cá nhân (Requirements 8, 9)
    // ----------------------------------------------------
    const meRes = await request('GET', '/api/auth/me', null, memberToken);
    assert(meRes.status === 200 && meRes.data.data.user.username === randomUser, '5. Lấy thông tin tài khoản hiện tại qua token');

    const updateProfileRes = await request('PUT', '/api/users/profile', {
      full_name: 'Nguyễn Test Cập Nhật',
      phone: '0911223344'
    }, memberToken);
    assert(updateProfileRes.status === 200 && updateProfileRes.data.data.user.full_name === 'Nguyễn Test Cập Nhật', '6. Cập nhật thông tin tài khoản (Họ tên, SĐT)');

    // ----------------------------------------------------
    // TEST 5: Phân quyền Khách, Thành viên, Quản trị viên (Requirements 7, 26)
    // ----------------------------------------------------
    const guestCreateProduct = await request('POST', '/api/products', {
      title: 'Sản phẩm khách trái phép',
      category_id: 1,
      price: 100000,
      description: 'Mô tả ngắn không hợp lệ',
      location: 'Hà Nội'
    });
    assert(guestCreateProduct.status === 401, '7. Phân quyền Khách: Chặn khách chưa đăng nhập tạo tin đăng');

    const memberAccessAdmin = await request('GET', '/api/admin/dashboard/stats', null, memberToken);
    assert(memberAccessAdmin.status === 403, '8. Phân quyền Thành viên: Chặn member truy cập Bảng Quản Trị Admin');

    // Đăng nhập Admin
    const adminLoginRes = await request('POST', '/api/auth/login', {
      username: 'admin',
      password: 'Admin123@password'
    });
    const adminToken = adminLoginRes.data.data.token;
    assert(adminLoginRes.status === 200 && adminLoginRes.data.data.user.role === 'admin', '9. Phân quyền Quản trị viên: Đăng nhập quyền Admin thành công');

    // ----------------------------------------------------
    // TEST 6: Xem danh mục, danh sách & Tìm kiếm, Lọc (Requirements 10, 11, 12, 13)
    // ----------------------------------------------------
    console.log('\n📌 NHÓM 3: SẢN PHẨM & TÌM KIẾM, LỌC');
    const categoriesRes = await request('GET', '/api/categories');
    assert(categoriesRes.status === 200 && categoriesRes.data.data.categories.length > 0, '10. Xem danh sách danh mục sản phẩm');
    const firstCat = categoriesRes.data.data.categories[0];

    const productsRes = await request('GET', '/api/products');
    assert(productsRes.status === 200 && Array.isArray(productsRes.data.data.products), '11. Xem danh sách sản phẩm');

    const searchRes = await request('GET', '/api/products?q=iPhone');
    assert(searchRes.status === 200 && searchRes.data.data.products.length >= 1, '12. Tìm kiếm sản phẩm theo từ khóa (iPhone)');

    const filterRes = await request('GET', `/api/products?category_id=${firstCat.id}&min_price=1000000`);
    assert(filterRes.status === 200, '13. Lọc sản phẩm theo danh mục và khoảng giá');

    // ----------------------------------------------------
    // TEST 7: Đăng tin, Sửa, Đổi trạng thái tin (Requirements 14, 15, 18)
    // ----------------------------------------------------
    console.log('\n📌 NHÓM 4: QUẢN LÝ TIN ĐĂNG');
    const newProductRes = await request('POST', '/api/products', {
      title: 'Bàn phím cơ không dây Bluetooth RGB cao cấp',
      category_id: firstCat.id,
      price: 950000,
      condition: 'like_new',
      location: 'Quận 3, TP.HCM',
      phone_contact: '0911223344',
      description: 'Bàn phím gõ rất êm, switch red, pin dùng được 2 tuần liên tục, đầy đủ hộp.'
    }, memberToken);
    assert(newProductRes.status === 201 && newProductRes.data.data.product.id, '14. Đăng tin bán sản phẩm mới');
    const createdProductId = newProductRes.data.data.product.id;

    const detailRes = await request('GET', `/api/products/${createdProductId}`, null, memberToken);
    assert(detailRes.status === 200 && detailRes.data.data.product.title.includes('Bàn phím cơ'), '15. Xem chi tiết sản phẩm');

    const updateProdRes = await request('PUT', `/api/products/${createdProductId}`, {
      price: 850000,
      description: 'Giảm giá còn 850k cho bạn nào qua lấy sớm trong hôm nay!'
    }, memberToken);
    assert(updateProdRes.status === 200 && parseFloat(updateProdRes.data.data.product.price) === 850000, '16. Sửa thông tin tin đăng của chính mình');

    const statusProdRes = await request('PATCH', `/api/products/${createdProductId}/status`, {
      status: 'sold'
    }, memberToken);
    assert(statusProdRes.status === 200 && statusProdRes.data.data.product.status === 'sold', '17. Quản lý trạng thái tin đăng (Đánh dấu Đã bán)');

    // ----------------------------------------------------
    // TEST 8: Danh sách yêu thích (Requirements 19, 20, 21)
    // ----------------------------------------------------
    console.log('\n📌 NHÓM 5: DANH SÁCH YÊU THÍCH (WISHLIST)');
    // Lấy một sản phẩm khác để thêm yêu thích
    const otherProduct = productsRes.data.data.products[0];
    const addFavRes = await request('POST', `/api/favorites/${otherProduct.id}`, null, memberToken);
    assert(addFavRes.status === 201 && addFavRes.data.success, '18. Thêm sản phẩm vào danh sách yêu thích');

    const getFavsRes = await request('GET', '/api/favorites', null, memberToken);
    assert(getFavsRes.status === 200 && getFavsRes.data.data.favorites.some(f => f.id === otherProduct.id), '19. Xem danh sách sản phẩm yêu thích');

    const removeFavRes = await request('DELETE', `/api/favorites/${otherProduct.id}`, null, memberToken);
    assert(removeFavRes.status === 200 && removeFavRes.data.success, '20. Xóa sản phẩm khỏi danh sách yêu thích');

    // ----------------------------------------------------
    // TEST 9: Tin nhắn giữa Người Mua và Người Bán (Requirements 22, 23)
    // ----------------------------------------------------
    console.log('\n📌 NHÓM 6: NHẮN TIN TRỰC TUYẾN (CHAT)');
    const createConvRes = await request('POST', '/api/chat/conversations', {
      productId: otherProduct.id
    }, memberToken);
    assert(createConvRes.status === 200 && createConvRes.data.data.conversationId, '21. Khởi tạo cuộc hội thoại chat giữa người mua và người bán');
    const convId = createConvRes.data.data.conversationId;

    const sendMsgRes = await request('POST', `/api/chat/conversations/${convId}/messages`, {
      content: 'Chào bạn, sản phẩm này còn không ạ?'
    }, memberToken);
    assert(sendMsgRes.status === 201 && sendMsgRes.data.data.message.content.includes('Chào bạn'), '22. Gửi tin nhắn mới');

    const getMsgsRes = await request('GET', `/api/chat/conversations/${convId}/messages`, null, memberToken);
    assert(getMsgsRes.status === 200 && getMsgsRes.data.data.messages.length >= 1, '23. Xem lịch sử tin nhắn trong cuộc trò chuyện');

    // ----------------------------------------------------
    // TEST 10: Báo cáo vi phạm (Requirements 24, 25)
    // ----------------------------------------------------
    console.log('\n📌 NHÓM 7: BÁO CÁO VI PHẠM & THEO DÕI');
    const reportRes = await request('POST', '/api/reports', {
      product_id: otherProduct.id,
      reason: 'offensive',
      description: 'Nội dung có dấu hiệu spam quảng cáo'
    }, memberToken);
    assert(reportRes.status === 201 && reportRes.data.success, '24. Gửi báo cáo vi phạm tin đăng');
    const reportId = reportRes.data.data.report.id;

    const myReportsRes = await request('GET', '/api/reports/my-reports', null, memberToken);
    assert(myReportsRes.status === 200 && myReportsRes.data.data.reports.some(r => r.id === reportId), '25. Theo dõi trạng thái xử lý báo cáo của tôi');

    // ----------------------------------------------------
    // TEST 11: Chức năng Quản Trị Viên (Admin) (Requirements 27, 28, 29, 30, 31, 32, 33, 34)
    // ----------------------------------------------------
    console.log('\n📌 NHÓM 8: QUẢN TRỊ VIÊN & THỐNG KÊ TOÀN DIỆN');
    const statsRes = await request('GET', '/api/admin/dashboard/stats', null, adminToken);
    assert(
      statsRes.status === 200 &&
      statsRes.data.data.users.total > 0 &&
      statsRes.data.data.products.total > 0 &&
      statsRes.data.data.reports.total > 0,
      '26. Thống kê số lượng người dùng, tin đăng và báo cáo (Dashboard)'
    );

    // Duyệt tin đăng
    const reviewRes = await request('PATCH', `/api/admin/products/${createdProductId}/review`, {
      action: 'approve'
    }, adminToken);
    assert(reviewRes.status === 200 && reviewRes.data.data.product.status === 'approved', '27. Duyệt tin đăng (Admin)');

    // Quản lý người dùng & Khóa tài khoản
    const usersAdminRes = await request('GET', '/api/admin/users', null, adminToken);
    assert(usersAdminRes.status === 200 && usersAdminRes.data.data.users.length > 0, '28. Quản lý danh sách người dùng (Admin)');

    const lockUserRes = await request('PATCH', `/api/admin/users/${memberUser.id}/status`, {
      status: 'locked'
    }, adminToken);
    assert(lockUserRes.status === 200 && lockUserRes.data.data.user.status === 'locked', '29. Khóa tài khoản người dùng vi phạm');

    // Kiểm tra tài khoản bị khóa không được phép đăng nhập/thao tác
    const lockedLoginRes = await request('POST', '/api/auth/login', {
      username: randomUser,
      password: 'TestPassword123@'
    });
    assert(lockedLoginRes.status === 403, '30. Kiểm tra chặn người dùng bị khóa đăng nhập vào hệ thống');

    // Mở khóa lại tài khoản
    const unlockUserRes = await request('PATCH', `/api/admin/users/${memberUser.id}/status`, {
      status: 'active'
    }, adminToken);
    assert(unlockUserRes.status === 200 && unlockUserRes.data.data.user.status === 'active', '31. Mở khóa lại tài khoản người dùng');

    // Quản lý danh mục
    const createCatRes = await request('POST', '/api/admin/categories', {
      name: 'Thú Cưng & Phụ Kiện',
      icon: 'bi-heart'
    }, adminToken);
    assert(createCatRes.status === 201 && createCatRes.data.data.category.id, '32. Quản lý danh mục: Thêm danh mục mới');

    // Xử lý báo cáo vi phạm
    const processReportRes = await request('PATCH', `/api/admin/reports/${reportId}/process`, {
      status: 'resolved',
      admin_note: 'Đã xác minh và nhắc nhở người bán.',
      hide_product: false
    }, adminToken);
    assert(processReportRes.status === 200 && processReportRes.data.data.report.status === 'resolved', '33. Xử lý báo cáo vi phạm (Admin)');

    // Xóa tin đăng (Requirement 16)
    const deleteProdRes = await request('DELETE', `/api/products/${createdProductId}`, null, adminToken);
    assert(deleteProdRes.status === 200 && deleteProdRes.data.success, '34. Xóa tin đăng bán sản phẩm');

    // ----------------------------------------------------
    // TỔNG KẾT
    // ----------------------------------------------------
    console.log('\n========================================================');
    console.log(`🎉 KẾT QUẢ KIỂM THỬ: ${passedCount} THÀNH CÔNG, ${failedCount} THẤT BẠI`);
    console.log('========================================================\n');

    server.close();
    process.exit(failedCount > 0 ? 1 : 0);
  } catch (error) {
    console.error('❌ Lỗi ngoại lệ trong quá trình kiểm thử:', error);
    if (server) server.close();
    process.exit(1);
  }
};

runTests();
