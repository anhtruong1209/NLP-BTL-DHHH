const courseDetailModel = require('../models/course-detail.model');
const Log = require('../models/log.model');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');
const fs = require('fs');
const path = require('path');

/**
 * Lấy tất cả chi tiết khóa học
 */
exports.getAllCourseDetails = catchAsync(async (req, res) => {
  const filters = {
    courseId: req.query.course_id ? parseInt(req.query.course_id) : null,
    search: req.query.search || null
  };
  const courseDetails = await courseDetailModel.getAllCourseDetails(filters);
  res.status(200).json(courseDetails);
});

/**
 * Lấy chi tiết khóa học theo ID
 */
exports.getCourseDetailById = catchAsync(async (req, res, next) => {
  const courseDetail = await courseDetailModel.getCourseDetailById(req.params.id);
  if (!courseDetail) {
    return next(new AppError('Course detail not found', 404));
  }
  
  // Ghi log xem chi tiết khóa học nếu người dùng đăng nhập
  if (req.user) {
    await Log.createLog({
      userId: req.user.id,
      action: 'VIEW',
      entityType: 'course-detail',
      entityId: courseDetail.id,
      description: `Người dùng đã xem chi tiết khóa học: ${courseDetail.title}`,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent']
    });
  }
  
  res.status(200).json(courseDetail);
});

/**
 * Xử lý ảnh base64 và lưu vào thư mục uploads
 */
const saveBase64Image = (base64String) => {
  // Kiểm tra xem có phải là base64 image không
  if (!base64String || !base64String.startsWith('data:image/')) {
    return null;
  }

  try {
    // Trả về trực tiếp chuỗi base64 để lưu vào database
    return base64String;
  } catch (error) {
    console.error('Lỗi khi xử lý ảnh base64:', error);
    return null;
  }
};

/**
 * Tạo chi tiết khóa học mới
 */
exports.createCourseDetail = catchAsync(async (req, res, next) => {
  
  
  // Xử lý ảnh base64 nếu có
  if (req.body.image && req.body.image.startsWith('data:image/')) {
    const imagePath = saveBase64Image(req.body.image);
    if (imagePath) {
      req.body.image = imagePath;
    }
  }

  const courseDetailData = {
    title: req.body.title,
    description: req.body.description,
    content: req.body.content,
    content_html: req.body.content_html,
    course_id: req.body.course_id,
    position: req.body.position,
    image: req.body.image,
    download_url: req.body.download_url,
    duration: req.body.duration,
    viewCount: req.body.viewCount,
    event_time: req.body.event_time ? new Date(req.body.event_time) : null
  };

  const courseDetail = await courseDetailModel.createCourseDetail(courseDetailData);
  
  // Ghi log tạo chi tiết khóa học mới
  if (req.user) {
    await Log.createLog({
      userId: req.user.id,
      action: 'CREATE',
      entityType: 'course-detail',
      entityId: courseDetail.id,
      description: `Người dùng đã tạo chi tiết khóa học mới: ${courseDetail.title} (ID khóa học: ${courseDetail.course_id})`,
      newData: {
        id: courseDetail.id,
        title: courseDetail.title,
        description: courseDetail.description ? courseDetail.description.substring(0, 100) + '...' : null,
        courseId: courseDetail.course_id,
        position: courseDetail.position,
      },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent']
    });
  }
  
  res.status(201).json({
    status: 'success',
    data: courseDetail
  });
});

/**
 * Cập nhật chi tiết khóa học
 */
