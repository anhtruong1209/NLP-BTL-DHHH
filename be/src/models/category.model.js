const { pool, sql, connectToDatabase } = require('../config/db');

/**
 * Lấy tất cả danh mục
 * @returns {Promise<Array>} Danh sách danh mục
 */
async function getAllCategories() {
  try {
    await connectToDatabase();
    const result = await pool.request()
      .query(`
        SELECT *
        FROM categories
        WHERE isDeleted = 0
      `);
    return result.recordset;
  } catch (error) {
    throw new Error('Could not fetch categories: ' + error.message);
  }
}

/**
 * Lấy danh mục theo ID
 * @param {number} id - ID của danh mục
 * @returns {Promise<Object>} Thông tin danh mục
 */
async function getCategoryById(id) {
  try {
    await connectToDatabase();
    const result = await pool.request()
      .input('id', sql.Int, id)
      .query(`
        SELECT *
        FROM categories
        WHERE id = @id AND isDeleted = 0
      `);
    return result.recordset[0];
  } catch (error) {
    throw new Error('Could not fetch category: ' + error.message);
  }
}

/**
 * Tạo danh mục mới
 * @param {Object} data - Thông tin danh mục
 * @returns {Promise<Object>} Thông tin danh mục đã tạo
 */
async function createCategory(data) {
  try {
    await connectToDatabase();
    const result = await pool.request()
      .input('name', sql.NVarChar, data.name)
      .input('description', sql.NVarChar, data.description || null)
      .input('createdAt', sql.DateTime, new Date())
      .input('updatedAt', sql.DateTime, new Date())
      .query(`
        INSERT INTO categories (name, description, createdAt, updatedAt)
        OUTPUT INSERTED.*
        VALUES (@name, @description, @createdAt, @updatedAt)
      `);
    return result.recordset[0];
  } catch (error) {
    throw new Error('Could not create category: ' + error.message);
  }
}

/**
 * Cập nhật danh mục
 * @param {number} id - ID của danh mục
 * @param {Object} data - Thông tin cần cập nhật
 * @returns {Promise<Object>} Thông tin danh mục đã cập nhật
 */
async function updateCategory(id, data) {
  try {
    await connectToDatabase();
    const request = pool.request().input('id', sql.Int, id);

    // Danh sách các trường có thể cập nhật
    const updatableFields = {
      name: sql.NVarChar,
      description: sql.NVarChar,
      image: sql.NVarChar,
      isActive: sql.Bit
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
      UPDATE categories 
      SET ${updates.join(', ')}
      OUTPUT INSERTED.*
      WHERE id = @id AND isDeleted = 0
    `);
    
    return result.recordset[0];
  } catch (error) {
    console.error('Error updating category:', error);
    throw new Error('Could not update category: ' + error.message);
  }
}

/**
 * Xóa mềm danh mục
 * @param {number} id - ID của danh mục
 * @returns {Promise<boolean>} Kết quả xóa
 */
async function deleteCategory(id) {
  try {
    await connectToDatabase();
    await pool.request()
      .input('id', sql.Int, id)
      .input('updatedAt', sql.DateTime, new Date())
      .query('UPDATE categories SET isDeleted = 1, updatedAt = @updatedAt WHERE id = @id');
    return true;
  } catch (error) {
    throw new Error('Could not delete category: ' + error.message);
  }
}

/**
 * Lấy danh mục với tất cả công cụ AI
 * @param {number} id - ID của danh mục
 * @returns {Promise<Object>} Thông tin danh mục và công cụ AI
 */
async function getCategoryWithTools(id) {
  try {
    await connectToDatabase();
    const category = await getCategoryById(id);
    if (!category) return null;

    const tools = await pool.request()
      .input('categoryId', sql.Int, id)
      .query(`
        SELECT *
        FROM tools
        WHERE category_id = @categoryId AND isDeleted = 0
      `);

    return {
      ...category,
      tools: tools.recordset
    };
  } catch (error) {
    throw new Error('Could not fetch category with tools: ' + error.message);
  }
}

/**
 * Phục hồi danh mục đã xóa
 */
async function restoreCategory(id) {
  try {
    const request = pool.request();
    
    const query = `
      UPDATE categories
      SET isDeleted = 0,
          updatedAt = @updatedAt
      WHERE id = @id
    `;
    
    await request.input('id', sql.Int, id)
      .input('updatedAt', sql.DateTime, new Date())
      .query(query);
    
    return true;
  } catch (error) {
    console.error('Database error:', error);
    throw new Error('Không thể phục hồi danh mục');
  }
}

/**
 * Soft delete category by setting isDeleted = 1
 */
async function softDeleteCategory(id) {
  try {
    const request = pool.request();
    const query = `UPDATE categories SET isDeleted = 1, updatedAt = @updatedAt WHERE id = @id`;
    await request
      .input('id', sql.Int, id)
      .input('updatedAt', sql.DateTime, new Date())
      .query(query);
    return true;
  } catch (error) {
    throw new Error('Lỗi khi xóa danh mục: ' + error.message);
  }
}

module.exports = {
  getAllCategories,
  getCategoryById,
  createCategory,
  updateCategory,
  deleteCategory,
  getCategoryWithTools,
  restoreCategory,
  softDeleteCategory
}; 