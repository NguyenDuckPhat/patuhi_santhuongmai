const express = require('express');
const router = express.Router();
const userController = require('../../controllers/userController');
const { authenticate } = require('../../middlewares/auth');
const { uploadAvatar } = require('../../middlewares/upload');
const { changePasswordRules, validate } = require('../../middlewares/validator');

router.get('/profile', authenticate, userController.getProfile);
router.put('/profile', authenticate, uploadAvatar, userController.updateProfile);
router.put('/change-password', authenticate, changePasswordRules, validate, userController.changePassword);
router.get('/my-listings', authenticate, userController.getMyListings);

module.exports = router;
