const express = require('express');
const router = express.Router();

const authRoutes = require('./auth.routes');
const userRoutes = require('./user.routes');
const productRoutes = require('./product.routes');
const categoryRoutes = require('./category.routes');
const favoriteRoutes = require('./favorite.routes');
const chatRoutes = require('./chat.routes');
const reportRoutes = require('./report.routes');
const adminRoutes = require('./admin.routes');
const orderRoutes = require('./order.routes');

router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/products', productRoutes);
router.use('/categories', categoryRoutes);
router.use('/favorites', favoriteRoutes);
router.use('/chat', chatRoutes);
router.use('/reports', reportRoutes);
router.use('/admin', adminRoutes);
router.use('/orders', orderRoutes);

// Thông tin API & Healthcheck
router.get('/health', (req, res) => {
  res.status(200).json({
    status: 'online',
    timestamp: new Date().toISOString(),
    service: 'Patuhi Marketplace API'
  });
});

module.exports = router;
