const { pool, sql, connectToDatabase } = require('../config/db');

/**
 * Lấy tất cả yêu cầu phê duyệt
 * @param {Object} filters - Các bộ lọc (status, entity_type)
 * @returns {Promise<Array>} Danh sách yêu cầu phê duyệt
 */
async function getAllApprovals(filters = {}) {
  try {
    await connectToDatabase();
    let query = `
      SELECT a.*, 
        c.username as created_by_username,
        r.username as reviewed_by_username
      FROM approvals a
      LEFT JOIN users c ON a.created_by = c.id
      LEFT JOIN users r ON a.reviewed_by = r.id
      WHERE 1=1
    `;
    
    const request = pool.request();
    
    // Apply filters if provided
    if (filters.status) {
      query += ' AND a.status = @status';
      request.input('status', sql.VarChar, filters.status);
    }
    
    if (filters.entityType) {
      query += ' AND a.entity_type = @entityType';
      request.input('entityType', sql.VarChar, filters.entityType);
    }
    
    // Order by created_at (newest first)
    query += ' ORDER BY a.created_at DESC';
    
    const result = await request.query(query);
    return result.recordset;
  } catch (error) {
    console.error('Error getting approvals:', error);
    throw new Error('Could not fetch approvals: ' + error.message);
  }
}

/**
 * Lấy yêu cầu phê duyệt theo ID
 * @param {number} id - ID của yêu cầu
 * @returns {Promise<Object>} Thông tin yêu cầu phê duyệt
 */
async function getApprovalById(id) {
  try {
    await connectToDatabase();
    const result = await pool.request()
      .input('id', sql.Int, id)
      .query(`
        SELECT a.*, 
          c.username as created_by_username,
          r.username as reviewed_by_username
        FROM approvals a
        LEFT JOIN users c ON a.created_by = c.id
        LEFT JOIN users r ON a.reviewed_by = r.id
        WHERE a.id = @id
      `);
    return result.recordset[0];
  } catch (error) {
    console.error('Error getting approval by ID:', error);
    throw new Error('Could not fetch approval: ' + error.message);
  }
}

/**
 * Tạo yêu cầu phê duyệt mới
 * @param {Object} data - Thông tin yêu cầu phê duyệt
 * @returns {Promise<Object>} Thông tin yêu cầu phê duyệt đã tạo
 */
async function createApproval(data) {
  try {
    await connectToDatabase();
    
    // Đảm bảo dữ liệu JSON được chuyển đổi đúng cách
    let originalData = null;
    let modifiedData = null;
    
    if (data.originalData) {
      originalData = typeof data.originalData === 'string' 
        ? data.originalData 
        : JSON.stringify(data.originalData);
    }
    
    if (data.modifiedData) {
      modifiedData = typeof data.modifiedData === 'string'
        ? data.modifiedData
        : JSON.stringify(data.modifiedData);
    }
    
    const result = await pool.request()
      .input('operationType', sql.VarChar, data.operationType)
      .input('entityType', sql.VarChar, data.entityType)
      .input('entityId', sql.Int, data.entityId)
      .input('originalData', sql.NVarChar, originalData)
      .input('modifiedData', sql.NVarChar, modifiedData)
      .input('status', sql.VarChar, 'pending')
      .input('createdBy', sql.Int, data.createdBy)
      .input('createdAt', sql.DateTime, new Date())
      .query(`
        INSERT INTO approvals (
          operation_type, entity_type, entity_id,
          original_data, modified_data, status,
          created_by, created_at
        )
        OUTPUT INSERTED.*
        VALUES (
          @operationType, @entityType, @entityId,
          @originalData, @modifiedData, @status,
          @createdBy, @createdAt
        )
      `);
    return result.recordset[0];
  } catch (error) {
    console.error('Error creating approval:', error);
    throw new Error('Could not create approval request: ' + error.message);
  }
}

/**
 * Cập nhật trạng thái phê duyệt
 * @param {number} id - ID của yêu cầu phê duyệt
 * @param {string} status - Trạng thái mới ('approved', 'rejected')
 * @param {number} reviewedBy - ID người dùng xem xét
 * @param {string} comments - Nhận xét của người duyệt
 * @returns {Promise<Object>} Thông tin yêu cầu phê duyệt đã cập nhật
 */
async function updateApprovalStatus(id, status, reviewedBy, comments = null) {
  try {
    await connectToDatabase();
    const result = await pool.request()
      .input('id', sql.Int, id)
      .input('status', sql.VarChar, status)
      .input('reviewedBy', sql.Int, reviewedBy)
      .input('reviewedAt', sql.DateTime, new Date())
      .input('comments', sql.NVarChar, comments)
      .query(`
        UPDATE approvals
        SET status = @status,
            reviewed_by = @reviewedBy,
            reviewed_at = @reviewedAt,
            comments = @comments
        OUTPUT INSERTED.*
        WHERE id = @id
      `);
    return result.recordset[0];
  } catch (error) {
    console.error('Error updating approval status:', error);
    throw new Error('Could not update approval status: ' + error.message);
  }
}

/**
 * Xóa yêu cầu phê duyệt
 * @param {number} id - ID của yêu cầu phê duyệt
 * @returns {Promise<boolean>} Kết quả xóa
 */
async function deleteApproval(id) {
  try {
    await connectToDatabase();
    await pool.request()
      .input('id', sql.Int, id)
      .query('DELETE FROM approvals WHERE id = @id');
    return true;
  } catch (error) {
    console.error('Error deleting approval:', error);
    throw new Error('Could not delete approval: ' + error.message);
  }
}

/**
 * Lấy số lượng yêu cầu phê duyệt đang chờ xử lý
 * @returns {Promise<number>} Số lượng yêu cầu
 */
async function getPendingApprovalsCount() {
  try {
    await connectToDatabase();
    const result = await pool.request()
      .query(`SELECT COUNT(*) as count FROM approvals WHERE status = 'pending'`);
    return result.recordset[0].count;
  } catch (error) {
    console.error('Error counting pending approvals:', error);
    throw new Error('Could not count pending approvals: ' + error.message);
  }
}

/**
 * Cập nhật entity_id sau khi phê duyệt tạo đối tượng mới
 * @param {number} approvalId - ID của yêu cầu phê duyệt
 * @param {number} entityId - ID của đối tượng mới được tạo
 * @returns {Promise<Object>} Thông tin yêu cầu phê duyệt đã cập nhật
 */
async function updateEntityId(approvalId, entityId) {
  try {
    await connectToDatabase();
    const result = await pool.request()
      .input('id', sql.Int, approvalId)
      .input('entityId', sql.Int, entityId)
      .query(`
        UPDATE approvals
        SET entity_id = @entityId
        OUTPUT INSERTED.*
        WHERE id = @id
      `);
    return result.recordset[0];
  } catch (error) {
    console.error('Error updating approval entity ID:', error);
    throw new Error('Could not update approval entity ID: ' + error.message);
  }
}

module.exports = {
  getAllApprovals,
  getApprovalById,
  createApproval,
  updateApprovalStatus,
  deleteApproval,
  getPendingApprovalsCount,
  updateEntityId
}; 