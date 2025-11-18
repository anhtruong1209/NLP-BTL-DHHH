const express = require('express');
const userController = require('../controllers/user.controller');
const authMiddleware = require('../middleware/auth.middleware');

const router = express.Router();

// Tất cả các routes đều yêu cầu xác thực
router.use(authMiddleware.protect);

// Lấy thông tin người dùng hiện tại
router.get('/me', userController.getMe);

// Các routes dưới đây yêu cầu quyền admin
router.use(authMiddleware.requireAdmin);

// Quản lý người dùng (chỉ admin)
router.get('/', userController.getAllUsers);
router.get('/:id', userController.getUserById);
router.post('/', userController.createUser);
router.patch('/:id', userController.updateUser);
router.delete('/:id', userController.deleteUser);
router.put('/:id/soft-delete', userController.softDeleteUser);
router.put('/:id/restore', userController.restoreUser);

module.exports = router; 