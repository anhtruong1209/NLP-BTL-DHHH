const express = require('express');
const router = express.Router();
const courseController = require('../controllers/course.controller');
const authMiddleware = require('../middleware/auth.middleware');

// Course routes
router.get('/', courseController.getAllCourses);
router.get('/:id', courseController.getCourseById);

// Protected routes - admin only
router.use(authMiddleware.protect);
router.use(authMiddleware.restrictTo('admin'));

router.post('/', courseController.createCourse);
router.patch('/:id', courseController.updateCourse);
router.put('/:id/soft-delete', courseController.deleteCourse);

module.exports = router;