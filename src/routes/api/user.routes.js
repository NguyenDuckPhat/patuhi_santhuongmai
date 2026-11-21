const express = require('express');
const router = express.Router();
const userController = require('../../controllers/userController');
const sellerController = require('../../controllers/sellerController');
const { authenticate, optionalAuth } = require('../../middlewares/auth');
const { uploadAvatar } = require('../../middlewares/upload');
const { changePasswordRules, validate } = require('../../middlewares/validator');

router.get('/profile', authenticate, userController.getProfile);
router.put('/profile', authenticate, uploadAvatar, userController.updateProfile);
router.put('/change-password', authenticate, changePasswordRules, validate, userController.changePassword);
router.get('/my-listings', authenticate, userController.getMyListings);
router.get('/:id/seller', optionalAuth, sellerController.getSeller);
router.get('/:id/seller/listings', optionalAuth, sellerController.getListings);
router.put('/:id/follow', authenticate, sellerController.updateFollow);
router.delete('/:id/follow', authenticate, sellerController.updateFollow);

module.exports = router;
