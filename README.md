# 2ndtech.vn — giao diện tham khảo

## Chạy dự án

```bash
npm run dev
```

Mở `http://localhost:3000`. Nếu PowerShell chặn `npm.ps1`, chạy `npm.cmd run dev`.

## Cấu trúc cần nhớ

- `server.js`: Node.js server, phục vụ `public/`, ghép các partial vào trang và proxy API địa giới.
- `public/index.html`: nội dung trang; giữ CSS và JavaScript trong file riêng.
- `public/2ndtech.css`: stylesheet chính.
- `public/2ndtech.js`: hành vi giao diện và render các thẻ tin.
- `public/partials/header.html`: header dùng lại bằng `<div data-include="partials/header.html"></div>`.
- `public/partials/footer.html`: footer dùng lại bằng `<div data-include="partials/footer.html"></div>`.
- `public/partials/community-feed.html`: feed cộng đồng dùng lại bằng `<div data-include="partials/community-feed.html"></div>`.

Server hiện thay các `data-include` trên khi trả về trang chủ. Khi thêm partial mới, cập nhật phần ghép partial và route phục vụ trong `server.js`.

## API khu vực

- `GET /api/provinces`: danh sách tỉnh/thành.
- `GET /api/provinces/:code/wards`: phường/xã theo mã tỉnh/thành.
- Node server proxy tới Province Open API v2 và cache phản hồi trong một giờ.

Khi chỉnh giao diện, giữ nguyên các URL ảnh tham chiếu và các kích thước CSS đã được cung cấp, trừ khi có yêu cầu thay đổi cụ thể.

## Phiên bản cache tài nguyên

- Mỗi lần sửa `public/2ndtech.css`, tăng số `v` trong `2ndtech.css?v=...` ở `public/index.html` đúng một lần.
- Mỗi lần sửa `public/2ndtech.js`, tăng số `v` trong `2ndtech.js?v=...` ở `public/index.html` đúng một lần.
- Không cần tăng version của tài nguyên không thay đổi.
