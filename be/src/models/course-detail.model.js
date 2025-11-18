const { pool, sql } = require('../config/db');

/**
 * Lấy tất cả chi tiết khóa học
 */
async function getAllCourseDetails(filters = {}) {
  try {
    const request = pool.request();
    let query = `
      SELECT cd.*, c.name as course_name
      FROM course_details cd
      LEFT JOIN courses c ON cd.course_id = c.id
      WHERE cd.isDeleted = 0
    `;

    // Apply filters
    if (filters.courseId) {
      query += ' AND cd.course_id = @courseId';
      request.input('courseId', sql.Int, filters.courseId);
    }
    if (filters.search) {
      query += ' AND (cd.title LIKE @search OR cd.description LIKE @search)';
      request.input('search', sql.NVarChar, `%${filters.search}%`);
    }

    const result = await request.query(query);
    return result.recordset;
  } catch (error) {
    console.error('Error fetching course details:', error);
    throw new Error('Could not fetch course details: ' + error.message);
  }
}

/**
 * Lấy chi tiết khóa học theo ID
 */
async function getCourseDetailById(id) {
  try {
    const result = await pool.request()
      .input('id', sql.Int, id)
      .query(`
        SELECT cd.*, c.name as course_name
        FROM course_details cd
        LEFT JOIN courses c ON cd.course_id = c.id
        WHERE cd.id = @id AND cd.isDeleted = 0
      `);
    return result.recordset[0];
  } catch (error) {
    console.error('Error fetching course detail:', error);
    throw new Error('Could not fetch course detail: ' + error.message);
  }
}
/**
 * Tạo chi tiết khóa học mới
 */
async function createCourseDetail(data) {
  try {
    // Thực hiện insert và lấy ID mới
    const insertResult = await pool.request()
      .input('title', sql.NVarChar, data.title)
      .input('description', sql.NVarChar, data.description || null)
      .input('content', sql.NVarChar(sql.MAX), data.content)
      .input('content_html', sql.NVarChar(sql.MAX), data.content_html || null)
      .input('course_id', sql.Int, data.course_id)
      .input('image', sql.NVarChar(sql.MAX), data.image || null)
      .input('download_url', sql.NVarChar(4000), data.download_url || null)
      .input('viewCount', sql.Int, data.viewCount || 0) // Thêm trường viewCount với giá trị mặc định là 0
      .input('createdAt', sql.DateTime, new Date())
      .input('updatedAt', sql.DateTime, new Date())
      .query(`
        INSERT INTO course_details (
          title, description, content, content_html, course_id, 
          image, download_url, viewCount, createdAt, updatedAt
        )
        VALUES (
          @title, @description, @content, @content_html, @course_id,
          @image, @download_url, @viewCount, @createdAt, @updatedAt
        );
        SELECT SCOPE_IDENTITY() AS id;
      `);

    const newId = insertResult.recordset[0].id;

    // Lấy dữ liệu chi tiết vừa tạo
    const result = await pool.request()
      .input('id', sql.Int, newId)
      .query(`
        SELECT cd.*, c.name as course_name
        FROM course_details cd
        LEFT JOIN courses c ON cd.course_id = c.id
        WHERE cd.id = @id
      `);

    return result.recordset[0];
  } catch (error) {
    console.error('Error creating course detail:', error);
    throw new Error('Could not create course detail: ' + error.message);
  }
}

/**
 * Cập nhật chi tiết khóa học
 */
async function updateCourseDetail(id, data) {
  try {
    
    const request = pool.request()
      .input('id', sql.Int, id);

    // Danh sách các trường có thể cập nhật
    const updatableFields = {
      title: sql.NVarChar,
      description: sql.NVarChar,
      content: sql.NVarChar,
      content_html: sql.NVarChar(sql.MAX),
      course_id: sql.Int,
      image: sql.NVarChar(sql.MAX),
      download_url: sql.NVarChar(4000),
      viewCount: sql.Int // Thêm trường viewCount
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

    // Thực hiện cập nhật
    await request.query(`
      UPDATE course_details 
      SET ${updates.join(', ')}
      WHERE id = @id AND isDeleted = 0
    `);

    // Lấy dữ liệu mới nhất
    const result = await pool.request()
      .input('id', sql.Int, id)
      .query(`
        SELECT cd.*, c.name as course_name
        FROM course_details cd
        LEFT JOIN courses c ON cd.course_id = c.id
        WHERE cd.id = @id AND cd.isDeleted = 0
      `);

    if (!result.recordset[0]) {
      throw new Error('Course detail not found after update');
    }

    return result.recordset[0];
  } catch (error) {
    console.error('Error updating course detail:', error);
    throw new Error('Could not update course detail: ' + error.message);
  }
}

/**
 * Xóa mềm chi tiết khóa học
 */
async function softDeleteCourseDetail(id) {
  try {
    const request = pool.request();
    const query = `UPDATE course_details SET isDeleted = 1, updatedAt = @updatedAt WHERE id = @id`;
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
  getAllCourseDetails,
  getCourseDetailById,
  createCourseDetail,
  updateCourseDetail,
  softDeleteCourseDetail,
}; 