const express = require('express');
const router = express.Router();
const courseDetailController = require('../controllers/course-detail.controller');
const { protect, restrictTo } = require('../middleware/auth.middleware');
const path = require('path');

// Public routes
router.get('/', courseDetailController.getAllCourseDetails);
router.get('/id/:id', courseDetailController.getCourseDetailById);



// Protected routes (require authentication)
router.use(protect, restrictTo('admin'));
// Route riêng cho việc tăng lượt xem - không yêu cầu xác thực
router.post('/:id/view', courseDetailController.incrementViewCount);
router.post('/', courseDetailController.createCourseDetail);
router.patch('/:id', courseDetailController.updateCourseDetail);
router.put('/:id/soft-delete', courseDetailController.softDeleteCourseDetail);

module.exports = router; 