const { pool, sql } = require('../config/db');

/**
 * Lấy tất cả API keys
 */
async function getAllApiKeys() {
  try {
    const request = pool.request();
    
    const query = `
      SELECT ak.id, ak.name, ak.service_name, ak.model, ak.api_key, 
             ak.is_active, ak.usage_count, ak.last_used, 
             ak.createdAt, ak.updatedAt
      FROM api_keys ak
      WHERE ak.isDeleted = 0
      ORDER BY ak.service_name, ak.name
    `;
    const result = await request.query(query);
    return result.recordset;
  } catch (error) {
    console.error('Database error:', error);
    throw new Error('Không thể lấy danh sách API keys');
  }
}

/**
 * Lấy API Key theo ID
 */
async function getApiKeyById(id) {
  try {
    const request = pool.request();
    
    const query = `
      SELECT ak.*, u.username, u.email
      FROM api_keys ak
      LEFT JOIN users u ON ak.id = u.id
      WHERE ak.id = @id AND ak.isDeleted = 0
    `;
    
    request.input('id', sql.Int, id);
    const result = await request.query(query);
    
    if (result.recordset.length === 0) {
      return null;
    }
    
    // Xử lý kết quả để thêm thông tin người dùng
    const apiKey = result.recordset[0];
    const { username, email, ...apiKeyData } = apiKey;
    
    // Chuyển đổi dữ liệu để phù hợp với frontend
    return {
      id: apiKeyData.id,
      name: apiKeyData.name,
      description: apiKeyData.service_name, // Sử dụng service_name làm description
      model: apiKeyData.model, // Thêm trường model
      key: apiKeyData.api_key, // Sử dụng api_key cho trường key
      user_id: null, // Không có trường user_id trong bảng
      status: apiKeyData.is_active ? 'active' : 'inactive', // Chuyển đổi is_active thành status
      usage_count: apiKeyData.usage_count,
      last_used: apiKeyData.last_used,
      created_at: apiKeyData.createdAt,
      updated_at: apiKeyData.updatedAt,
      user: username || email ? { username, email } : null
    };
  } catch (error) {
    console.error('Database error:', error);
    throw new Error('Không thể lấy thông tin API Key');
  }
}

/**
 * Tạo API Key mới
 */
async function createApiKey(apiKeyData) {
  try {
    const request = pool.request();
    
    // Ngày hiện tại
    const currentDate = new Date();
    
    const query = `
      INSERT INTO api_keys (
        name, service_name, model, api_key, is_active, isDeleted, createdAt, updatedAt
      )
      OUTPUT INSERTED.*
      VALUES (
        @name, @service_name, @model, @api_key, @is_active, 0, @createdAt, @updatedAt
      )
    `;
    
    request.input('name', sql.NVarChar, apiKeyData.name);
    request.input('service_name', sql.NVarChar, apiKeyData.description || 'Default Service');
    request.input('model', sql.NVarChar, apiKeyData.model || 'gemini-2.0-flash');
    request.input('api_key', sql.NVarChar, apiKeyData.key);
    request.input('is_active', sql.Bit, apiKeyData.status === 'active' ? 1 : 0);
    request.input('createdAt', sql.DateTime, currentDate);
    request.input('updatedAt', sql.DateTime, currentDate);
    
    const result = await request.query(query);
    
    const newApiKey = result.recordset[0];
    
    // Chuyển đổi dữ liệu để phù hợp với frontend
    return {
      id: newApiKey.id,
      name: newApiKey.name,
      description: newApiKey.service_name,
      model: newApiKey.model,
      key: newApiKey.api_key,
      user_id: null,
      status: newApiKey.is_active ? 'active' : 'inactive',
      usage_count: newApiKey.usage_count || 0,
      last_used: newApiKey.last_used,
      created_at: newApiKey.createdAt,
      updated_at: newApiKey.updatedAt
    };
  } catch (error) {
    console.error('Database error:', error);
    throw new Error('Không thể tạo API Key mới');
  }
}

/**
 * Cập nhật API Key
 */
