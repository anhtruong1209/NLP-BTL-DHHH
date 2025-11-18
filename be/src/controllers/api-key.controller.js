const ApiKey = require('../models/api-key.model');
const Log = require('../models/log.model');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');

/**
 * Lấy tất cả API Keys
 */
exports.getAllApiKeys = catchAsync(async (req, res, next) => {
  const apiKeys = await ApiKey.getAllApiKeys();
  
  res.status(200).json({
    status: 'success',
    results: apiKeys.length,
    data: {
      apiKeys
    }
  });
});

/**
 * Lấy API Key theo ID
 */
exports.getApiKeyById = catchAsync(async (req, res, next) => {
  const apiKey = await ApiKey.getApiKeyById(req.params.id);
  
  if (!apiKey) {
    return next(new AppError('Không tìm thấy API Key với ID này', 404));
  }
  
  // Ghi log xem API key nếu người dùng đăng nhập và có quyền admin hoặc mode
  if (req.user && (req.user.role === 'admin' || req.user.role === 'mode')) {
    await Log.createLog({
      userId: req.user.id,
      action: 'VIEW',
      entityType: 'api-key',
      entityId: apiKey.id,
      description: `Admin viewed API key: ${apiKey.name}`,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent']
    });
  }
  
  res.status(200).json({
    status: 'success',
    data: {
      apiKey
    }
  });
});

/**
 * Tạo API Key mới
 */
exports.createApiKey = catchAsync(async (req, res, next) => {
  if (!req.body.name) {
    return next(new AppError('Tên API Key là bắt buộc', 400));
  }
  
  if (!req.body.key) {
    return next(new AppError('Giá trị API Key là bắt buộc', 400));
  }
  
  // Tạo API key mới
  const apiKeyData = {
    name: req.body.name,
    description: req.body.description || req.body.service_name,
    model: req.body.model || 'gemini-2.0-flash',
    key: req.body.key,
    status: req.body.status || req.body.is_active || 'active'
  };
  
  const newApiKey = await ApiKey.createApiKey(apiKeyData);
  
  // Ghi log tạo API key mới
  if (req.user) {
    await Log.createLog({
      userId: req.user.id,
      action: 'CREATE',
      entityType: 'api-key',
      entityId: newApiKey.id,
      description: `Người dùng đã tạo new API key: ${newApiKey.name}`,
      newData: { ...newApiKey, key: '[REDACTED]' }, // Không ghi key vào log vì lý do bảo mật
      ipAddress: req.ip,
      userAgent: req.headers['user-agent']
    });
  }
  
  res.status(201).json({
    status: 'success',
    data: {
      apiKey: newApiKey
    }
  });
});

/**
 * Cập nhật API Key
 */
exports.updateApiKey = catchAsync(async (req, res, next) => {
  // Lấy thông tin API key hiện tại trước khi cập nhật
  const oldApiKey = await ApiKey.getApiKeyById(req.params.id);
  if (!oldApiKey) {
    return next(new AppError('Không tìm thấy API Key với ID này', 404));
  }
  
  const updatedApiKey = await ApiKey.updateApiKey(req.params.id, req.body);
  
  // Ghi log cập nhật API key
  if (req.user) {
    await Log.createLog({
      userId: req.user.id,
      action: 'UPDATE',
      entityType: 'api-key',
      entityId: updatedApiKey.id,
      description: `Người dùng thay đổi API key: ${updatedApiKey.name}`,
      oldData: { ...oldApiKey, key: '[REDACTED]' },
      newData: { ...updatedApiKey, key: '[REDACTED]' },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent']
    });
  }
  
  res.status(200).json({
    status: 'success',
    data: {
      apiKey: updatedApiKey
    }
  });
});

/**
 * Xóa API Key
 */
