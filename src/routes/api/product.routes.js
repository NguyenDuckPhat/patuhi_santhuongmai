const express = require('express');
const router = express.Router();
const productController = require('../../controllers/productController');
const commentController = require('../../controllers/commentController');
const { authenticate, optionalAuth, authorize } = require('../../middlewares/auth');
const { uploadProductImages } = require('../../middlewares/upload');
const { productRules, validate } = require('../../middlewares/validator');

// Khách và thành viên đều có thể xem danh sách và chi tiết
router.get('/', optionalAuth, productController.getProducts);
router.get('/:id/comments', optionalAuth, commentController.listComments);
router.post('/:id/comments', authenticate, authorize('member', 'admin'), commentController.createComment);
router.get('/:id', optionalAuth, productController.getProductById);

// Thành viên và quản trị viên mới được đăng, sửa, xóa tin
router.post(
  '/',
  authenticate,
  authorize('member', 'admin'),
  uploadProductImages,
  productRules,
  validate,
  productController.createProduct
);

router.put(
  '/:id',
  authenticate,
  authorize('member', 'admin'),
  uploadProductImages,
  productController.updateProduct
);

router.delete(
  '/:id',
  authenticate,
  authorize('member', 'admin'),
  productController.deleteProduct
);

router.patch(
  '/:id/status',
  authenticate,
  authorize('member', 'admin'),
  productController.updateProductStatus
);

module.exports = router;
