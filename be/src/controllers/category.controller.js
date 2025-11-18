const Category = require('../models/category.model');
const Log = require('../models/log.model');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');
const Approval = require('../models/approval.model');

/**
 * Lấy tất cả danh mục
 */
exports.getAllCategories = catchAsync(async (req, res) => {
  const categories = await Category.getAllCategories();
  res.status(200).json(categories);
});

/**
 * Lấy danh mục theo ID
 */
exports.getCategoryById = catchAsync(async (req, res, next) => {
  const category = await Category.getCategoryById(req.params.id);
  if (!category) {
    return next(new AppError('Category not found', 404));
  }
  
  // Ghi log xem danh mục nếu người dùng đã đăng nhập và có quyền admin hoặc mode
  if (req.user && (req.user.role === 'admin' || req.user.role === 'mode')) {
    await Log.createLog({
      userId: req.user.id,
      action: 'VIEW',
      entityType: 'category',
      entityId: category.id,
      description: `Admin đã xem danh mục: ${category.name}`,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent']
    });
  }
  
  res.status(200).json(category);
});

/**
 * Tạo danh mục mới (với workflow phê duyệt nếu người dùng là Mode)
 */
exports.createCategory = catchAsync(async (req, res, next) => {
  if (!req.body.name) {
    return next(new AppError('Category name is required', 400));
  }
  
  // Check if user is Mode (needs approval) or Admin (direct create)
  if (req.user.role === 'mode') {
    // Create approval request instead of direct create
    const approvalData = {
      operationType: 'create',
      entityType: 'category',
      entityId: null, // Will be assigned after approval
      originalData: null, // No original data for creation
      modifiedData: req.body,
      createdBy: req.user.id
    };
    
    const newApproval = await Approval.createApproval(approvalData);
    
    // Log the approval request
    await Log.createLog({
      userId: req.user.id,
      action: 'REQUEST_APPROVAL',
      entityType: 'category',
      entityId: null,
      description: `Mode đã yêu cầu phê duyệt tạo mới danh mục: ${req.body.name}`,
      newData: req.body,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent']
    });
    
    return res.status(202).json({
      status: 'pending_approval',
      message: 'Yêu cầu tạo mới đã được gửi và đang chờ phê duyệt từ Admin',
      data: {
        approval: newApproval
      }
    });
  }
  
  // Direct creation for Admin users
  const category = await Category.createCategory(req.body);
  
  // Ghi log tạo danh mục mới
  if (req.user) {
    await Log.createLog({
      userId: req.user.id,
      action: 'CREATE',
      entityType: 'category',
      entityId: category.id,
      description: `Người dùng đã tạo danh mục mới: ${category.name} (Loại: ${category.type || 'Không xác định'})`,
      newData: {
        id: category.id,
        name: category.name,
        description: category.description ? category.description.substring(0, 100) + '...' : null,
        type: category.type,
        icon: category.icon
      },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent']
    });
  }
  
  res.status(201).json(category);
});

/**
 * Cập nhật danh mục (với workflow phê duyệt nếu người dùng là Mode)
 */
exports.updateCategory = catchAsync(async (req, res, next) => {
  // Lấy thông tin danh mục cũ trước khi cập nhật
  const oldCategory = await Category.getCategoryById(req.params.id);
  if (!oldCategory) {
    return next(new AppError('Category not found', 404));
  }
  
  // Check if user is Mode (needs approval) or Admin (direct update)
  if (req.user.role === 'mode') {
    // Create approval request instead of direct update
    const approvalData = {
      operationType: 'update',
      entityType: 'category',
      entityId: parseInt(req.params.id),
      originalData: oldCategory,
      modifiedData: { 
        ...oldCategory,  // Include all original data
        ...req.body      // Overwrite with changes
      },
      createdBy: req.user.id
    };
    
    const newApproval = await Approval.createApproval(approvalData);
    
    // Log the approval request
    await Log.createLog({
      userId: req.user.id,
      action: 'REQUEST_APPROVAL',
      entityType: 'category',
      entityId: oldCategory.id,
      description: `Mode đã yêu cầu phê duyệt thay đổi danh mục: ${oldCategory.name}`,
      oldData: oldCategory,
      newData: approvalData.modifiedData,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent']
    });
    
    return res.status(202).json({
      status: 'pending_approval',
      message: 'Yêu cầu thay đổi đã được gửi và đang chờ phê duyệt từ Admin',
      data: {
        approval: newApproval,
        category: oldCategory
      }
    });
  } 
  
  // Direct update for Admin users
  const category = await Category.updateCategory(req.params.id, req.body);
  
  // Tạo mô tả chi tiết về những thay đổi
  let changeDescription = `Người dùng đã thay đổi danh mục: ${category.name}`;
  const changes = [];
  
  if (oldCategory.name !== category.name) {
    changes.push(`Tên: ${oldCategory.name} → ${category.name}`);
  }
  
  if (oldCategory.description !== category.description) {
    changes.push(`Đã cập nhật mô tả`);
  }
  
  if (oldCategory.type !== category.type) {
    changes.push(`Loại: ${oldCategory.type || 'Không xác định'} → ${category.type || 'Không xác định'}`);
  }
  
  if (oldCategory.icon !== category.icon) {
    changes.push(`Đã cập nhật biểu tượng`);
  }
  
  if (oldCategory.order !== category.order) {
    changes.push(`Thứ tự: ${oldCategory.order || 0} → ${category.order || 0}`);
  }
  
  if (oldCategory.status !== category.status) {
    changes.push(`Trạng thái: ${oldCategory.status || 'active'} → ${category.status || 'active'}`);
  }
  
  // Thêm các thay đổi vào mô tả
  if (changes.length > 0) {
    changeDescription += `: ` + changes.join(', ');
  }
  
  // Ghi log cập nhật danh mục
  if (req.user) {
    await Log.createLog({
      userId: req.user.id,
      action: 'UPDATE',
      entityType: 'category',
      entityId: category.id,
      description: changeDescription.substring(0, 500),
      oldData: {
        id: oldCategory.id,
        name: oldCategory.name,
        description: oldCategory.description ? oldCategory.description.substring(0, 100) + '...' : null,
        type: oldCategory.type,
        icon: oldCategory.icon,
        order: oldCategory.order,
        status: oldCategory.status
      },
      newData: {
        id: category.id,
        name: category.name,
        description: category.description ? category.description.substring(0, 100) + '...' : null,
        type: category.type,
        icon: category.icon,
        order: category.order,
        status: category.status
      },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent']
    });
  }
  
  res.status(200).json(category);
});