exports.deleteApiKey = catchAsync(async (req, res, next) => {
  // Lấy thông tin API key trước khi xóa
  const apiKey = await ApiKey.getApiKeyById(req.params.id);
  if (!apiKey) {
    return next(new AppError('Không tìm thấy API Key với ID này', 404));
  }
  
  const deleted = await ApiKey.deleteApiKey(req.params.id);
  
  // Ghi log xóa API key
  if (req.user) {
    await Log.createLog({
      userId: req.user.id,
      action: 'DELETE',
      entityType: 'api-key',
      entityId: apiKey.id,
      description: `Người dùng đã xóa API key: ${apiKey.name}`,
      oldData: { ...apiKey, key: '[REDACTED]' },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent']
    });
  }
  
  res.status(204).json({
    status: 'success',
    data: null
  });
});

/**
 * Tạo lại API Key mới
 */
exports.regenerateApiKey = catchAsync(async (req, res, next) => {
  // Lấy thông tin API key hiện tại trước khi tạo lại
  const oldApiKey = await ApiKey.getApiKeyById(req.params.id);
  if (!oldApiKey) {
    return next(new AppError('Không tìm thấy API Key với ID này', 404));
  }
  
  const regeneratedApiKey = await ApiKey.regenerateApiKey(req.params.id);
  
  // Ghi log tạo lại API key
  if (req.user) {
    await Log.createLog({
      userId: req.user.id,
      action: 'UPDATE',
      entityType: 'api-key',
      entityId: regeneratedApiKey.id,
      description: `User regenerated API key: ${regeneratedApiKey.name}`,
      oldData: { ...oldApiKey, key: '[REDACTED]' },
      newData: { ...regeneratedApiKey, key: '[REDACTED]' },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent']
    });
  }
  
  res.status(200).json({
    status: 'success',
    data: {
      apiKey: regeneratedApiKey
    }
  });
});

/**
 * Xóa mềm API Key
 */
exports.softDeleteApiKey = catchAsync(async (req, res, next) => {
  // Lấy thông tin API key trước khi xóa mềm
  const apiKey = await ApiKey.getApiKeyById(req.params.id);
  if (!apiKey) {
    return next(new AppError('Không tìm thấy API Key với ID này', 404));
  }
  
  await ApiKey.softDeleteApiKey(req.params.id);
  
  // Ghi log xóa mềm API key
  if (req.user) {
    await Log.createLog({
      userId: req.user.id,
      action: 'DELETE',
      entityType: 'api-key',
      entityId: apiKey.id,
      description: `User soft deleted API key: ${apiKey.name}`,
      oldData: { ...apiKey, key: '[REDACTED]' },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent']
    });
  }
  
  res.status(200).json({
    status: 'success',
    message: 'API Key đã được ẩn thành công'
  });
});

/**
 * Cập nhật usage_count và last_used của API Key
 */
exports.updateApiKeyUsage = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  
  // Thực hiện cập nhật thông tin sử dụng
  const updated = await ApiKey.updateApiKeyUsage(id);
  
  if (!updated) {
    return next(new AppError('Không tìm thấy API Key với ID này', 404));
  }
  
  res.status(200).json({
    status: 'success',
    data: {
      apiKey: updated
    }
  });
});

/**
 * Lấy API Key theo tên model (cho frontend)
 */
exports.getApiKeyByModel = catchAsync(async (req, res, next) => {
  try {
    const { model } = req.params;
    
    
    // Sử dụng hàm mới để lấy API key theo model
    const apiKey = await ApiKey.getApiKeyByModel(model);
    
    if (!apiKey) {
      
      // Trường hợp không có key, tạo một key mặc định từ biến môi trường
      if (process.env.GEMINI_API_KEY) {
        return res.status(200).json({
          status: 'success',
          data: {
            key: process.env.GEMINI_API_KEY,
            model: model,
            source: 'environment'
          }
        });
      }
      
      return next(new AppError(`Không tìm thấy API Key cho model ${model}`, 404));
    }
    
    res.status(200).json({
      status: 'success',
      data: {
        key: apiKey.api_key,
        model: apiKey.model,
        source: 'database'
      }
    });
  } catch (error) {
    return next(new AppError(`Lỗi khi lấy API key: ${error.message}`, 500));
  }
}); 