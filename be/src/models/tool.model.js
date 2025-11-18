const { pool, sql } = require('../config/db');

/**
 * Lấy tất cả công cụ AI
 */
async function getAllTools(filters = {}) {
  try {
    const request = pool.request();
    let query = `
      SELECT t.*, c.name as category_name
      FROM tools t
      LEFT JOIN categories c ON t.category_id = c.id
      WHERE t.isDeleted = 0
      ORDER BY t.createdAt DESC
    `;

    // Apply filters
    if (filters.categoryId) {
      query += ' AND t.category_id = @categoryId';
      request.input('categoryId', sql.Int, filters.categoryId);
    }
    if (filters.search) {
      query += ' AND (t.name LIKE @search OR t.description LIKE @search)';
      request.input('search', sql.NVarChar, `%${filters.search}%`);
    }

    const result = await request.query(query);
    return result.recordset;
  } catch (error) {
    throw new Error('Could not fetch tools: ' + error.message);
  }
}

/**
 * Lấy công cụ AI theo ID
 */
async function getToolById(id) {
  try {
    const result = await pool.request()
      .input('id', sql.Int, id)
      .query(`
        SELECT t.*, c.name as category_name
        FROM tools t
        LEFT JOIN categories c ON t.category_id = c.id
        WHERE t.id = @id AND t.isDeleted = 0
      `);
    return result.recordset[0];
  } catch (error) {
    throw new Error('Could not fetch tool: ' + error.message);
  }
}

/**
 * Tạo công cụ AI mới
 */
async function createTool(data) {
  try {
    const result = await pool.request()
      .input('name', sql.NVarChar, data.name)
      .input('description', sql.NVarChar, data.description || null)
      .input('link', sql.NVarChar, data.link)
      .input('image', sql.NVarChar, data.image || null)
      .input('category_id', sql.Int, data.category_id)
      .input('isFeatured', sql.Bit, data.isFeatured || false)
      .input('content', sql.NVarChar, data.content || null)
      .input('viewCount', sql.Int, data.viewCount || 0) // Thêm trường viewCount với giá trị mặc định là 0
      .input('createdAt', sql.DateTime, new Date())
      .input('updatedAt', sql.DateTime, new Date())
      .query(`
        INSERT INTO tools (name, description, link, image, category_id, 
                         isFeatured, content, viewCount, createdAt, updatedAt)
        OUTPUT INSERTED.*
        VALUES (@name, @description, @link, @image, @category_id,
                @isFeatured, @content, @viewCount, @createdAt, @updatedAt)
      `);
    return result.recordset[0];
  } catch (error) {
    throw new Error('Could not create tool: ' + error.message);
  }
}

/**
 * Cập nhật công cụ AI
 */
async function updateTool(id, data) {
  try {
    const request = pool.request().input('id', sql.Int, id);
    
    // Danh sách các trường có thể cập nhật
    const updatableFields = {
      name: sql.NVarChar,
      description: sql.NVarChar,
      link: sql.NVarChar,
      image: sql.NVarChar,
      category_id: sql.Int,
      isFeatured: sql.Bit,
      embedded_docs_url: sql.NVarChar,
      content: sql.NVarChar,
      viewCount: sql.Int,
    };

    const updates = [];
    
    // Xử lý tất cả các trường có thể cập nhật
    Object.keys(data).forEach(field => {
      if (field in updatableFields && data[field] !== undefined) {
        updates.push(`${field} = @${field}`);
        request.input(field, updatableFields[field], data[field]);
      }
    });

    // Luôn cập nhật updatedAt
    updates.push('updatedAt = @updatedAt');
    request.input('updatedAt', sql.DateTime, new Date());

    if (updates.length === 0) {
      throw new Error('No valid fields to update');
    }

    const result = await request.query(`
      UPDATE tools 
      SET ${updates.join(', ')}
      OUTPUT INSERTED.*
      WHERE id = @id AND isDeleted = 0
    `);

    return result.recordset[0];
  } catch (error) {
    console.error('Error updating tool:', error);
    throw new Error('Could not update tool: ' + error.message);
  }
}

/**
 * Xóa mềm công cụ AI
 */
async function deleteTool(id) {
  try {
    await pool.request()
      .input('id', sql.Int, id)
      .input('updatedAt', sql.DateTime, new Date())
      .query('UPDATE tools SET isDeleted = 1, updatedAt = @updatedAt WHERE id = @id');
    return true;
  } catch (error) {
    throw new Error('Could not delete tool: ' + error.message);
  }
}

/**
 * Tìm kiếm công cụ AI
 */
