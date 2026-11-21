const express = require('express');
const router = express.Router();
const adminController = require('../../controllers/adminController');
const { authenticate, authorize } = require('../../middlewares/auth');

// Toàn bộ route admin yêu cầu đăng nhập và có role admin
router.use(authenticate, authorize('admin'));

// 1. Thống kê tổng quan (Dashboard)
router.get('/dashboard/stats', adminController.getDashboardStats);

// 2. Duyệt tin đăng
router.get('/products', adminController.getProductsForAdmin);
router.patch('/products/:id/review', adminController.reviewProduct);

// 3. Quản lý người dùng
router.get('/users', adminController.getUsers);
router.patch('/users/:id/status', adminController.toggleUserStatus);
router.put('/users/:id/role', adminController.changeUserRole);

// 4. Quản lý danh mục
router.post('/categories', adminController.createCategory);
router.put('/categories/:id', adminController.updateCategory);
router.delete('/categories/:id', adminController.deleteCategory);

// 5. Xử lý báo cáo vi phạm
router.get('/reports', adminController.getReports);
router.patch('/reports/:id/process', adminController.processReport);

// 6. Duyệt và quản lý bình luận
router.get('/comments', adminController.getCommentsForAdmin);
router.patch('/comments/:id/review', adminController.reviewComment);
router.delete('/comments/:id', adminController.deleteComment);

module.exports = router;