async function updateApiKey(id, apiKeyData) {
  try {
    const request = pool.request();
    
    let setClause = [];
    
    if (apiKeyData.name !== undefined) {
      request.input('name', sql.NVarChar, apiKeyData.name);
      setClause.push('name = @name');
    }
    
    if (apiKeyData.description !== undefined) {
      request.input('service_name', sql.NVarChar, apiKeyData.description);
      setClause.push('service_name = @service_name');
    }
    
    if (apiKeyData.model !== undefined) {
      request.input('model', sql.NVarChar, apiKeyData.model);
      setClause.push('model = @model');
    }
    
    if (apiKeyData.key !== undefined) {
      request.input('api_key', sql.NVarChar, apiKeyData.key);
      setClause.push('api_key = @api_key');
    }
    
    if (apiKeyData.status !== undefined) {
      request.input('is_active', sql.Bit, apiKeyData.status === 'active' ? 1 : 0);
      setClause.push('is_active = @is_active');
    }
    
    if (setClause.length === 0) {
      // Không có gì để cập nhật
      return await getApiKeyById(id);
    }
    
    // Thêm updatedAt vào danh sách cập nhật
    const currentDate = new Date();
    request.input('updatedAt', sql.DateTime, currentDate);
    setClause.push('updatedAt = @updatedAt');
    
    const query = `
      UPDATE api_keys
      SET ${setClause.join(', ')}
      OUTPUT INSERTED.*
      WHERE id = @id AND isDeleted = 0
    `;
    
    request.input('id', sql.Int, id);
    const result = await request.query(query);
    
    if (result.recordset.length === 0) {
      return null;
    }
    
    const updatedApiKey = result.recordset[0];
    
    // Chuyển đổi dữ liệu để phù hợp với frontend
    return {
      id: updatedApiKey.id,
      name: updatedApiKey.name,
      description: updatedApiKey.service_name,
      model: updatedApiKey.model,
      key: updatedApiKey.api_key,
      user_id: null,
      status: updatedApiKey.is_active ? 'active' : 'inactive',
      usage_count: updatedApiKey.usage_count || 0,
      last_used: updatedApiKey.last_used,
      created_at: updatedApiKey.createdAt,
      updated_at: updatedApiKey.updatedAt
    };
  } catch (error) {
    console.error('Database error:', error);
    throw new Error('Không thể cập nhật API Key');
  }
}

/**
 * Xóa mềm API Key
 */
async function deleteApiKey(id) {
  try {
    const request = pool.request();
    
    const query = `
      UPDATE api_keys
      SET isDeleted = 1,
          updatedAt = @updatedAt
      WHERE id = @id
    `;
    
    request.input('id', sql.Int, id);
    request.input('updatedAt', sql.DateTime, new Date());
    const result = await request.query(query);
    
    return result.rowsAffected[0] > 0;
  } catch (error) {
    console.error('Database error:', error);
    throw new Error('Không thể xóa API Key');
  }
}

/**
 * Cập nhật thông tin sử dụng API Key
 */
async function updateApiKeyUsage(id) {
  try {
    const request = pool.request();
    
    const currentDate = new Date();
    
    const query = `
      UPDATE api_keys
      SET usage_count = ISNULL(usage_count, 0) + 1,
          last_used = @lastUsed,
          updatedAt = @updatedAt
      OUTPUT INSERTED.*
      WHERE id = @id AND isDeleted = 0
    `;
    
    request.input('id', sql.Int, id);
    request.input('lastUsed', sql.DateTime, currentDate);
    request.input('updatedAt', sql.DateTime, currentDate);
    const result = await request.query(query);
    
    if (result.recordset.length === 0) {
      return null;
    }
    
    const updatedApiKey = result.recordset[0];
    
    // Chuyển đổi dữ liệu để phù hợp với frontend
    return {
      id: updatedApiKey.id,
      name: updatedApiKey.name,
      description: updatedApiKey.service_name,
      key: updatedApiKey.api_key,
      user_id: null,
      status: updatedApiKey.is_active ? 'active' : 'inactive',
      usage_count: updatedApiKey.usage_count || 0,
      last_used: updatedApiKey.last_used,
      created_at: updatedApiKey.createdAt,
      updated_at: updatedApiKey.updatedAt
    };
  } catch (error) {
    console.error('Database error:', error);
    throw new Error('Không thể cập nhật thông tin sử dụng API Key');
  }
}

