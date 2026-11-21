const express = require('express');
const router = express.Router();
const authController = require('../../controllers/authController');
const { authenticate } = require('../../middlewares/auth');
const { registerRules, loginRules, validate } = require('../../middlewares/validator');

router.post('/register', registerRules, validate, authController.register);
router.post('/login', loginRules, validate, authController.login);
router.post('/logout', authController.logout);
router.get('/me', authenticate, authController.getMe);

// Routes cho Đăng ký / Đăng nhập bằng Google
router.get('/google/client-id', authController.getGoogleClientId);
router.post('/google', authController.googleAuth);
router.get('/google/url', authController.getGoogleRedirectUrl);
router.get('/google/callback', authController.googleCallback);

module.exports = router;
