const bcrypt = require('bcryptjs');
const User = require('../models/user.model');
const Log = require('../models/log.model');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');
const sql = require('mssql');
const pool = require('../config/db');

/**
 * Lấy tất cả người dùng
 */
exports.getAllUsers = catchAsync(async (req, res) => {
  const users = await User.getAllUsers();
  res.status(200).json(users);
});

/**
 * Lấy người dùng theo ID
 */
exports.getUserById = catchAsync(async (req, res, next) => {
  const user = await User.getUserById(req.params.id);
  if (!user) {
    return next(new AppError('User not found', 404));
  }

  // Ghi log xem người dùng nếu người gọi API có quyền admin hoặc mode
  if (req.user && (req.user.role === 'admin' || req.user.role === 'mode')) {
    await Log.createLog({
      userId: req.user.id,
      action: 'VIEW',
      entityType: 'user',
      entityId: user.id,
      description: `Admin viewed user profile: ${user.email || user.username}`,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent']
    });
  }

  res.status(200).json(user);
});

/**
 * Lấy thông tin người dùng hiện tại
 */
exports.getMe = catchAsync(async (req, res) => {
  res.status(200).json(req.user);
});

/**
 * Tạo người dùng mới (sử dụng bởi Admin)
 */
exports.createUser = catchAsync(async (req, res, next) => {
  const { email, password, firstName, lastName, role, status } = req.body;
  
  if (!email || !password) {
    return next(new AppError('Please provide email and password', 400));
  }
  
  const existingUser = await User.getUserByEmail(email);
  if (existingUser) {
    return next(new AppError('Email already in use', 400));
  }
  
  const hashedPassword = await bcrypt.hash(password, 10);
  
  const newUser = await User.createUser({
    email,
    password: hashedPassword,
    firstName: firstName || null,
    lastName: lastName || null,
    role: role || 'user',
    status: status || 'active'
  });
  
  // Ghi log tạo người dùng mới bởi admin
  if (req.user && (req.user.role === 'admin' || req.user.role === 'mode')) {
    await Log.createLog({
      userId: req.user.id,
      action: 'CREATE',
      entityType: 'user',
      entityId: newUser.id,
      description: `Admin created new user: ${newUser.email}`,
      newData: { ...newUser, password: undefined },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent']
    });
  }

  newUser.password = undefined;
  res.status(201).json(newUser);
});

/**
 * Cập nhật người dùng
 */
exports.updateUser = catchAsync(async (req, res, next) => {
  const { firstName, lastName, role, status } = req.body;
  
  if (req.body.password) {
    return next(new AppError('This route is not for password updates. Please use /update-password', 400));
  }
  
  // Lấy thông tin người dùng hiện tại trước khi cập nhật
  const currentUser = await User.getUserById(req.params.id);
  if (!currentUser) {
    return next(new AppError('User not found', 404));
  }

  const updateData = {
    firstName,
    lastName,
    role,
    status
  };
  
  const updatedUser = await User.updateUser(req.params.id, updateData);
  
  // Ghi log cập nhật người dùng
  if (req.user && (req.user.role === 'admin' || req.user.role === 'mode')) {
    await Log.createLog({
      userId: req.user.id,
      action: 'UPDATE',
      entityType: 'user',
      entityId: updatedUser.id,
      description: `Admin đã cập nhật thông tin người dùng: ${updatedUser.email}`,
      oldData: { ...currentUser, password: undefined },
      newData: { ...updatedUser, password: undefined },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent']
    });
  }
  
  res.status(200).json(updatedUser);
});

/**
 * Xóa người dùng
 */
exports.deleteUser = catchAsync(async (req, res, next) => {
  // Lấy thông tin người dùng trước khi xóa
  const userToDelete = await User.getUserById(req.params.id);
  if (!userToDelete) {
    return next(new AppError('User not found', 404));
  }
  
  const result = await User.deleteUser(req.params.id);
  
  // Ghi log xóa người dùng
  if (req.user && (req.user.role === 'admin' || req.user.role === 'mode')) {
    await Log.createLog({
      userId: req.user.id,
      action: 'DELETE',
      entityType: 'user',
      entityId: req.params.id,
      description: `Admin deleted user: ${userToDelete.email}`,
      oldData: { ...userToDelete, password: undefined },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent']
    });
  }
  
  res.status(200).json({ message: 'Người dùng đã xóa successfully' });
});

/**
 * Xóa mềm người dùng
 */
exports.softDeleteUser = catchAsync(async (req, res) => {
  const result = await User.softDeleteUser(req.params.id);
  if (!result) {
    return next(new AppError('Không tìm thấy người dùng để xóa', 404));
  }
  res.status(200).json({
    status: 'success',
    message: 'Đã xóa người dùng thành công'
  });
});

/**
 * Phục hồi người dùng đã xóa mềm
 */
exports.restoreUser = catchAsync(async (req, res) => {
  const result = await User.restoreUser(req.params.id);
  if (!result) {
    return next(new AppError('Không tìm thấy người dùng để phục hồi', 404));
  }
  res.status(200).json({
    status: 'success',
    message: 'Đã phục hồi người dùng thành công'
  });
}); 