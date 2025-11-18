const Approval = require('../models/approval.model');
const Log = require('../models/log.model');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');

// Import necessary models for implementing approved changes
const Tool = require('../models/tool.model');
const Category = require('../models/category.model');
const Course = require('../models/course.model');
const CourseDetail = require('../models/course-detail.model');
const User = require('../models/user.model');

/**
 * Lấy danh sách tất cả yêu cầu phê duyệt
 */
exports.getAllApprovals = catchAsync(async (req, res) => {
  // Extract filter parameters from query
  const filters = {
    status: req.query.status,
    entityType: req.query.entity_type
  };
  
  const approvals = await Approval.getAllApprovals(filters);
  
  // Process data to parse JSON strings
  const processedApprovals = approvals.map(approval => {
    try {
      if (approval.original_data) {
        approval.original_data = JSON.parse(approval.original_data);
      }
      if (approval.modified_data) {
        approval.modified_data = JSON.parse(approval.modified_data);
      }
    } catch (err) {
      console.error('Error parsing JSON data for approval:', err);
    }
    return approval;
  });
  
  res.status(200).json({
    status: 'success',
    results: processedApprovals.length,
    data: {
      approvals: processedApprovals
    }
  });
});

/**
 * Lấy thông tin chi tiết của một yêu cầu phê duyệt
 */
exports.getApprovalById = catchAsync(async (req, res, next) => {
  const approval = await Approval.getApprovalById(req.params.id);
  
  if (!approval) {
    return next(new AppError('Không tìm thấy yêu cầu phê duyệt với ID này', 404));
  }
  
  // Parse JSON strings
  try {
    if (approval.original_data) {
      approval.original_data = JSON.parse(approval.original_data);
    }
    if (approval.modified_data) {
      approval.modified_data = JSON.parse(approval.modified_data);
    }
  } catch (err) {
    console.error('Error parsing JSON data for approval:', err);
  }
  
  res.status(200).json({
    status: 'success',
    data: {
      approval
    }
  });
});

/**
 * Tạo yêu cầu phê duyệt mới
 */
exports.createApproval = catchAsync(async (req, res, next) => {
  // Verify required fields
  if (!req.body.operationType || !req.body.entityType || !req.body.modifiedData) {
    return next(new AppError('Thiếu thông tin bắt buộc: loại thao tác, loại đối tượng và dữ liệu thay đổi', 400));
  }
  
  // Only Mode users can create approval requests
  if (req.user.role !== 'mode') {
    return next(new AppError('Chỉ người dùng có quyền Mode mới có thể tạo yêu cầu phê duyệt', 403));
  }
  
  // Create approval request
  const approvalData = {
    operationType: req.body.operationType,
    entityType: req.body.entityType,
    entityId: req.body.entityId,
    originalData: req.body.originalData,
    modifiedData: req.body.modifiedData,
    createdBy: req.user.id
  };
  
  const newApproval = await Approval.createApproval(approvalData);
  
  // Log the approval request creation
  await Log.createLog({
    userId: req.user.id,
    action: 'CREATE',
    entityType: 'approval',
    entityId: newApproval.id,
    description: `Người dùng đã tạo yêu cầu phê duyệt mới cho ${approvalData.entityType}`,
    ipAddress: req.ip,
    userAgent: req.headers['user-agent']
  });
  
  res.status(201).json({
    status: 'success',
    data: {
      approval: newApproval
    }
  });
});

/**
 * Phê duyệt hoặc từ chối yêu cầu
 */