async function searchTools(searchTerm, limit = 10) {
  try {
    const request = pool.request();
    
    const query = `
      SELECT TOP(@limit) t.id, t.name, t.description, t.link, t.image, t.category_id, t.isFeatured, 
            t.embedded_docs_url, t.viewCount, t.content, t.createdAt, t.updatedAt, 
            c.name as category_name
      FROM tools t
      LEFT JOIN categories c ON t.category_id = c.id
      WHERE (t.name LIKE @search OR t.description LIKE @search)
        AND t.isDeleted = 0
        AND (c.isDeleted = 0 OR c.isDeleted IS NULL)
      ORDER BY t.isFeatured DESC, t.name ASC
    `;
    
    request.input('search', sql.NVarChar, `%${searchTerm}%`);
    request.input('limit', sql.Int, limit);
    const result = await request.query(query);
    
    return result.recordset;
  } catch (error) {
    console.error('Database error:', error);
    throw new Error('Không thể tìm kiếm công cụ AI');
  }
}

/**
 * Lấy các công cụ AI theo danh mục
 */
async function getToolsByCategory() {
  try {
    const request = pool.request();
    
    // Lấy tất cả danh mục (không bị xóa)
    const categoriesQuery = `
      SELECT id, name, description, icon, position, createdAt, updatedAt 
      FROM categories
      WHERE isDeleted = 0
      ORDER BY position ASC, name ASC
    `;
    
    const categoriesResult = await request.query(categoriesQuery);
    const categories = categoriesResult.recordset;
    
    // Nếu không tìm thấy danh mục, trả về mảng tools trực tiếp
    if (!categories || categories.length === 0) {
      const allToolsRequest = pool.request();
      const allToolsQuery = `
        SELECT t.id, t.name, t.description, t.link, t.image, t.category_id, t.isFeatured, 
              t.embedded_docs_url, t.viewCount, t.content, t.createdAt, t.updatedAt, 
              c.name as category_name 
        FROM tools t
        LEFT JOIN categories c ON t.category_id = c.id
        WHERE t.isDeleted = 0
          AND (c.isDeleted = 0 OR c.isDeleted IS NULL)
        ORDER BY t.isFeatured DESC, t.name ASC
      `;
      
      const allToolsResult = await allToolsRequest.query(allToolsQuery);
      
      return {
        tools: allToolsResult.recordset || []
      };
    }
    
    // Kết quả trả về sẽ là mảng các danh mục với công cụ
    const result = [];
    
    // Với mỗi danh mục, lấy các công cụ thuộc danh mục đó
    for (const category of categories) {
      const toolsRequest = pool.request();
      
      const toolsQuery = `
        SELECT id, name, description, link, image, category_id, isFeatured, 
              embedded_docs_url, viewCount, content, createdAt, updatedAt
        FROM tools
        WHERE category_id = @categoryId
          AND isDeleted = 0
        ORDER BY isFeatured DESC, name ASC
      `;
      
      toolsRequest.input('categoryId', sql.Int, category.id);
      const toolsResult = await toolsRequest.query(toolsQuery);
      
      // Chỉ thêm danh mục có ít nhất một công cụ
      if (toolsResult.recordset.length > 0) {
        result.push({
          id: category.id,  
          name: category.name,
          description: category.description,  
          tools: toolsResult.recordset
        });
      }
    }
    
    // Nếu không có danh mục nào có công cụ, trả về mảng trống
    if (result.length === 0) {
      // Lấy tất cả công cụ để trả về
      const allToolsRequest = pool.request();
      const allToolsQuery = `
        SELECT t.id, t.name, t.description, t.link, t.image, t.category_id, t.isFeatured, 
              t.embedded_docs_url, t.viewCount, t.content, t.createdAt, t.updatedAt, 
              c.name as category_name 
        FROM tools t
        LEFT JOIN categories c ON t.category_id = c.id
        WHERE t.isDeleted = 0
          AND (c.isDeleted = 0 OR c.isDeleted IS NULL)
        ORDER BY t.isFeatured DESC, t.name ASC
      `;
      
      const allToolsResult = await allToolsRequest.query(allToolsQuery);
      
      return {
        tools: allToolsResult.recordset || []
      };
    }
    
    return result;
  } catch (error) {
    console.error('Database error:', error);
    throw new Error('Không thể lấy danh sách công cụ AI theo danh mục');
  }
}

/**
 * Soft delete tool by setting isDeleted = 1
 */
async function softDeleteTool(id) {
  try {
    const request = pool.request();
    const query = `UPDATE tools SET isDeleted = 1, updatedAt = @updatedAt WHERE id = @id`;
    await request
      .input('id', sql.Int, id)
      .input('updatedAt', sql.DateTime, new Date())
      .query(query);
    return true;
  } catch (error) {
    throw new Error('Lỗi khi xóa công cụ: ' + error.message);
  }
}

module.exports = {
  getAllTools,
  getToolById,
  createTool,
  updateTool,
  deleteTool,
  searchTools,
  getToolsByCategory,
  softDeleteTool
}; 