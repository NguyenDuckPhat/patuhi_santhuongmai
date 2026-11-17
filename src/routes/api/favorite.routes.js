const express = require('express');
const router = express.Router();
const favoriteController = require('../../controllers/favoriteController');
const { authenticate, authorize } = require('../../middlewares/auth');

router.use(authenticate, authorize('member', 'admin'));

router.get('/', favoriteController.getMyFavorites);
router.post('/:productId', favoriteController.addFavorite);
router.delete('/:productId', favoriteController.removeFavorite);

module.exports = router;