exports.updateCourseDetail = catchAsync(async (req, res, next) => {
  
  // Lấy thông tin chi tiết khóa học hiện tại trước khi cập nhật
  const oldCourseDetail = await courseDetailModel.getCourseDetailById(req.params.id);
  if (!oldCourseDetail) {
    return next(new AppError('Course detail not found', 404));
  }

  // Xử lý ảnh base64 nếu có
  if (req.body.image && req.body.image.startsWith('data:image/')) {
    const imagePath = saveBase64Image(req.body.image);
    if (imagePath) {
      req.body.image = imagePath;
    }
  }

  const courseDetailData = {
    title: req.body.title,
    description: req.body.description,
    content: req.body.content,
    content_html: req.body.content_html,
    course_id: req.body.course_id,
    position: req.body.position,
    image: req.body.image,
    download_url: req.body.download_url,
    duration: req.body.duration,
    viewCount: req.body.viewCount,
    event_time: req.body.event_time ? new Date(req.body.event_time) : null
  };

  const courseDetail = await courseDetailModel.updateCourseDetail(req.params.id, courseDetailData);
  
  // Tạo mô tả chi tiết về những thay đổi
  let changeDescription = `Người dùng thay đổi chi tiết khóa học: ${courseDetail.title}`;
  const changes = [];
  
  if (oldCourseDetail.title !== courseDetail.title) {
    changes.push(`Tiêu đề: ${oldCourseDetail.title} → ${courseDetail.title}`);
  }
  
  if (oldCourseDetail.description !== courseDetail.description) {
    changes.push(`Đã cập nhật mô tả`);
  }
  
  if (oldCourseDetail.content !== courseDetail.content) {
    changes.push(`Đã cập nhật nội dung`);
  }
  
  if (oldCourseDetail.content_html !== courseDetail.content_html) {
    changes.push(`Đã cập nhật nội dung HTML`);
  }
  
  if (oldCourseDetail.position !== courseDetail.position) {
    changes.push(`Vị trí: ${oldCourseDetail.position} → ${courseDetail.position}`);
  }

  if (oldCourseDetail.image !== courseDetail.image) {
    changes.push(`Đã cập nhật hình ảnh`);
  }
  
  if (oldCourseDetail.download_url !== courseDetail.download_url) {
    changes.push(`Đã cập nhật link download`);
  }
  
  if (oldCourseDetail.course_id !== courseDetail.course_id) {
    changes.push(`ID khóa học: ${oldCourseDetail.course_id} → ${courseDetail.course_id}`);
  }
  
  if (oldCourseDetail.duration !== courseDetail.duration) {
    changes.push(`Thời lượng: ${oldCourseDetail.duration || 0} → ${courseDetail.duration || 0}`);
  }
  
  if (oldCourseDetail.viewCount !== courseDetail.viewCount) {
    changes.push(`Lượt xem: ${oldCourseDetail.viewCount || 0} → ${courseDetail.viewCount}`);
  }
  
  if (oldCourseDetail.event_time !== courseDetail.event_time) {
    const oldTime = oldCourseDetail.event_time ? new Date(oldCourseDetail.event_time).toLocaleString('vi-VN') : 'Chưa đặt';
    const newTime = courseDetail.event_time ? new Date(courseDetail.event_time).toLocaleString('vi-VN') : 'Chưa đặt';
    changes.push(`Thời gian: ${oldTime} → ${newTime}`);
  }
  
  // Thêm các thay đổi vào mô tả
  if (changes.length > 0) {
    changeDescription += `: ` + changes.join(', ');
  }
  
  // Ghi log cập nhật chi tiết khóa học
  if (req.user) {
    // Chỉ lưu các trường cần thiết, không lưu toàn bộ đối tượng
    const oldDataLog = {
      id: oldCourseDetail.id,
      title: oldCourseDetail.title,
      description: oldCourseDetail.description ? oldCourseDetail.description.substring(0, 100) + '...' : null,
      courseId: oldCourseDetail.course_id,
      position: oldCourseDetail.position,
      viewCount: oldCourseDetail.viewCount || 0,
      duration: oldCourseDetail.duration
    };
    
    const newDataLog = {
      id: courseDetail.id,
      title: courseDetail.title,
      description: courseDetail.description ? courseDetail.description.substring(0, 100) + '...' : null,
      courseId: courseDetail.course_id,
      position: courseDetail.position,
      viewCount: courseDetail.viewCount || 0,
      duration: courseDetail.duration
    };
    
    await Log.createLog({
      userId: req.user.id,
      action: 'UPDATE',
      entityType: 'course-detail',
      entityId: courseDetail.id,
      description: changeDescription.substring(0, 500),
      oldData: oldDataLog,
      newData: newDataLog,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent']?.substring(0, 500)
    });
  }
  // Nếu không có user nhưng có sự thay đổi về viewCount, ghi log VIEW
  else if (req.body.viewCount && oldCourseDetail.viewCount !== req.body.viewCount) {
    await Log.createLog({
      userId: null,
      action: 'VIEW',
      entityType: 'course-detail',
      entityId: courseDetail.id,
      description: `Tăng lượt xem chi tiết khóa học: ${courseDetail.title} (${oldCourseDetail.viewCount || 0} → ${courseDetail.viewCount})`.substring(0, 500),
      oldData: { viewCount: oldCourseDetail.viewCount || 0 },
      newData: { viewCount: courseDetail.viewCount },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent']?.substring(0, 500)
    });
  }
  
  res.status(200).json({
    status: 'success',
    data: courseDetail
  });
});

