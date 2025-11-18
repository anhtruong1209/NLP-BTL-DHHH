const User = require('../models/user.model');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');
const bcrypt = require('bcryptjs');

/**
 * QUẢN LÝ NGƯỜI DÙNG
 */
// Lấy danh sách người dùng
exports.getAllUsers = catchAsync(async (req, res, next) => {
  const users = await User.getAllUsers();
  
  // If user is admin (not mode), filter out admin users
  if (req.user.role === 'admin') {
    const filteredUsers = users.filter(user => {
      // Admin can see all non-admin users and themselves
      return user.role !== 'admin' || user.id === req.user.id;
    });
    
    return res.status(200).json({
      status: 'success',
      results: filteredUsers.length,
      data: {
        users: filteredUsers
      }
    });
  }
  
  res.status(200).json({
    status: 'success',
    results: users.length,
    data: {
      users
    }
  });
});

// Lấy thông tin người dùng theo ID
exports.getUserById = catchAsync(async (req, res, next) => {
  const user = await User.getUserById(req.params.id);
  
  if (!user) {
    return next(new AppError('Không tìm thấy người dùng có ID này', 404));
  }
  
  // If user is admin (not mode), prevent accessing other admin users
  if (req.user.role === 'admin' && user.role === 'admin' && user.id !== req.user.id) {
    return next(new AppError('Bạn không có quyền xem thông tin của người dùng khác có quyền admin', 403));
  }
  
  res.status(200).json({
    status: 'success',
    data: {
      user
    }
  });
});

// Tạo người dùng mới
exports.createUser = catchAsync(async (req, res, next) => {
  const { email, password, firstName, lastName, role, status } = req.body;
  
  if (!email || !password) {
    return next(new AppError('Vui lòng cung cấp email và mật khẩu', 400));
  }
  
  // Kiểm tra email đã tồn tại chưa
  const existingUser = await User.getUserByEmail(email);
  if (existingUser) {
    return next(new AppError('Email đã được sử dụng', 400));
  }
  
  // Admin can't create other admins (only Mode users can)
  if (req.user.role === 'admin' && role === 'admin') {
    return next(new AppError('Bạn không có quyền tạo người dùng có quyền admin', 403));
  }
  
  // Only mode can create mode users
  if (req.user.role !== 'mode' && role === 'mode') {
    return next(new AppError('Chỉ người dùng có quyền Mode mới có thể tạo người dùng có quyền Mode', 403));
  }
  
  // Mã hóa mật khẩu
  const hashedPassword = await bcrypt.hash(password, 10);
  
  // Tạo người dùng mới
  const newUser = await User.createUser({
    email,
    password: hashedPassword,
    firstName: firstName || null,
    lastName: lastName || null,
    role: role || 'user',
    status: status || 'active'
  });
  
  res.status(201).json({
    status: 'success',
    data: {
      user: newUser
    }
  });
});

// Cập nhật thông tin người dùng
exports.updateUser = catchAsync(async (req, res, next) => {
  const { firstName, lastName, avatar, role, status } = req.body;
  const userId = req.params.id;
  
  // Get the user being updated
  const userToUpdate = await User.getUserById(userId);
  if (!userToUpdate) {
    return next(new AppError('Không tìm thấy người dùng có ID này', 404));
  }
  
  // Admin can't update other admins
  if (req.user.role === 'admin' && userToUpdate.role === 'admin' && userToUpdate.id !== req.user.id) {
    return next(new AppError('Bạn không có quyền cập nhật người dùng có quyền admin khác', 403));
  }
  
  // Only mode can set mode role
  if (req.user.role !== 'mode' && role === 'mode') {
    return next(new AppError('Chỉ người dùng có quyền Mode mới có thể thay đổi quyền Mode', 403));
  }
  
  // Admin can't grant admin privileges
  if (req.user.role === 'admin' && role === 'admin' && userToUpdate.role !== 'admin') {
    return next(new AppError('Bạn không có quyền cấp quyền admin cho người dùng khác', 403));
  }
  
  // Lọc ra các trường được phép cập nhật
  const updateData = {};
  
  if (firstName !== undefined) updateData.firstName = firstName;
  if (lastName !== undefined) updateData.lastName = lastName;
  if (avatar !== undefined) updateData.avatar = avatar;
  if (role !== undefined) updateData.role = role;
  if (status !== undefined) updateData.status = status;
  
  // Cập nhật thông tin người dùng
  const updatedUser = await User.updateUser(userId, updateData);
  
  if (!updatedUser) {
    return next(new AppError('Không tìm thấy người dùng có ID này', 404));
  }
  
  res.status(200).json({
    status: 'success',
    data: {
      user: updatedUser
    }
  });
});

// Đặt lại mật khẩu người dùng
exports.resetUserPassword = catchAsync(async (req, res, next) => {
  const { newPassword } = req.body;
  const userId = req.params.id;
  
  // Get the user being updated
  const userToUpdate = await User.getUserById(userId);
  if (!userToUpdate) {
    return next(new AppError('Không tìm thấy người dùng có ID này', 404));
  }
  
  // Admin can't reset passwords of other admins
  if (req.user.role === 'admin' && userToUpdate.role === 'admin' && userToUpdate.id !== req.user.id) {
    return next(new AppError('Bạn không có quyền đặt lại mật khẩu của người dùng có quyền admin khác', 403));
  }
  
  if (!newPassword) {
    return next(new AppError('Vui lòng cung cấp mật khẩu mới', 400));
  }
  
  // Mã hóa mật khẩu mới
  const hashedPassword = await bcrypt.hash(newPassword, 10);
  
  // Cập nhật mật khẩu
  const updateData = { password: hashedPassword };
  const updatedUser = await User.updateUser(userId, updateData);
  
  if (!updatedUser) {
    return next(new AppError('Không tìm thấy người dùng có ID này', 404));
  }
  
  res.status(200).json({
    status: 'success',
    message: 'Mật khẩu đã được đặt lại thành công'
  });
});

// Xóa người dùng
exports.deleteUser = catchAsync(async (req, res, next) => {
  const userId = req.params.id;
  
  // Get the user being deleted
  const userToDelete = await User.getUserById(userId);
  if (!userToDelete) {
    return next(new AppError('Không tìm thấy người dùng có ID này', 404));
  }
  
  // Admin can't delete other admins
  if (req.user.role === 'admin' && userToDelete.role === 'admin' && userToDelete.id !== req.user.id) {
    return next(new AppError('Bạn không có quyền xóa người dùng có quyền admin khác', 403));
  }
  
  // Cannot delete yourself
  if (userToDelete.id === req.user.id) {
    return next(new AppError('Bạn không thể xóa tài khoản của chính mình', 403));
  }
  
  const result = await User.softDeleteUser(userId);
  
  if (!result) {
    return next(new AppError('Không tìm thấy người dùng có ID này', 404));
  }
  
  res.status(204).json({
    status: 'success',
    data: null
  });
}); 