const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const morgan = require('morgan');
const path = require('path');
require('dotenv').config();

const apiRoutes = require('./routes/api');

const app = express();

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('dev'));
}

// Phục vụ tài nguyên tĩnh (giao diện frontend và ảnh uploads)
const publicDir = path.join(__dirname, '../public');
app.use(express.static(publicDir));
app.use('/uploads', express.static(path.join(publicDir, 'uploads')));

// Gắn kết tất cả các API routes tại /api
app.use('/api', apiRoutes);

// Phục vụ các trang HTML giao diện người dùng
app.get('/login', (req, res) => res.sendFile(path.join(publicDir, 'login.html')));
app.get('/register', (req, res) => res.sendFile(path.join(publicDir, 'register.html')));
app.get('/profile', (req, res) => res.sendFile(path.join(publicDir, req.query.profile !== undefined ? 'seller-profile.html' : 'profile.html')));
app.get('/post', (req, res) => res.sendFile(path.join(publicDir, 'post.html')));
app.get('/product/:id', (req, res) => res.sendFile(path.join(publicDir, 'product-detail.html')));
app.get('/favorites', (req, res) => res.sendFile(path.join(publicDir, 'favorites.html')));
app.get('/chat', (req, res) => res.sendFile(path.join(publicDir, 'chat.html')));
app.get('/my-reports', (req, res) => res.sendFile(path.join(publicDir, 'reports.html')));
app.get('/admin', (req, res) => res.sendFile(path.join(publicDir, 'admin.html')));

// Route mặc định trang chủ
app.get('/', (req, res) => res.sendFile(path.join(publicDir, 'index.html')));

// Middleware xử lý 404 cho API
app.use('/api/*', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'Không tìm thấy API endpoint này.'
  });
});

// Middleware xử lý lỗi tập trung
app.use((err, req, res, next) => {
  console.error('Unhandled Error:', err);
  const status = err.status || 500;
  res.status(status).json({
    success: false,
    message: err.message || 'Lỗi hệ thống máy chủ.',
    error: process.env.NODE_ENV === 'development' ? err.stack : undefined
  });
});

module.exports = app;
