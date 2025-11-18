const express = require('express');
const adminController = require('../controllers/admin.controller');
const authMiddleware = require('../middleware/auth.middleware');

const router = express.Router();

// Đảm bảo tất cả các routes dưới đây đều yêu cầu người dùng đã đăng nhập và có quyền admin
router.use(authMiddleware.protect, authMiddleware.restrictTo('admin', 'mode'));

// Routes quản lý người dùng
router.route('/users')
  .get(adminController.getAllUsers)
  .post(adminController.createUser);

router.route('/users/:id')
  .get(adminController.getUserById)
  .patch(adminController.updateUser)
  .delete(adminController.deleteUser);

router.patch('/users/:id/reset-password', adminController.resetUserPassword);

module.exports = router; 