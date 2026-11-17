# 🛒 Sàn Thương Mại Điện Tử & Trao Đổi Đồ Cũ Patuhi (C2C Marketplace)

Hệ thống Website & RESTful API hoàn chỉnh xây dựng bằng **Node.js, Express, Sequelize (MySQL / SQLite), Socket.io, JWT Authentication và Giao diện Web Responsive hiện đại**.

---

## 📋 Danh Sách 35 Yêu Cầu Đã Được Hiện Thực

1. ✅ **Khởi tạo dự án Node.js, Express**: Cấu hình `package.json`, cài đặt các thư viện cần thiết, thiết lập môi trường `.env`.
2. ✅ **Thiết kế cấu trúc thư mục dự án**: Cấu trúc MVC chuẩn (`src/config`, `src/models`, `src/controllers`, `src/middlewares`, `src/routes`, `src/utils`, `public`, `test`).
3. ✅ **Kết nối cơ sở dữ liệu MySQL hoặc MongoDB**: Sử dụng **Sequelize** hỗ trợ kết nối trực tiếp MySQL (mặc định trong Laragon: `localhost:3306`, user `root`, pass `""`), tự động tạo database `patuhi_santhuongmai` nếu chưa có. Đồng thời hỗ trợ cơ chế SQLite dự phòng thông minh khi MySQL chưa bật. Cung cấp cả file `schema.sql` để import trực tiếp qua HeidiSQL/phpMyAdmin.
4. ✅ **Thiết kế bảng người dùng**: Bảng `users` với đầy đủ trường: `id`, `username`, `email`, `password` (hash bcrypt), `full_name`, `phone`, `avatar`, `role` (`guest`, `member`, `admin`), `status` (`active`, `locked`).
5. ✅ **Đăng ký tài khoản**: `POST /api/auth/register`, kiểm tra validation (độ dài, định dạng email, sđt Việt Nam), chống trùng lặp `username`/`email`.
6. ✅ **Đăng nhập, đăng xuất**: `POST /api/auth/login`, `POST /api/auth/logout`. Hỗ trợ đăng nhập bằng username hoặc email, cấp JWT Token và thiết lập Cookie httpOnly.
7. ✅ **Phân quyền khách, thành viên, quản trị viên**:
   - `guest`: Xem danh sách sản phẩm, chi tiết sản phẩm, tìm kiếm, lọc danh mục/giá.
   - `member`: Đăng tin, sửa/xóa tin của mình, yêu thích, nhắn tin, báo cáo vi phạm, theo dõi báo cáo.
   - `admin`: Duyệt tin, khóa/mở khóa user, quản lý danh mục, xử lý báo cáo, xem thống kê dashboard.
