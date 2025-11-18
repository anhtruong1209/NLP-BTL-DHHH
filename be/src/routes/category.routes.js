const express = require('express');
const categoryController = require('../controllers/category.controller');
const authMiddleware = require('../middleware/auth.middleware');

const router = express.Router();

// Các route công khai
router.get('/', categoryController.getAllCategories);
router.get('/:id', categoryController.getCategoryById);
router.get('/:id/tools', categoryController.getCategoryWithTools);

// Các route yêu cầu quyền admin
router.use(authMiddleware.protect);
router.use(authMiddleware.requireAdmin);

router.post('/', categoryController.createCategory);
router.patch('/:id', categoryController.updateCategory);
router.delete('/:id', categoryController.deleteCategory);
router.put('/:id/soft-delete', categoryController.softDeleteCategory); 

module.exports = router; 