const courseModel = require('../models/course.model');
const Log = require('../models/log.model');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');

/**
 * Lấy danh sách khóa học
 */
exports.getAllCourses = catchAsync(async (req, res) => {
  const courses = await courseModel.getAllCourses();
  res.json({
    status: 'success',
    data: courses
  });
});

/**
 * Lấy khóa học theo ID
 */
exports.getCourseById = catchAsync(async (req, res) => {
  const course = await courseModel.getCourseById(req.params.id);
  if (!course) {
    throw new AppError('Không tìm thấy khóa học', 404);
  }
  
  // Ghi log nếu có người dùng đăng nhập
  if (req.user) {
    await Log.createLog({
      userId: req.user.id,
      action: 'VIEW',
      entityType: 'course',
      entityId: course.id,
      description: `User viewed course: ${course.title}`,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent']
    });
  }
  
  res.json({
    status: 'success',
    data: course
  });
});

exports.createCourse = catchAsync(async (req, res) => {
  const course = await courseModel.createCourse(req.body);
  
  // Ghi log tạo khóa học mới
  if (req.user) {
    await Log.createLog({
      userId: req.user.id,
      action: 'CREATE',
      entityType: 'course',
      entityId: course.id,
      description: `Người dùng đã tạo new course: ${course.title}`,
      newData: course,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent']
    });
  }
  
  res.status(201).json({
    status: 'success',
    data: course
  });
});

/**
 * Cập nhật khóa học
 */
exports.updateCourse = catchAsync(async (req, res) => {
  // Lấy thông tin khóa học cũ trước khi cập nhật
  const oldCourse = await courseModel.getCourseById(req.params.id);
  if (!oldCourse) {
    throw new AppError('Không tìm thấy khóa học', 404);
  }
  
  const course = await courseModel.updateCourse(req.params.id, req.body);
  
  // Ghi log cập nhật khóa học
  if (req.user) {
    await Log.createLog({
      userId: req.user.id,
      action: 'UPDATE',
      entityType: 'course',
      entityId: course.id,
      description: `Người dùng thay đổi course: ${course.title}`,
      oldData: oldCourse,
      newData: course,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent']
    });
  }
  
  res.json({
    status: 'success',
    data: course
  });
});

/**
 * Xóa khóa học
 */
exports.deleteCourse = catchAsync(async (req, res) => {
  // Lấy thông tin khóa học trước khi xóa
  const course = await courseModel.getCourseById(req.params.id);
  if (!course) {
    throw new AppError('Không tìm thấy khóa học', 404);
  }
  
  await courseModel.deleteCourse(req.params.id);
  
  // Ghi log xóa khóa học
  if (req.user) {
    await Log.createLog({
      userId: req.user.id,
      action: 'DELETE',
      entityType: 'course',
      entityId: course.id,
      description: `Người dùng đã xóa course: ${course.title}`,
      oldData: course,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent']
    });
  }
  
  res.json({
    status: 'success',
    message: 'Khóa học đã được xóa'
  });
});
