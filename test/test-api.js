/**
 * Automated Test Suite for Patuhi Marketplace
 * Tests all 35 user requirements:
 * Auth, RBAC (Guest, Member, Admin), Products, Search & Filter, Favorites, Chat, Reports, Admin moderation & Statistics
 */

const http = require('http');
const { Script } = require('node:vm');
const app = require('../src/app');
const { testAndConnectDB } = require('../src/config/database');
const initModels = require('../src/models');
const seedData = require('../src/utils/seedData');
const ensureProductMetadataColumns = require('../src/utils/ensureProductMetadataColumns');
const ensureUserMetadataColumns = require('../src/utils/ensureUserMetadataColumns');
const ensureSellerColumns = require('../src/utils/ensureSellerColumns');
const ensureMessageColumns = require('../src/utils/ensureMessageColumns');

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
    await ensureProductMetadataColumns(sequelize);
    await ensureUserMetadataColumns(sequelize);
    await ensureSellerColumns(sequelize);
    await ensureMessageColumns(sequelize);

    // Remove orphan categories left behind by older runs of this API test.
    const categoriesBeforeSeed = await models.Category.findAll({ attributes: ['id', 'name'] });
    for (const category of categoriesBeforeSeed) {
      if (/^Thú Cưng & Phụ Kiện \d{13}$/.test(category.name) &&
          await models.Product.count({ where: { category_id: category.id } }) === 0) {
        await category.destroy();
      }
    }

    await seedData();

    server = http.createServer(app);
    await new Promise((resolve, reject) => {
      server.listen(0, () => {
        const port = server.address().port;
        baseUrl = `http://127.0.0.1:${port}`;
        console.log(`📡 Test server đang chạy tại ${baseUrl}\n`);
        resolve();
      });
      server.on('error', reject);
    });

    // ----------------------------------------------------
    // TEST 1: Healthcheck API
    // ----------------------------------------------------
    console.log('📌 NHÓM 1: KHỞI TẠO & KIỂM TRA HỆ THỐNG');
    const health = await request('GET', '/api/health');
    assert(health.status === 200 && health.data.status === 'online', '1. Khởi tạo Express & Route Healthcheck');
    const chatScript = await request('GET', '/js/chat.js');
    let chatScriptLoads = false;
    try {
      new Script(chatScript.data, { filename: 'chat.js' });
      chatScriptLoads = chatScript.status === 200;
    } catch (error) {
      console.error('Lỗi JavaScript trang chat:', error.message);
    }
    assert(chatScriptLoads, 'Trang chat phục vụ JavaScript hợp lệ, trình duyệt có thể khởi tạo');

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
    // TEST 3a: Đăng ký & Đăng nhập bằng Google
    // ----------------------------------------------------
    const googleClientIdRes = await request('GET', '/api/auth/google/client-id');
    assert(googleClientIdRes.status === 200 && googleClientIdRes.data.success, '4a. Lấy cấu hình Google Client ID');

    const googleEmail = `google_tester_${Date.now()}@patuhi.vn`;
    const googleSub = `gid_${Date.now()}`;
    const googleRegRes = await request('POST', '/api/auth/google', {
      email: googleEmail,
      name: 'Google Test User',
      picture: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150',
      sub: googleSub
    });
    assert(googleRegRes.status === 200 && googleRegRes.data.data.token && googleRegRes.data.data.user.email === googleEmail, '4b. Đăng ký tài khoản mới bằng Google');

    const googleLoginRes = await request('POST', '/api/auth/google', {
      email: googleEmail,
      sub: googleSub
    });
    assert(googleLoginRes.status === 200 && googleLoginRes.data.data.user.id === googleRegRes.data.data.user.id, '4c. Đăng nhập lại bằng tài khoản Google đã liên kết');

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
      brand: 'Keychron',
      model: 'K8 Pro',
      price: 950000,
      condition: 'like_new',
      location: 'Quận 3, TP.HCM',
      phone_contact: '0911223344',
      description: 'Bàn phím gõ rất êm, switch red, pin dùng được 2 tuần liên tục, đầy đủ hộp.'
    }, memberToken);
    assert(
      newProductRes.status === 201 && newProductRes.data.data.product.id &&
      newProductRes.data.data.product.brand === 'Keychron' && newProductRes.data.data.product.model === 'K8 Pro' &&
      !Number.isNaN(new Date(newProductRes.data.data.product.created_at || newProductRes.data.data.product.createdAt).getTime()),
      '14. Đăng tin với hãng/model và ngày tạo hợp lệ'
    );
    const createdProductId = newProductRes.data.data.product.id;

    const detailRes = await request('GET', `/api/products/${createdProductId}`, null, memberToken);
    assert(detailRes.status === 200 && detailRes.data.data.product.title.includes('Bàn phím cơ'), '15. Xem chi tiết sản phẩm');

    const updateProdRes = await request('PUT', `/api/products/${createdProductId}`, {
      price: 850000,
      brand: 'Keychron',
      model: 'K8 Max',
      condition: 'other',
      condition_detail: 'Trầy nhẹ ở cạnh bên',
      description: 'Giảm giá còn 850k cho bạn nào qua lấy sớm trong hôm nay!'
    }, memberToken);
    assert(updateProdRes.status === 200 && parseFloat(updateProdRes.data.data.product.price) === 850000 && updateProdRes.data.data.product.model === 'K8 Max' && updateProdRes.data.data.product.condition === 'other' && updateProdRes.data.data.product.condition_detail === 'Trầy nhẹ ở cạnh bên', '16. Sửa thông tin hãng/model và tình trạng khác tin đăng');

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
    const sellerUrl = `/api/users/${otherProduct.user_id}/seller`;
    const memberListings = await request('GET', `/api/users/${memberUser.id}/seller/listings?status=sold`);
    assert(memberListings.status === 200 && memberListings.data.data.products.some(product => product.id === createdProductId), 'Hồ sơ người bán liệt kê tin đã bán');
    const referenceImage = 'https://cdn.chotot.com/3gGAEamk2x0cUbmKm0xm2AOazKxr3vbmjbsGQ_PAScs/preset:listing/plain/2dc1834dd905174819fe52926cf38285-3011174944793899487.jpg';
    await models.ProductImage.bulkCreate([
      { product_id: createdProductId, image_url: '/uploads/products/secondary-test.jpg', is_primary: false },
      { product_id: createdProductId, image_url: referenceImage, is_primary: true }
    ]);
    const listingsWithImages = await request('GET', `/api/users/${memberUser.id}/seller/listings?status=sold`);
    const picturedProduct = listingsWithImages.data.data.products.find(product => product.id === createdProductId);
    assert(
      picturedProduct.images.length === 2 && picturedProduct.images[0].image_url === referenceImage &&
      picturedProduct.location && !Number.isNaN(new Date(picturedProduct.createdAt).getTime()) &&
      listingsWithImages.data.data.totalPages === memberListings.data.data.totalPages,
      'Tin đăng người bán trả đầy đủ ảnh, ảnh bìa đứng trước, khu vực và ngày đăng; nhiều ảnh không làm sai phân trang'
    );
    const memberSeller = await request('GET', `/api/users/${memberUser.id}/seller`);
    assert(memberSeller.status === 200 && memberSeller.data.data.last_active_at && memberSeller.data.data.listings.sold === 1, 'Hồ sơ hiển thị hoạt động gần nhất và đếm tin đã bán');

    const guestSeller = await request('GET', sellerUrl);
    const publicProfilePage = await request('GET', `/profile?profile=${otherProduct.user_id}`);
    const ownProfilePage = await request('GET', '/profile');
    assert(
      publicProfilePage.status === 200 && publicProfilePage.data.includes('/js/seller-profile.js') &&
      ownProfilePage.status === 200 && ownProfilePage.data.includes('/js/profile.js') &&
      guestSeller.data.data.seller.id === otherProduct.user_id && guestSeller.data.data.seller.full_name &&
      !('email' in guestSeller.data.data.seller) && !('password' in guestSeller.data.data.seller),
      'Khách mở hồ sơ người bán theo query profile và nhận thông tin công khai'
    );
    const followUrl = `/api/users/${otherProduct.user_id}/follow`;
    const followRes = await request('PUT', followUrl, null, memberToken);
    await request('PUT', followUrl, null, memberToken);
    const followedSeller = await request('GET', sellerUrl, null, memberToken);
    const unfollowRes = await request('DELETE', followUrl, null, memberToken);
    assert(
      guestSeller.status === 200 && followRes.status === 200 && followedSeller.data.data.is_following &&
      followedSeller.data.data.followers === guestSeller.data.data.followers + 1 &&
      unfollowRes.data.data.followers === guestSeller.data.data.followers && !unfollowRes.data.data.is_following,
      'Theo dõi được lưu, không tính trùng và có thể hủy theo dõi'
    );
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
      content: 'Đề nghị giá 1.500.000 ₫ cho sản phẩm này.'
    }, memberToken);
    const sentMessage = sendMsgRes.data.data.message;
    assert(
      sendMsgRes.status === 201 && sentMessage.content.includes('Đề nghị giá 1.500.000') &&
      !Number.isNaN(new Date(sentMessage.created_at || sentMessage.createdAt).getTime()) && sentMessage.is_read === false,
      '22. Gửi tin nhắn với thời gian và trạng thái chưa xem'
    );

    const getMsgsRes = await request('GET', `/api/chat/conversations/${convId}/messages`, null, adminToken);
    const readMessage = getMsgsRes.data.data.messages.find(message => message.id === sentMessage.id);
    assert(getMsgsRes.status === 200 && readMessage?.is_read === true, '23. Mở hội thoại cập nhật tin nhắn thành đã xem');
    const readStatusRes = await request('GET', `/api/chat/conversations/${convId}/read-status`, null, memberToken);
    assert(readStatusRes.status === 200 && readStatusRes.data.data.readMessageIds.includes(sentMessage.id), '23a. Đồng bộ trạng thái đã xem không tải lại trang');
    const messageToRecall = await request('POST', `/api/chat/conversations/${convId}/messages`, {
      content: 'Tin nhắn dùng để kiểm tra thu hồi'
    }, memberToken);
    const recalledMessageId = messageToRecall.data.data.message.id;
    const recallRes = await request('PATCH', `/api/chat/conversations/${convId}/messages/${recalledMessageId}/recall`, null, memberToken);
    const messagesAfterRecall = await request('GET', `/api/chat/conversations/${convId}/messages`, null, memberToken);
    assert(
      recallRes.status === 200 && recallRes.data.data.message.is_recalled === true &&
      messagesAfterRecall.data.data.messages.some(message => message.id === recalledMessageId &&
        message.is_recalled && message.content === 'Tin nhắn đã được thu hồi'),
      '23b. Thu hồi tin nhắn qua đúng API của giao diện và lưu trạng thái khi tải lại'
    );

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
      name: 'Danh mục kiểm thử API',
      icon: 'bi-heart'
    }, adminToken);
    assert(createCatRes.status === 201 && createCatRes.data.data.category.id, '32. Quản lý danh mục: Thêm danh mục mới');
    if (createCatRes.status === 201) {
      await models.Category.destroy({ where: { id: createCatRes.data.data.category.id } });
    }

    // Xử lý báo cáo vi phạm
    const processReportRes = await request('PATCH', `/api/admin/reports/${reportId}/process`, {
      status: 'resolved',
      admin_note: 'Đã xác minh và nhắc nhở người bán.',
      hide_product: false
    }, adminToken);
    assert(processReportRes.status === 200 && processReportRes.data.data.report.status === 'resolved', '33. Xử lý báo cáo vi phạm (Admin)');

    // ----------------------------------------------------
    // TEST 9: BÌNH LUẬN SẢN PHẨM (Gửi -> PENDING -> Admin duyệt/từ chối)
    // ----------------------------------------------------
    console.log('\n📌 NHÓM 9: BÌNH LUẬN SẢN PHẨM');
    const commentProductId = otherProduct.id;

    const initialCommentsRes = await request('GET', `/api/products/${commentProductId}/comments`);
    assert(
      initialCommentsRes.status === 200 && Array.isArray(initialCommentsRes.data.data.comments),
      '35. Xem danh sách bình luận công khai của sản phẩm'
    );

    const guestCommentRes = await request('POST', `/api/products/${commentProductId}/comments`, {
      content: 'Khách chưa đăng nhập không được bình luận'
    });
    assert(guestCommentRes.status === 401, '36. Chặn người chưa đăng nhập gửi bình luận');

    const emptyCommentRes = await request('POST', `/api/products/${commentProductId}/comments`, {
      content: '   '
    }, memberToken);
    assert(emptyCommentRes.status === 400, '37. Từ chối nội dung bình luận trống');

    const forgedRes = await request('POST', `/api/products/${commentProductId}/comments`, {
      content: 'Bình luận gửi kèm dữ liệu giả mạo',
      status: 'APPROVED',
      user_id: memberUser.id + 999,
      product_id: createdProductId
    }, memberToken);
    const forgedComment = forgedRes.status === 201
      ? await models.Comment.findByPk(forgedRes.data.data.comment.id)
      : null;
    assert(
      forgedComment && forgedComment.status === 'PENDING' &&
      forgedComment.user_id === memberUser.id && forgedComment.product_id === commentProductId,
      '38. Bỏ qua status/user_id/product_id giả mạo từ trình duyệt'
    );

    const xssCommentRes = await request('POST', `/api/products/${commentProductId}/comments`, {
      content: '<img src=x onerror=alert(1)> Sản phẩm rất tốt!',
      rating: 4
    }, memberToken);
    const newCommentId = xssCommentRes.status === 201 ? xssCommentRes.data.data.comment.id : null;
    const createdComment = newCommentId ? await models.Comment.findByPk(newCommentId) : null;
    assert(
      xssCommentRes.status === 201 && createdComment && createdComment.status === 'PENDING' &&
      !createdComment.content.includes('<img'),
      '39. Gửi bình luận ở trạng thái PENDING và làm sạch thẻ HTML'
    );

    const hiddenBeforeRes = await request('GET', `/api/products/${commentProductId}/comments`);
    const sellerBeforeApproval = await request('GET', sellerUrl);
    assert(
      hiddenBeforeRes.status === 200 && !hiddenBeforeRes.data.data.comments.some(c => c.id === newCommentId),
      '40. Ẩn bình luận PENDING khỏi danh sách công khai'
    );

    const otherProductCommentsRes = await request('GET', `/api/products/${createdProductId}/comments`);
    assert(
      otherProductCommentsRes.status === 200 && !otherProductCommentsRes.data.data.comments.some(c => c.id === newCommentId),
      '41. Bình luận không xuất hiện ở sản phẩm khác'
    );

    const adminCommentsRes = await request('GET', '/api/admin/comments?status=PENDING', null, adminToken);
    assert(
      adminCommentsRes.status === 200 && adminCommentsRes.data.data.comments.some(c => c.id === newCommentId),
      '42. Admin xem danh sách bình luận chờ duyệt'
    );

    const approveCommentRes = await request('PATCH', `/api/admin/comments/${newCommentId}/review`, {
      action: 'approve'
    }, adminToken);
    assert(
      approveCommentRes.status === 200 && approveCommentRes.data.data.comment.status === 'APPROVED',
      '43. Admin duyệt bình luận'
    );

    const visibleAfterRes = await request('GET', `/api/products/${commentProductId}/comments`);
    assert(
      visibleAfterRes.status === 200 && visibleAfterRes.data.data.comments.some(c => c.id === newCommentId),
      '44. Bình luận đã duyệt xuất hiện đúng sản phẩm'
    );
    const sellerAfterApproval = await request('GET', sellerUrl);
    assert(
      visibleAfterRes.data.data.comments.some(c => c.id === newCommentId && c.rating === 4) &&
      sellerAfterApproval.data.data.rating_count === sellerBeforeApproval.data.data.rating_count + 1,
      'Điểm đánh giá chỉ được tính sau khi bình luận được duyệt'
    );

    const stillNotOnOtherRes = await request('GET', `/api/products/${createdProductId}/comments`);
    assert(
      stillNotOnOtherRes.status === 200 && !stillNotOnOtherRes.data.data.comments.some(c => c.id === newCommentId),
      '45. Bình luận đã duyệt vẫn không xuất hiện ở sản phẩm khác'
    );

    const rejectCommentRes = await request('PATCH', `/api/admin/comments/${newCommentId}/review`, {
      action: 'reject'
    }, adminToken);
    assert(
      rejectCommentRes.status === 200 && rejectCommentRes.data.data.comment.status === 'REJECTED',
      '46. Admin từ chối bình luận'
    );

    const hiddenAfterRejectRes = await request('GET', `/api/products/${commentProductId}/comments`);
    assert(
      hiddenAfterRejectRes.status === 200 && !hiddenAfterRejectRes.data.data.comments.some(c => c.id === newCommentId),
      '47. Bình luận bị từ chối không còn hiển thị công khai'
    );

    const noPublicStatusRes = await request('PATCH', `/api/products/${commentProductId}/comments/${newCommentId}/review`, {
      status: 'APPROVED'
    }, memberToken);
    assert(noPublicStatusRes.status === 404, '48. Không có API public cho phép đổi trạng thái bình luận');

    // ----------------------------------------------------
    // TEST 10: QUẢN LÝ BÌNH LUẬN NÂNG CAO (Admin)
    // ----------------------------------------------------
    console.log('\n📌 NHÓM 10: QUẢN LÝ BÌNH LUẬN NÂNG CAO (Admin)');

    const commentStatsRes = await request('GET', '/api/admin/dashboard/stats', null, adminToken);
    const commentStats = commentStatsRes.data.data.comments;
    assert(
      commentStatsRes.status === 200 &&
      ['total', 'pending', 'approved', 'rejected'].every(k => typeof commentStats[k] === 'number') &&
      commentStats.total === commentStats.pending + commentStats.approved + commentStats.rejected,
      '49. Thống kê đủ tổng/chờ duyệt/đã duyệt/từ chối bình luận'
    );

    const searchByProductRes = await request('GET', `/api/admin/comments?status=all&q=${encodeURIComponent(otherProduct.title)}`, null, adminToken);
    assert(
      searchByProductRes.status === 200 && searchByProductRes.data.data.comments.some(c => c.id === newCommentId),
      '50. Tìm kiếm bình luận theo tên sản phẩm'
    );

    const searchByUsernameRes = await request('GET', `/api/admin/comments?status=all&q=${encodeURIComponent(memberUser.username)}`, null, adminToken);
    assert(
      searchByUsernameRes.status === 200 && searchByUsernameRes.data.data.comments.some(c => c.id === newCommentId),
      '51. Tìm kiếm bình luận theo tên đăng nhập người dùng'
    );

    const searchByFullNameRes = await request('GET', `/api/admin/comments?status=all&q=${encodeURIComponent(updateProfileRes.data.data.user.full_name)}`, null, adminToken);
    assert(
      searchByFullNameRes.status === 200 && searchByFullNameRes.data.data.comments.some(c => c.id === newCommentId),
      '52. Tìm kiếm bình luận theo họ tên người dùng'
    );

    const searchByContentRes = await request('GET', `/api/admin/comments?status=all&q=${encodeURIComponent('dữ liệu giả mạo')}`, null, adminToken);
    assert(
      searchByContentRes.status === 200 && searchByContentRes.data.data.comments.some(c => c.id === forgedComment.id),
      '53. Tìm kiếm bình luận theo nội dung'
    );

    const searchNoResultRes = await request('GET', `/api/admin/comments?status=all&q=${encodeURIComponent('chuỗi-khong-ton-tai-xyz-999')}`, null, adminToken);
    assert(
      searchNoResultRes.status === 200 && searchNoResultRes.data.data.comments.length === 0,
      '54. Tìm kiếm không trùng trả về danh sách rỗng'
    );

    const commentWithImageRes = await request('GET', `/api/admin/comments?status=all&q=${encodeURIComponent(otherProduct.title)}`, null, adminToken);
    assert(
      commentWithImageRes.status === 200 &&
      Array.isArray(commentWithImageRes.data.data.comments[0].product.images),
      '55. API Admin trả về hình ảnh sản phẩm để hiển thị cột ảnh'
    );

    const memberAdminListRes = await request('GET', '/api/admin/comments?status=all', null, memberToken);
    assert(memberAdminListRes.status === 403, '56. Thành viên không được gọi API danh sách bình luận Admin');

    const memberDeleteRes = await request('DELETE', `/api/admin/comments/${forgedComment.id}`, null, memberToken);
    assert(memberDeleteRes.status === 403, '57. Thành viên không được xóa bình luận');

    const invalidActionRes = await request('PATCH', `/api/admin/comments/${newCommentId}/review`, {
      action: 'unknown'
    }, adminToken);
    assert(invalidActionRes.status === 400, '58. Từ chối action duyệt không hợp lệ');

    const approveForgedRes = await request('PATCH', `/api/admin/comments/${forgedComment.id}/review`, {
      action: 'approve'
    }, adminToken);
    assert(approveForgedRes.status === 200, '59. Admin duyệt bình luận trước khi xóa');

    const publicBeforeDeleteRes = await request('GET', `/api/products/${commentProductId}/comments`);
    assert(
      publicBeforeDeleteRes.status === 200 && publicBeforeDeleteRes.data.data.comments.some(c => c.id === forgedComment.id),
      '60. Bình luận đã duyệt hiển thị công khai trước khi xóa'
    );

    const deleteCommentRes = await request('DELETE', `/api/admin/comments/${forgedComment.id}`, null, adminToken);
    assert(deleteCommentRes.status === 200, '61. Admin xóa bình luận thành công');

    const deletedCommentRes = await models.Comment.findByPk(forgedComment.id);
    assert(deletedCommentRes === null, '62. Bản ghi bình luận đã bị xóa khỏi database');

    const publicAfterDeleteRes = await request('GET', `/api/products/${commentProductId}/comments`);
    assert(
      publicAfterDeleteRes.status === 200 && !publicAfterDeleteRes.data.data.comments.some(c => c.id === forgedComment.id),
      '63. Bình luận sau khi xóa biến mất khỏi trang công khai'
    );

    // Dọn dẹp dữ liệu bình luận của riêng kịch bản test
    const testCommentIds = [forgedRes.data.data.comment.id, newCommentId].filter(Boolean);
    if (testCommentIds.length > 0) {
      await models.Comment.destroy({ where: { id: testCommentIds } });
    }

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