/**
 * Xác thực API Key
 */
async function validateApiKey(apiKey) {
  try {
    const request = pool.request();
    
    const query = `
      SELECT *
      FROM api_keys
      WHERE api_key = @api_key AND is_active = 1 AND isDeleted = 0
    `;
    
    request.input('api_key', sql.NVarChar, apiKey);
    const result = await request.query(query);
    
    if (result.recordset.length === 0) {
      return null;
    }
    
    // Cập nhật thông tin sử dụng
    await updateApiKeyUsage(result.recordset[0].id);
    
    return {
      id: result.recordset[0].id,
      name: result.recordset[0].name,
      service_name: result.recordset[0].service_name
    };
  } catch (error) {
    console.error('Database error:', error);
    throw new Error('Không thể xác thực API Key');
  }
}

/**
 * Phục hồi API Key đã xóa
 */
async function restoreApiKey(id) {
  try {
    const request = pool.request();
    
    const query = `
      UPDATE api_keys
      SET isDeleted = 0,
          updatedAt = @updatedAt
      WHERE id = @id
    `;
    
    request.input('id', sql.Int, id);
    request.input('updatedAt', sql.DateTime, new Date());
    const result = await request.query(query);
    
    return result.rowsAffected[0] > 0;
  } catch (error) {
    console.error('Database error:', error);
    throw new Error('Không thể phục hồi API Key');
  }
}

/**
 * Lấy API Key theo model
 */
async function getApiKeyByModel(model) {
  try {
    const request = pool.request();
    
    // Thiết lập timeout cho request
    request.timeout = 5000; // 5 giây
    
    const query = `
      SELECT TOP 1 ak.id, ak.name, ak.service_name, ak.model, ak.api_key, 
             ak.is_active, ak.usage_count, ak.last_used, 
             ak.createdAt, ak.updatedAt
      FROM api_keys ak
      WHERE ak.model = @model AND ak.is_active = 1 AND ak.isDeleted = 0
    `;
    
    request.input('model', sql.NVarChar, model);
    const result = await request.query(query);
    
    if (result.recordset.length === 0) {
      return null;
    }
    
    const apiKey = result.recordset[0];
    
    // Cập nhật thông tin sử dụng nếu cần
    try {
      if (apiKey.id) {
        await updateApiKeyUsage(apiKey.id);
      }
    } catch (updateError) {
      console.error('Lỗi khi cập nhật thông tin sử dụng:', updateError);
      // Tiếp tục xử lý, không throw lỗi
    }
    
    return {
      id: apiKey.id,
      name: apiKey.name,
      service_name: apiKey.service_name,
      model: apiKey.model,
      api_key: apiKey.api_key,
      is_active: apiKey.is_active
    };
  } catch (error) {
    console.error(`Lỗi database khi tìm API key cho model ${model}:`, error);
    
    // Kiểm tra xem lỗi có phải do kết nối không
    if (error.code === 'ETIMEOUT' || error.code === 'ECONNCLOSED' || error.code === 'ECONNREFUSED') {
      console.error('Lỗi kết nối đến database');
    }
    
    throw new Error(`Không thể lấy API Key cho model ${model}: ${error.message}`);
  }
}

/**
 * Soft delete API Key by setting isDeleted = 1
 */
async function softDeleteApiKey(id) {
  try {
    const request = pool.request();
    const query = `UPDATE api_keys SET isDeleted = 1, updatedAt = @updatedAt WHERE id = @id`;
    await request
      .input('id', sql.Int, id)
      .input('updatedAt', sql.DateTime, new Date())
      .query(query);
    return true;
  } catch (error) {
    throw new Error('Lỗi khi xóa API Key: ' + error.message);
  }
}

module.exports = {
  getAllApiKeys,
  getApiKeyById,
  createApiKey,
  updateApiKey,
  deleteApiKey,
  updateApiKeyUsage,
  validateApiKey,
  restoreApiKey,
  getApiKeyByModel,
  softDeleteApiKey
}; 