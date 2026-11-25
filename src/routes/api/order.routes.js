const express = require('express');
const router = express.Router();

const { authenticate, authorize } = require('../../middlewares/auth');
const orderController = require('../../controllers/orderController');

// Mọi endpoint đơn hàng thật đều yêu cầu đăng nhập ở tầng backend.
router.use(authenticate);

router.post('/', authorize('member', 'admin'), orderController.createOrder);

// Đặt các route tĩnh trước /:id để tránh bị bắt nhầm như một mã số.
router.get('/buyer', orderController.getBuyerOrders);
router.get('/buyer/summary', orderController.getBuyerOrderSummary);
router.get('/seller', orderController.getSellerOrders);

router.get('/:id', orderController.getOrderDetail);
router.patch('/:id/status', orderController.updateOrderStatus);
router.post('/:id/cancel', orderController.cancelOrder);

module.exports = router;
