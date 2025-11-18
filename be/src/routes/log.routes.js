const express = require('express');
const logController = require('../controllers/log.controller');
const authMiddleware = require('../middleware/auth.middleware');

const router = express.Router();

// Chỉ admin mới có quyền truy cập các route log
router.use(authMiddleware.protect);
router.use(authMiddleware.restrictTo('admin'));

// Routes cho logs
router.route('/')
  .get(logController.getLogs)
  .post(logController.createLog);

router.route('/:id')
  .get(logController.getLogById);

router.route('/delete-old')
  .post(logController.deleteOldLogs);

module.exports = router; 