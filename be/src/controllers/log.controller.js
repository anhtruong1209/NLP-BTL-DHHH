const Log = require('../models/log.model');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');

/**
 * Lấy tất cả log với các tùy chọn lọc
 */
const getLogs = catchAsync(async (req, res, next) => {
  const options = {
    userId: req.query.userId,
    action: req.query.action,
    entityType: req.query.entityType,
    entityId: req.query.entityId,
    startDate: req.query.startDate,
    endDate: req.query.endDate,
    offset: parseInt(req.query.offset) || 0,
    limit: parseInt(req.query.limit) || 100
  };

  // Lấy tổng số log theo điều kiện lọc
  const total = await Log.countLogs(options);
  
  // Lấy danh sách log
  const logs = await Log.getLogs(options);

  res.status(200).json({
    status: 'success',
    results: logs.length,
    total,
    data: logs
  });
});

/**
 * Lấy log theo ID
 */
const getLogById = catchAsync(async (req, res, next) => {
  const log = await Log.getLogById(req.params.id);
  
  if (!log) {
    return next(new AppError('Log not found', 404));
  }
  
  res.status(200).json({
    status: 'success',
    data: log
  });
});

/**
 * Tạo log mới
 */
const createLog = catchAsync(async (req, res, next) => {
  // Lấy thông tin từ request
  const logData = {
    userId: req.body.userId || (req.user ? req.user.id : null),
    action: req.body.action,
    entityType: req.body.entityType,
    entityId: req.body.entityId,
    description: req.body.description,
    oldData: req.body.oldData,
    newData: req.body.newData,
    ipAddress: req.ip,
    userAgent: req.headers['user-agent']
  };
  
  const log = await Log.createLog(logData);
  
  res.status(201).json({
    status: 'success',
    data: log
  });
});

/**
 * Xóa log cũ hơn một ngày cụ thể
 */
const deleteOldLogs = catchAsync(async (req, res, next) => {
  if (!req.body.date) {
    return next(new AppError('Please provide a date', 400));
  }
  
  const deletedCount = await Log.deleteOldLogs(new Date(req.body.date));
  
  res.status(200).json({
    status: 'success',
    message: `${deletedCount} logs have been deleted`
  });
});

/**
 * Log hoạt động đăng nhập
 */
const logLogin = catchAsync(async (req, res, next) => {
  // This function can be used as middleware
  if (req.user) {
    await Log.createLog({
      userId: req.user.id,
      action: 'LOGIN',
      description: `User ${req.user.email || req.user.username} logged in`,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent']
    });
  }
  
  // Continue to next middleware/controller
  next();
});

/**
 * Log hoạt động xem tài nguyên
 */
const logResourceView = catchAsync(async (req, res, next) => {
  // This function can be used as middleware
  if (req.user) {
    await Log.createLog({
      userId: req.user.id,
      action: 'VIEW',
      entityType: req.resourceType, // 'course', 'tool', etc.
      entityId: req.resourceId,
      description: `Người dùng đã xem ${req.resourceType} với id ${req.resourceId}`,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent']
    });
  }
  
  // Continue to next middleware/controller
  next();
});

/**
 * Log hoạt động thay đổi dữ liệu
 */
const logDataChange = catchAsync(async (req, res, next) => {
  // This function can be used as middleware
  if (req.user) {
    await Log.createLog({
      userId: req.user.id,
      action: req.actionType || 'UPDATE', // 'CREATE', 'UPDATE', 'DELETE'
      entityType: req.resourceType,
      entityId: req.resourceId,
      description: req.logDescription || `User ${req.user.email || req.user.username} modified ${req.resourceType} with id ${req.resourceId}`,
      oldData: req.oldData,
      newData: req.newData,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent']
    });
  }
  
  // Continue to next middleware/controller
  next();
});

module.exports = {
  getLogs,
  getLogById,
  createLog,
  deleteOldLogs,
  logLogin,
  logResourceView,
  logDataChange
}; 