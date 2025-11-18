const express = require('express');
const { protect, restrictTo } = require('../middleware/auth.middleware');
const apiKeyController = require('../controllers/api-key.controller');

const router = express.Router();

// Lấy danh sách API keys (Chỉ admin)
router.get('/', protect, restrictTo('admin'), apiKeyController.getAllApiKeys);

// Tạo API key mới (Chỉ admin)
router.post('/', protect, restrictTo('admin'), apiKeyController.createApiKey);

// Lấy API key theo tên model (Public API - cho frontend)
router.get('/model/:model', apiKeyController.getApiKeyByModel);

// Lấy chi tiết API key theo ID (Chỉ admin)
router.get('/:id', protect, restrictTo('admin'), apiKeyController.getApiKeyById);

// Cập nhật API key (Chỉ admin)
router.patch('/:id', protect, restrictTo('admin'), apiKeyController.updateApiKey);

// Xóa API key (Chỉ admin)
router.delete('/:id', protect, restrictTo('admin'), apiKeyController.deleteApiKey);

// Cập nhật thông tin sử dụng API key (Chỉ admin)
router.patch('/:id/update-usage', protect, restrictTo('admin'), apiKeyController.updateApiKeyUsage);

router.put('/:id/soft-delete', protect, restrictTo('admin'), apiKeyController.softDeleteApiKey); 

// Route kiểm tra kết nối đơn giản
router.get('/check', (req, res) => {
  res.status(200).json({
    status: 'success',
    message: 'API Key service is working',
    timestamp: new Date().toISOString()
  });
});

module.exports = router; 