/**
 * Xóa chi tiết khóa học
 */
exports.deleteCourseDetail = catchAsync(async (req, res, next) => {
  // Lấy thông tin chi tiết khóa học trước khi xóa
  const courseDetail = await courseDetailModel.getCourseDetailById(req.params.id);
  if (!courseDetail) {
    return next(new AppError('Course detail not found', 404));
  }

  await courseDetailModel.deleteCourseDetail(req.params.id);
  
  // Ghi log xóa chi tiết khóa học
  if (req.user) {
    await Log.createLog({
      userId: req.user.id,
      action: 'DELETE',
      entityType: 'course-detail',
      entityId: courseDetail.id,
      description: `Người dùng đã xóa chi tiết khóa học: ${courseDetail.title} (ID: ${courseDetail.id})`,
      oldData: {
        id: courseDetail.id,
        title: courseDetail.title,
        description: courseDetail.description ? courseDetail.description.substring(0, 100) + '...' : null,
        courseId: courseDetail.course_id
      },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent']
    });
  }
  
  res.status(200).json({
    status: 'success',
    message: 'Course detail deleted successfully'
  });
});

/**
 * Xóa mềm chi tiết khóa học
 */
exports.softDeleteCourseDetail = catchAsync(async (req, res, next) => {
  // Lấy thông tin chi tiết khóa học trước khi xóa mềm
  const courseDetail = await courseDetailModel.getCourseDetailById(req.params.id);
  if (!courseDetail) {
    return next(new AppError('Course detail not found', 404));
  }
  
  await courseDetailModel.softDeleteCourseDetail(req.params.id);
  
  // Ghi log xóa mềm chi tiết khóa học
  if (req.user) {
    await Log.createLog({
      userId: req.user.id,
      action: 'DELETE',
      entityType: 'course-detail',
      entityId: courseDetail.id,
      description: `Người dùng đã ẩn chi tiết khóa học: ${courseDetail.title} (ID: ${courseDetail.id})`,
      oldData: {
        id: courseDetail.id,
        title: courseDetail.title,
        description: courseDetail.description ? courseDetail.description.substring(0, 100) + '...' : null,
        courseId: courseDetail.course_id
      },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent']
    });
  }
  
  res.status(200).json({
    status: 'success',
    message: 'Course detail hidden successfully'
  });
});

/**
 * Tăng lượt xem cho chi tiết khóa học
 */
exports.incrementViewCount = catchAsync(async (req, res, next) => {
  const id = req.params.id;
  
  // Lấy thông tin chi tiết khóa học trước khi cập nhật
  const oldCourseDetail = await courseDetailModel.getCourseDetailById(id);
  if (!oldCourseDetail) {
    return next(new AppError('Course detail not found', 404));
  }
  
  // Tăng viewCount và cập nhật
  const currentViewCount = oldCourseDetail.viewCount || 0;
  const newData = { viewCount: currentViewCount + 1 };
  const updatedCourseDetail = await courseDetailModel.updateCourseDetail(id, newData);
  
  // Ghi log cho việc xem chi tiết khóa học
  await Log.createLog({
    userId: req.user.id,
    action: 'VIEW',
    entityType: 'course-detail',
    entityId: updatedCourseDetail.id,
    description: `Người dùng đã xem chi tiết khóa học: ${updatedCourseDetail.title})`,
    oldData: { viewCount: currentViewCount },
    newData: { viewCount: updatedCourseDetail.viewCount },
    ipAddress: req.ip,
    userAgent: req.headers['user-agent']
  });
  
  res.status(200).json({
    status: 'success',
    data: updatedCourseDetail
  });
});