8. ✅ **Quản lý thông tin tài khoản**: `GET /api/users/profile`, `PUT /api/users/profile` (cập nhật họ tên, sđt, đổi avatar), `PUT /api/users/change-password` (kiểm tra mật khẩu cũ), `GET /api/users/my-listings`.
9. ✅ **Middleware xác thực và phân quyền**: `authenticate` (kiểm tra JWT từ Bearer header hoặc Cookie), `optionalAuth` (gán user nếu có token), `authorize(...roles)` (kiểm tra quyền role).
10. ✅ **Xem danh sách sản phẩm**: `GET /api/products` (phân trang, sắp xếp theo mới nhất, giá tăng/giảm, lượt xem, kèm ảnh chính, người bán, danh mục).
11. ✅ **Xem chi tiết sản phẩm**: `GET /api/products/:id` (tăng lượt xem, hiển thị thư viện ảnh, thông tin người bán, tình trạng yêu thích, 4 sản phẩm liên quan).
12. ✅ **Tìm kiếm sản phẩm**: Tham số `?q=...` tìm kiếm trong tiêu đề và mô tả sản phẩm.
13. ✅ **Lọc sản phẩm theo danh mục, giá**: Tham số `?category_id=...`, `?min_price=...`, `?max_price=...`, `?condition=...`, `?location=...`.
14. ✅ **Đăng tin bán sản phẩm**: `POST /api/products`, hỗ trợ tải lên tối đa 5 hình ảnh qua Multer, lưu vào `public/uploads/products/`. Tin mới của thành viên có trạng thái `pending` chờ duyệt.
15. ✅ **Sửa thông tin tin đăng**: `PUT /api/products/:id`, chỉ chủ sở hữu hoặc admin mới có quyền sửa, hỗ trợ thêm ảnh mới và xóa ảnh cũ.
16. ✅ **Xóa tin đăng**: `DELETE /api/products/:id`, xóa bản ghi trong DB và tự động dọn dẹp các file ảnh vật lý trên ổ cứng.
17. ✅ **Quản lý hình ảnh sản phẩm**: Tải nhiều ảnh qua Multer, gán ảnh chính (`is_primary`), xóa ảnh khi sửa hoặc xóa tin.
18. ✅ **Quản lý trạng thái tin đăng**: `PATCH /api/products/:id/status` (`pending`, `approved`, `rejected`, `sold`, `hidden`). Thành viên có thể đổi sang `sold` hoặc `hidden`.
19. ✅ **Quản lý danh sách yêu thích**: `GET /api/favorites`.
20. ✅ **Thêm sản phẩm vào yêu thích**: `POST /api/favorites/:productId`.
21. ✅ **Xóa sản phẩm khỏi yêu thích**: `DELETE /api/favorites/:productId`.
22. ✅ **Nhắn tin giữa người mua và người bán**: Hỗ trợ Real-time thông qua **Socket.io** (`join_conversation`, `receive_message`) và REST API `POST /api/chat/conversations` (mở/tạo hội thoại theo sản phẩm).
23. ✅ **Xem lịch sử tin nhắn**: `GET /api/chat/conversations` (danh sách hội thoại) và `GET /api/chat/conversations/:id/messages` (danh sách tin nhắn, tự động đánh dấu đã đọc).
24. ✅ **Báo cáo vi phạm tin đăng**: `POST /api/reports` với các lý do: `fraud` (lừa đảo), `fake` (hàng giả), `offensive` (phản cảm), `wrong_category` (sai danh mục), `other`.
25. ✅ **Theo dõi trạng thái xử lý báo cáo**: `GET /api/reports/my-reports` (`pending`, `reviewed`, `resolved`, `dismissed`) kèm ghi chú phản hồi từ Quản trị viên.
26. ✅ **Kiểm tra quyền thành viên khi sử dụng chức năng**: Người dùng chưa đăng nhập hoặc bị khóa sẽ nhận được mã lỗi `401 Unauthorized` hoặc `403 Forbidden` cùng thông báo rõ ràng.
27. ✅ **Duyệt tin đăng**: Admin duyệt (`PATCH /api/admin/products/:id/review` với action `approve` hoặc `reject` kèm lý do).
28. ✅ **Quản lý người dùng**: `GET /api/admin/users` (tìm kiếm, lọc vai trò, lọc trạng thái, phân trang).
29. ✅ **Khóa hoặc mở khóa tài khoản**: `PATCH /api/admin/users/:id/status` (đổi trạng thái `active` <-> `locked`). Chặn người bị khóa đăng nhập ngay lập tức.
30. ✅ **Quản lý danh mục sản phẩm**: `POST`, `PUT`, `DELETE /api/admin/categories` (CRUD danh mục với icon, slug, tên).
31. ✅ **Xử lý báo cáo vi phạm**: `GET /api/admin/reports`, `PATCH /api/admin/reports/:id/process` (duyệt báo cáo, nhập ghi chú, tùy chọn gỡ bỏ tin vi phạm tự động).
32. ✅ **Thống kê số lượng người dùng**: `GET /api/admin/dashboard/stats` (tổng user, đang hoạt động, bị khóa, số admin, số member).
33. ✅ **Thống kê tin đăng**: Thống kê tổng số tin, tin chờ duyệt, tin đã duyệt, tin đã bán, tin bị từ chối, và tin theo từng danh mục.
34. ✅ **Thống kê báo cáo**: Tổng số báo cáo, báo cáo chờ xử lý, báo cáo đã giải quyết, báo cáo đã bác bỏ.
35. ✅ **Kiểm thử API và giao diện**: 
    - File kiểm thử tự động `test/test-api.js` chạy qua toàn bộ 34 trường hợp kiểm thử (Pass 34/34 test cases).
    - Giao diện web hoàn chỉnh, trực quan, chạy trực tiếp tại `http://localhost:3000`.

---

## 🚀 Hướng Dẫn Cài Đặt & Chạy Ứng Dụng

### 1. Khởi động MySQL trong Laragon (Tùy chọn)
- Mở **Laragon** và nhấn nút **Start All** để khởi động MySQL.
- Cơ sở dữ liệu mặc định:
  - Host: `127.0.0.1`
  - Port: `3306`
  - User: `root`
  - Password: `(để trống)`
- Ứng dụng sẽ tự động tạo database `patuhi_santhuongmai` và đồng bộ cấu trúc bảng khi khởi động!
- *(Nếu chưa bật MySQL trong Laragon, hệ thống sẽ tự động dùng SQLite dự phòng `database.sqlite` để bạn trải nghiệm ngay mà không gặp lỗi).*

### 2. Khởi chạy Server
Mở terminal tại thư mục `d:\laragon\www\patuhi` và chạy:

```bash
# Cài đặt thư viện (nếu chưa cài)
npm install

# Khởi động máy chủ
npm start
```

Mở trình duyệt truy cập:
👉 **Trang chủ giao diện người dùng**: [http://localhost:3000](http://localhost:3000)  
👉 **Trang Quản Trị Admin**: [http://localhost:3000/admin](http://localhost:3000/admin)

---

## 🔑 Tài Khoản Dùng Thử Mẫu (Được Tự Động Nạp Sẵn)

| Vai trò | Tên đăng nhập | Mật khẩu | Quyền hạn |
| :--- | :--- | :--- | :--- |
| **Quản trị viên (Admin)** | `admin` | `Admin123@password` | Toàn quyền kiểm duyệt tin, quản lý user, khóa nick, danh mục, báo cáo, thống kê |
| **Thành viên 1 (Member)** | `nguyenvana` | `Password123@` | Đăng tin, chat, yêu thích, sửa/xóa tin của mình, gửi báo cáo |
| **Thành viên 2 (Member)** | `tranb` | `Password123@` | Mua bán, chat với người bán, bình luận, báo cáo vi phạm |

---

## 🧪 Chạy Kiểm Thử Tự Động (Automated Testing)

Chạy lệnh kiểm thử tích hợp toàn bộ API và phân quyền:

```bash
npm test
```

Kết quả: Toàn bộ 34 kịch bản kiểm thử API đều vượt qua thành công!
