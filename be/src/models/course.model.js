const { pool, sql } = require('../config/db');

/**
 * Lấy tất cả khóa học
 */
async function getAllCourses() {
  try {
    const result = await pool.request()
      .query(`
        SELECT *
        FROM courses
        WHERE isDeleted = 0
      `);
    return result.recordset;
  } catch (error) {
    throw new Error('Could not fetch courses: ' + error.message);
  }
}

/**
 * Lấy khóa học theo ID
 */
async function getCourseById(id) {
  try {
    const result = await pool.request()
      .input('id', sql.Int, id)
      .query(`
        SELECT *
        FROM courses
        WHERE id = @id AND isDeleted = 0
      `);
    return result.recordset[0];
  } catch (error) {
    throw new Error('Could not fetch course: ' + error.message);
  }
}

/**
 * Lấy các khóa học nổi bật
 */
async function getFeaturedCourses(limit = 6) {
  try {
    const result = await pool.request()
      .input('limit', sql.Int, limit)
      .query(`
        SELECT TOP(@limit) *
        FROM courses
        WHERE isDeleted = 0
        ORDER BY createdAt DESC
      `);
    return result.recordset;
  } catch (error) {
    throw new Error('Could not fetch featured courses: ' + error.message);
  }
}

/**
 * Tạo khóa học mới
 */
async function createCourse(data) {
  try {
    const result = await pool.request()
      .input('name', sql.NVarChar(255), data.name)
      .input('description', sql.NVarChar(sql.MAX), data.description)
      .query(`
        INSERT INTO courses (name, description)
        VALUES (@name, @description);
        
        SELECT SCOPE_IDENTITY() AS id;
      `);

    const newCourseId = result.recordset[0].id;
    return getCourseById(newCourseId);
  } catch (error) {
    throw new Error('Could not create course: ' + error.message);
  }
}

/**
 * Cập nhật khóa học
 */
async function updateCourse(id, data) {
  try {
    const updateFields = [];
    const request = pool.request().input('id', sql.Int, id);

    if (data.name !== undefined) {
      updateFields.push('name = @name');
      request.input('name', sql.NVarChar(255), data.name);
    }

    if (data.description !== undefined) {
      updateFields.push('description = @description');
      request.input('description', sql.NVarChar(sql.MAX), data.description);
    }

    if (updateFields.length === 0) return null;

    const result = await request.query(`
      UPDATE courses
      SET ${updateFields.join(', ')}, updatedAt = GETDATE()
      WHERE id = @id AND isDeleted = 0;
      
      SELECT * FROM courses WHERE id = @id AND isDeleted = 0;
    `);

    return result.recordset[0];
  } catch (error) {
    throw new Error('Could not update course: ' + error.message);
  }
}

/**
 * Xóa khóa học
 */
async function deleteCourse(id) {
  try {
    await pool.request()
      .input('id', sql.Int, id)
      .query(`
        UPDATE courses
        SET isDeleted = 1
        WHERE id = @id
      `);
    return true;
  } catch (error) {
    throw new Error('Could not delete course: ' + error.message);
  }
}

/**
 * Lấy khóa học với tất cả chi tiết
 */
async function getCourseWithDetails(id) {
  try {
    const course = await getCourseById(id);
    if (!course) return null;

    const details = await pool.request()
      .input('courseId', sql.Int, id)
      .query(`
        SELECT *
        FROM course_details
        WHERE course_id = @courseId AND isDeleted = 0
      `);

    return {
      ...course,
      details: details.recordset
    };
  } catch (error) {
    throw new Error('Could not fetch course with details: ' + error.message);
  }
}

module.exports = {
  getAllCourses,
  getCourseById,
  getFeaturedCourses,
  createCourse,
  updateCourse,
  deleteCourse,
  getCourseWithDetails,
};