exports.reviewApproval = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const { status, comments } = req.body;
  
  if (!status || !['approved', 'rejected'].includes(status)) {
    return next(new AppError('Trạng thái không hợp lệ. Chỉ chấp nhận "approved" hoặc "rejected"', 400));
  }
  
  // Only Admin users can approve/reject requests
  if (req.user.role !== 'admin') {
    return next(new AppError('Chỉ người dùng có quyền Admin mới có thể phê duyệt yêu cầu', 403));
  }
  
  // Get the approval request
  const approval = await Approval.getApprovalById(id);
  if (!approval) {
    return next(new AppError('Không tìm thấy yêu cầu phê duyệt với ID này', 404));
  }
  
  // Check if the approval is already processed
  if (approval.status !== 'pending') {
    return next(new AppError(`Yêu cầu phê duyệt này đã được ${approval.status === 'approved' ? 'phê duyệt' : 'từ chối'}`, 400));
  }
  
  // Update approval status
  const updatedApproval = await Approval.updateApprovalStatus(id, status, req.user.id, comments);
  
  // Handle actual implementation of approved changes
  if (status === 'approved') {
    try {
      // Parse the original and modified data
      let originalData = null;
      let modifiedData = null;
      
      try {
        if (approval.original_data) {
          originalData = JSON.parse(approval.original_data);
        }
        if (approval.modified_data) {
          modifiedData = JSON.parse(approval.modified_data);
        }
      } catch (err) {
        console.error('Error parsing JSON data for approval:', err);
        return next(new AppError('Lỗi khi xử lý dữ liệu JSON của yêu cầu phê duyệt', 500));
      }
      
      if (!modifiedData) {
        return next(new AppError('Không có dữ liệu để thực hiện thay đổi', 400));
      }
      
      // Implement the changes based on operation type and entity type
      let implementationResult = null;
      let entityId = null;
      
      // Implement based on entity type and operation type
      switch (approval.entity_type) {
        case 'tool':
          implementationResult = await implementToolChanges(
            approval.operation_type, 
            approval.entity_id, 
            originalData, 
            modifiedData
          );
          entityId = implementationResult.id;
          break;
          
        case 'category':
          implementationResult = await implementCategoryChanges(
            approval.operation_type, 
            approval.entity_id, 
            originalData, 
            modifiedData
          );
          entityId = implementationResult.id;
          break;
          
        case 'course':
          implementationResult = await implementCourseChanges(
            approval.operation_type, 
            approval.entity_id, 
            originalData, 
            modifiedData
          );
          entityId = implementationResult.id;
          break;
          
        case 'course_detail':
          implementationResult = await implementCourseDetailChanges(
            approval.operation_type, 
            approval.entity_id, 
            originalData, 
            modifiedData
          );
          entityId = implementationResult.id;
          break;
          
        default:
          console.warn(`Unsupported entity type: ${approval.entity_type}`);
          implementationResult = { status: 'error', message: 'Loại đối tượng không được hỗ trợ' };
      }
      
      // If we have a new entity ID (for create operations), update the approval record
      if (approval.operation_type === 'create' && entityId && !approval.entity_id) {
        await Approval.updateEntityId(approval.id, entityId);
      }
      
      // Log the successful implementation
      await Log.createLog({
        userId: req.user.id,
        action: 'IMPLEMENT',
        entityType: approval.entity_type,
        entityId: entityId,
        description: `Admin đã thực hiện ${approval.operation_type} cho ${approval.entity_type} sau khi phê duyệt`,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent']
      });
    } catch (error) {
      console.error('Error implementing approved changes:', error);
      
      // Log the failed implementation but don't fail the response
      await Log.createLog({
        userId: req.user.id,
        action: 'IMPLEMENT_ERROR',
        entityType: approval.entity_type,
        entityId: approval.entity_id,
        description: `Lỗi khi thực hiện thay đổi đã phê duyệt: ${error.message}`,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent']
      });
    }
    
    // Log the approval action
    await Log.createLog({
      userId: req.user.id,
      action: 'APPROVE',
      entityType: 'approval',
      entityId: updatedApproval.id,
      description: `Admin đã phê duyệt yêu cầu cho ${updatedApproval.entity_type} ${updatedApproval.operation_type}`,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent']
    });
  } else {
    // Log rejection
    await Log.createLog({
      userId: req.user.id,
      action: 'REJECT',
      entityType: 'approval',
      entityId: updatedApproval.id,
      description: `Admin đã từ chối yêu cầu cho ${updatedApproval.entity_type} ${updatedApproval.operation_type}`,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent']
    });
  }
  
  res.status(200).json({
    status: 'success',
    data: {
      approval: updatedApproval,
      message: status === 'approved' ? 'Yêu cầu đã được phê duyệt và thay đổi đã được áp dụng' : 'Yêu cầu đã bị từ chối'
    }
  });
});

