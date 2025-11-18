const { pool, sql, connectToDatabase } = require('../config/db');

/**
 * Tạo log mới
 * @param {Object} data - Thông tin log
 * @returns {Promise<Object>} Thông tin log đã tạo
 */
async function createLog(data) {
  try {
    await connectToDatabase();
    
    // Giới hạn kích thước của dữ liệu trước khi lưu vào database
    const processedData = {
      userId: data.userId || null,
      action: (data.action || '').substring(0, 50),
      entityType: (data.entityType || '').substring(0, 50),
      entityId: data.entityId || null,
      description: (data.description || '').substring(0, 1000),
      oldData: data.oldData ? JSON.stringify(data.oldData).substring(0, 1000) : null,
      newData: data.newData ? JSON.stringify(data.newData).substring(0, 1000) : null,
      ipAddress: (data.ipAddress || '').substring(0, 50),
      userAgent: (data.userAgent || '').substring(0, 500)
    };
    
    const result = await pool.request()
      .input('userId', sql.Int, processedData.userId)
      .input('action', sql.NVarChar, processedData.action)
      .input('entityType', sql.NVarChar, processedData.entityType)
      .input('entityId', sql.Int, processedData.entityId)
      .input('description', sql.NVarChar, processedData.description)
      .input('oldData', sql.NVarChar, processedData.oldData)
      .input('newData', sql.NVarChar, processedData.newData)
      .input('ipAddress', sql.NVarChar, processedData.ipAddress)
      .input('userAgent', sql.NVarChar, processedData.userAgent)
      .input('createdAt', sql.DateTime, new Date())
      .query(`
        INSERT INTO logs (
          userId, action, entityType, entityId, description,
          oldData, newData, ipAddress, userAgent, createdAt
        )
        OUTPUT INSERTED.*
        VALUES (
          @userId, @action, @entityType, @entityId, @description,
          @oldData, @newData, @ipAddress, @userAgent, @createdAt
        )
      `);
    return result.recordset[0];
  } catch (error) {
    console.error('Error creating log:', error);
    throw new Error('Could not create log: ' + error.message);
  }
}

/**
 * Lấy tất cả logs
 * @param {Object} options - Tùy chọn lọc và phân trang
 * @returns {Promise<Array>} Danh sách logs
 */
async function getLogs(options = {}) {
  try {
    await connectToDatabase();
    const request = pool.request();
    
    // Build the query with optional filters
    let query = `SELECT * FROM logs`;
    const whereConditions = [];
    
    if (options.userId) {
      whereConditions.push('userId = @userId');
      request.input('userId', sql.Int, options.userId);
    }
    
    if (options.action) {
      whereConditions.push('action = @action');
      request.input('action', sql.NVarChar, options.action);
    }
    
    if (options.entityType) {
      whereConditions.push('entityType = @entityType');
      request.input('entityType', sql.NVarChar, options.entityType);
    }
    
    if (options.entityId) {
      whereConditions.push('entityId = @entityId');
      request.input('entityId', sql.Int, options.entityId);
    }
    
    if (options.startDate) {
      whereConditions.push('createdAt >= @startDate');
      request.input('startDate', sql.DateTime, new Date(options.startDate));
    }
    
    if (options.endDate) {
      whereConditions.push('createdAt <= @endDate');
      request.input('endDate', sql.DateTime, new Date(options.endDate));
    }
    
    if (whereConditions.length > 0) {
      query += ' WHERE ' + whereConditions.join(' AND ');
    }
    
    // Add sorting
    query += ' ORDER BY createdAt DESC';
    
    // Add pagination
    if (options.limit) {
      query += ' OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY';
      request.input('offset', sql.Int, options.offset || 0);
      request.input('limit', sql.Int, options.limit);
    }
    
    const result = await request.query(query);
    return result.recordset;
  } catch (error) {
    console.error('Error fetching logs:', error);
    throw new Error('Could not fetch logs: ' + error.message);
  }
}

/**
 * Lấy log theo ID
 * @param {number} id - ID của log
 * @returns {Promise<Object>} Thông tin log
 */
async function getLogById(id) {
  try {
    await connectToDatabase();
    const result = await pool.request()
      .input('id', sql.Int, id)
      .query('SELECT * FROM logs WHERE id = @id');
    return result.recordset[0];
  } catch (error) {
    console.error('Error fetching log by id:', error);
    throw new Error('Could not fetch log: ' + error.message);
  }
}

/**
 * Xóa logs cũ hơn một ngày cụ thể
 * @param {Date} date - Ngày giới hạn để xóa các logs cũ hơn
 * @returns {Promise<number>} Số lượng logs đã xóa
 */
async function deleteOldLogs(date) {
  try {
    await connectToDatabase();
    const result = await pool.request()
      .input('date', sql.DateTime, date)
      .query('DELETE FROM logs WHERE createdAt < @date');
    return result.rowsAffected[0];
  } catch (error) {
    console.error('Error deleting old logs:', error);
    throw new Error('Could not delete old logs: ' + error.message);
  }
}

/**
 * Đếm số lượng logs theo các điều kiện lọc
 * @param {Object} options - Tùy chọn lọc
 * @returns {Promise<number>} Số lượng logs
 */
async function countLogs(options = {}) {
  try {
    await connectToDatabase();
    const request = pool.request();
    
    // Build the query with optional filters
    let query = `SELECT COUNT(*) as count FROM logs`;
    const whereConditions = [];
    
    if (options.userId) {
      whereConditions.push('userId = @userId');
      request.input('userId', sql.Int, options.userId);
    }
    
    if (options.action) {
      whereConditions.push('action = @action');
      request.input('action', sql.NVarChar, options.action);
    }
    
    if (options.entityType) {
      whereConditions.push('entityType = @entityType');
      request.input('entityType', sql.NVarChar, options.entityType);
    }
    
    if (options.startDate) {
      whereConditions.push('createdAt >= @startDate');
      request.input('startDate', sql.DateTime, new Date(options.startDate));
    }
    
    if (options.endDate) {
      whereConditions.push('createdAt <= @endDate');
      request.input('endDate', sql.DateTime, new Date(options.endDate));
    }
    
    if (whereConditions.length > 0) {
      query += ' WHERE ' + whereConditions.join(' AND ');
    }
    
    const result = await request.query(query);
    return result.recordset[0].count;
  } catch (error) {
    console.error('Error counting logs:', error);
    throw new Error('Could not count logs: ' + error.message);
  }
}

module.exports = {
  createLog,
  getLogs,
  getLogById,
  deleteOldLogs,
  countLogs
}; 