/**
 * Xóa danh mục (với workflow phê duyệt nếu người dùng là Mode)
 */
exports.deleteCategory = catchAsync(async (req, res, next) => {
  // Lấy thông tin danh mục trước khi xóa
  const category = await Category.getCategoryById(req.params.id);
  if (!category) {
    return next(new AppError('Category not found', 404));
  }
  
  // Check if user is Mode (needs approval) or Admin (direct delete)
  if (req.user.role === 'mode') {
    // Create approval request instead of direct delete
    const approvalData = {
      operationType: 'delete',
      entityType: 'category',
      entityId: parseInt(req.params.id),
      originalData: category,
      modifiedData: { id: parseInt(req.params.id) }, // Just need ID for deletion
      createdBy: req.user.id
    };
    
    const newApproval = await Approval.createApproval(approvalData);
    
    // Log the approval request
    await Log.createLog({
      userId: req.user.id,
      action: 'REQUEST_APPROVAL',
      entityType: 'category',
      entityId: category.id,
      description: `Mode đã yêu cầu phê duyệt xóa danh mục: ${category.name}`,
      oldData: {
        id: category.id,
        name: category.name,
        description: category.description ? category.description.substring(0, 100) + '...' : null,
        type: category.type
      },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent']
    });
    
    return res.status(202).json({
      status: 'pending_approval',
      message: 'Yêu cầu xóa đã được gửi và đang chờ phê duyệt từ Admin',
      data: {
        approval: newApproval,
        category: category
      }
    });
  }
  
  // Direct delete for Admin users
  const result = await Category.deleteCategory(req.params.id);
  
  // Ghi log xóa danh mục
  if (req.user) {
    await Log.createLog({
      userId: req.user.id,
      action: 'DELETE',
      entityType: 'category',
      entityId: category.id,
      description: `Người dùng đã xóa danh mục: ${category.name} (ID: ${category.id})`,
      oldData: {
        id: category.id,
        name: category.name,
        description: category.description ? category.description.substring(0, 100) + '...' : null,
        type: category.type
      },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent']
    });
  }
  
  res.status(200).json({ message: 'Category deleted successfully' });
});

/**
 * Lấy danh mục với tất cả công cụ AI
 */
exports.getCategoryWithTools = catchAsync(async (req, res, next) => {
  const categoryId = parseInt(req.params.id);
  if (isNaN(categoryId)) {
    return next(new AppError('Invalid category ID', 400));
  }
  
  const category = await Category.getCategoryWithTools(categoryId);
  if (!category) {
    return next(new AppError('Category not found', 404));
  }
  
  res.status(200).json(category);
});

exports.softDeleteCategory = catchAsync(async (req, res, next) => {
  // Lấy thông tin danh mục trước khi xóa mềm
  const category = await Category.getCategoryById(req.params.id);
  if (!category) {
    return next(new AppError('Category not found', 404));
  }
  
  await Category.softDeleteCategory(req.params.id);
  
  // Ghi log xóa mềm danh mục
  if (req.user) {
    await Log.createLog({
      userId: req.user.id,
      action: 'DELETE',
      entityType: 'category',
      entityId: category.id,
      description: `Người dùng đã ẩn danh mục: ${category.name} (ID: ${category.id})`,
      oldData: {
        id: category.id,
        name: category.name,
        description: category.description ? category.description.substring(0, 100) + '...' : null,
        type: category.type,
        status: 'active'
      },
      newData: {
        status: 'inactive'
      },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent']
    });
  }
  
  res.status(200).json({ message: 'Category hidden successfully' });
}); 