/**
 * Xóa yêu cầu phê duyệt
 */
exports.deleteApproval = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  
  // Verify the approval exists
  const approval = await Approval.getApprovalById(id);
  if (!approval) {
    return next(new AppError('Không tìm thấy yêu cầu phê duyệt với ID này', 404));
  }
  
  // Only Admin users can delete any approval, Mode users can only delete their own pending approvals
  if (req.user.role !== 'admin' && 
      (approval.created_by !== req.user.id || approval.status !== 'pending')) {
    return next(new AppError('Bạn không có quyền xóa yêu cầu phê duyệt này', 403));
  }
  
  await Approval.deleteApproval(id);
  
  // Log the deletion
  await Log.createLog({
    userId: req.user.id,
    action: 'DELETE',
    entityType: 'approval',
    entityId: id,
    description: `User đã xóa yêu cầu phê duyệt ID: ${id}`,
    ipAddress: req.ip,
    userAgent: req.headers['user-agent']
  });
  
  res.status(204).json({
    status: 'success',
    data: null
  });
});

/**
 * Lấy số lượng yêu cầu đang chờ phê duyệt
 */
exports.getPendingCount = catchAsync(async (req, res) => {
  const count = await Approval.getPendingApprovalsCount();
  
  res.status(200).json({
    status: 'success',
    data: {
      pendingCount: count
    }
  });
}); 

/**
 * Implement changes for Tool entity
 */
async function implementToolChanges(operationType, entityId, originalData, modifiedData) {
  switch (operationType) {
    case 'create':
      return await Tool.createTool(modifiedData);
      
    case 'update':
      return await Tool.updateTool(entityId, modifiedData);
      
    case 'delete':
      return await Tool.softDeleteTool(entityId);
      
    default:
      throw new Error(`Unsupported operation type: ${operationType}`);
  }
}

/**
 * Implement changes for Category entity
 */
async function implementCategoryChanges(operationType, entityId, originalData, modifiedData) {
  switch (operationType) {
    case 'create':
      return await Category.createCategory(modifiedData);
      
    case 'update':
      return await Category.updateCategory(entityId, modifiedData);
      
    case 'delete':
      return await Category.deleteCategory(entityId);
      
    default:
      throw new Error(`Unsupported operation type: ${operationType}`);
  }
}

/**
 * Implement changes for Course entity
 */
async function implementCourseChanges(operationType, entityId, originalData, modifiedData) {
  switch (operationType) {
    case 'create':
      return await Course.createCourse(modifiedData);
      
    case 'update':
      return await Course.updateCourse(entityId, modifiedData);
      
    case 'delete':
      return await Course.deleteCourse(entityId);
      
    default:
      throw new Error(`Unsupported operation type: ${operationType}`);
  }
}

/**
 * Implement changes for CourseDetail entity
 */
async function implementCourseDetailChanges(operationType, entityId, originalData, modifiedData) {
  switch (operationType) {
    case 'create':
      return await CourseDetail.createCourseDetail(modifiedData);
      
    case 'update':
      return await CourseDetail.updateCourseDetail(entityId, modifiedData);
      
    case 'delete':
      return await CourseDetail.deleteCourseDetail(entityId);
      
    default:
      throw new Error(`Unsupported operation type: ${operationType}`);
  }
} 