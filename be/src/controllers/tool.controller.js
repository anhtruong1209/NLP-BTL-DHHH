const Tool = require('../models/tool.model');
const Log = require('../models/log.model');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');

/**
 * Lấy tất cả công cụ AI
 */
exports.getAllTools = catchAsync(async (req, res) => {
  const filters = {
    categoryId: req.query.category_id ? parseInt(req.query.category_id) : null,
    search: req.query.search || null
  };
  const tools = await Tool.getAllTools(filters);
  res.status(200).json(tools);
});

/**
 * Lấy công cụ AI theo ID
 */
exports.getToolById = catchAsync(async (req, res, next) => {
  const tool = await Tool.getToolById(req.params.id);
  if (!tool) {
    return next(new AppError('Tool not found', 404));
  }
  
  // Ghi log xem công cụ
  if (req.user) {
    await Log.createLog({
      userId: req.user.id,
      action: 'VIEW',
      entityType: 'tool',
      entityId: tool.id,
      description: `User viewed tool: ${tool.name}`,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent']
    });
  }
  
  res.status(200).json(tool);
});

/**
 * Tạo công cụ AI mới
 */
exports.createTool = catchAsync(async (req, res, next) => {
  if (!req.body.name || !req.body.category_id) {
    return next(new AppError('Tool name and category are required', 400));
  }
  const tool = await Tool.createTool(req.body);
  
  // Ghi log tạo công cụ mới
  if (req.user) {
    await Log.createLog({
      userId: req.user.id,
      action: 'CREATE',
      entityType: 'tool',
      entityId: tool.id,
      description: `Người dùng đã tạo công cụ mới: ${tool.name} (Danh mục: ${tool.categoryId})`,
      newData: tool,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent']
    });
  }
  
  res.status(201).json(tool);
});

/**
 * Cập nhật công cụ AI
 */
exports.updateTool = catchAsync(async (req, res, next) => {
  // Lấy thông tin công cụ cũ trước khi cập nhật
  const oldTool = await Tool.getToolById(req.params.id);
  if (!oldTool) {
    return next(new AppError('Tool not found', 404));
  }
  
  const tool = await Tool.updateTool(req.params.id, req.body);
  
  // Tạo mô tả chi tiết về những thay đổi
  let changeDescription = `Người dùng thay đổi công cụ: ${tool.name}`;
  const changes = [];
  
  if (oldTool.name !== tool.name) {
    changes.push(`Tên: ${oldTool.name} → ${tool.name}`);
  }
  
  if (oldTool.description !== tool.description) {
    changes.push(`Đã cập nhật mô tả`);
  }
  
  if (oldTool.api_endpoint !== tool.api_endpoint) {
    changes.push(`Đã cập nhật API endpoint`);
  }
  
  if (oldTool.icon !== tool.icon) {
    changes.push(`Đã cập nhật biểu tượng`);
  }
  
  if (oldTool.instructions !== tool.instructions) {
    changes.push(`Đã cập nhật hướng dẫn sử dụng`);
  }
  
  if (oldTool.category_id !== tool.category_id) {
    changes.push(`Danh mục: ${oldTool.category_id} → ${tool.category_id}`);
  }
  
  if (oldTool.status !== tool.status) {
    changes.push(`Trạng thái: ${oldTool.status} → ${tool.status}`);
  }
  
  // Thêm các thay đổi vào mô tả
  if (changes.length > 0) {
    changeDescription += `: ` + changes.join(', ');
  }
  
  // Ghi log cập nhật công cụ
  if (req.user) {
    // Chỉ lưu các trường cần thiết, không lưu toàn bộ đối tượng
    const oldDataLog = {
      id: oldTool.id,
      name: oldTool.name,
      description: oldTool.description ? oldTool.description.substring(0, 100) + '...' : null,
      api_endpoint: oldTool.api_endpoint,
      categoryId: oldTool.category_id,
      viewCount: oldTool.viewCount || 0,
      status: oldTool.status
    };
    
    const newDataLog = {
      id: tool.id,
      name: tool.name,
      description: tool.description ? tool.description.substring(0, 100) + '...' : null,
      api_endpoint: tool.api_endpoint,
      categoryId: tool.category_id,
      viewCount: tool.viewCount || 0,
      status: tool.status
    };
    
    await Log.createLog({
      userId: req.user.id,
      action: 'UPDATE',
      entityType: 'tool',
      entityId: tool.id,
      description: changeDescription.substring(0, 500),
      oldData: oldDataLog,
      newData: newDataLog,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent']?.substring(0, 500)
    });
  } 
  
  res.status(200).json(tool);
});

/**
 * Xóa công cụ AI
 */
exports.deleteTool = catchAsync(async (req, res, next) => {
  // Lấy thông tin công cụ trước khi xóa
  const tool = await Tool.getToolById(req.params.id);
  if (!tool) {
    return next(new AppError('Tool not found', 404));
  }
  
  const result = await Tool.deleteTool(req.params.id);
  
  // Ghi log xóa công cụ
  if (req.user) {
    await Log.createLog({
      userId: req.user.id,
      action: 'DELETE',
      entityType: 'tool',
      entityId: tool.id,
      description: `Người dùng đã xóa công cụ: ${tool.name} (ID: ${tool.id})`,
      oldData: tool,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent']
    });
  }
  
  res.status(200).json({ message: 'Tool deleted successfully' });
});

/**
 * Tìm kiếm công cụ AI
 */
exports.searchTools = catchAsync(async (req, res, next) => {
  const searchTerm = req.query.q || '';
  const limit = req.query.limit ? parseInt(req.query.limit) : 10;
  
  if (searchTerm.length < 2) {
    return next(new AppError('Search term must be at least 2 characters', 400));
  }
  
  const tools = await Tool.searchTools(searchTerm, limit);
  res.status(200).json(tools);
});

/**
 * Lấy công cụ AI theo danh mục
 */
exports.getToolsByCategory = catchAsync(async (req, res) => {
  const toolsByCategory = await Tool.getToolsByCategory();
  res.status(200).json(toolsByCategory);
});

exports.softDeleteTool = catchAsync(async (req, res) => {
  await Tool.softDeleteTool(req.params.id);
  res.status(200).json({ message: 'Tool hidden successfully' });
}); 

/**
 * Tăng lượt xem cho công cụ AI
 */
exports.incrementViewCount = catchAsync(async (req, res, next) => {
  const id = req.params.id;
  
  // Lấy thông tin công cụ trước khi cập nhật
  const oldTool = await Tool.getToolById(id);
  if (!oldTool) {
    return next(new AppError('Tool not found', 404));
  }
  
  // Tăng viewCount và cập nhật
  const currentViewCount = oldTool.viewCount || 0;
  const newData = { viewCount: currentViewCount + 1 };
  const updatedTool = await Tool.updateTool(id, newData);
  
  // Ghi log cho việc xem công cụ
  await Log.createLog({
    userId: req.user.id,
    action: 'VIEW',
    entityType: 'tool',
    entityId: updatedTool.id,
    description: `Người dùng đã xem công cụ: ${updatedTool.name}`,
    oldData: { viewCount: currentViewCount },
    newData: { viewCount: updatedTool.viewCount },
    ipAddress: req.ip,
    userAgent: req.headers['user-agent']
  });
  
  res.status(200).json({
    status: 'success',
    data: updatedTool
  });
}); 