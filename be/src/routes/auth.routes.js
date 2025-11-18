const express = require('express');
const authController = require('../controllers/auth.controller');
const authMiddleware = require('../middleware/auth.middleware');

const router = express.Router();

// Đăng ký và đăng nhập
router.post('/register', authController.register);
router.post('/login', authController.login);
router.post('/logout', authController.logout);

// SSO endpoints
router.post('/sso/callback', authController.ssoCallback);
router.post('/sso/token-login', authController.ssoTokenLogin);

// Yêu cầu xác thực cho các route sau
router.use(authMiddleware.protect);

// Lấy thông tin người dùng hiện tại
router.get('/me', authController.getMe);

// Cập nhật thông tin cá nhân và mật khẩu
router.patch('/update-profile', authController.updateProfile);
router.patch('/update-password', authController.updatePassword);

module.exports = router; 