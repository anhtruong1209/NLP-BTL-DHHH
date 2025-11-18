const { pool, sql, connectToDatabase } = require('../config/db');
const bcrypt = require('bcryptjs');

/**
 * Lấy tất cả người dùng
 * @returns {Promise<Array>} Danh sách người dùng
 */
async function getAllUsers() {
  try {
    await connectToDatabase();
    const result = await pool.request()
      .query(`
        SELECT *
        FROM users
        WHERE isDeleted = 0
      `);
    return result.recordset;
  } catch (error) {
    throw new Error('Could not fetch users: ' + error.message);
  }
}

/**
 * Lấy thông tin người dùng theo ID
 * @param {number} id - ID của người dùng
 * @returns {Promise<Object>} Thông tin người dùng
 */
async function getUserById(id) {
  try {
    await connectToDatabase();
    const result = await pool.request()
      .input('id', sql.Int, id)
      .query(`
        SELECT id, username, email, firstName, lastName, avatar, 
               role, status, createdAt, updatedAt
        FROM users
        WHERE id = @id AND isDeleted = 0
      `);
    
    const user = result.recordset[0];
    if (user) {
      // Add backward compatibility
      user.isAdmin = user.role === 'admin' || user.role === 'mode';
      user.isMode = user.role === 'mode';
    }
    
    return user;
  } catch (error) {
    throw new Error('Could not fetch user: ' + error.message);
  }
}

/**
 * Lấy thông tin người dùng theo email
 * @param {string} email - Email của người dùng
 * @returns {Promise<Object>} Thông tin người dùng
 */
async function getUserByEmail(email) {
  try {
    await connectToDatabase();
    // Sử dụng LOWER để so sánh case-insensitive
    const result = await pool.request()
      .input('email', sql.NVarChar, email)
      .query(`
        SELECT id, username, email, password, firstName, lastName, avatar, 
               role, status, createdAt, updatedAt, sso_id, lastLogin
        FROM users
        WHERE LOWER(email) = LOWER(@email) AND isDeleted = 0
      `);
    
    const user = result.recordset[0];
    if (user) {
      // Add backward compatibility
      user.isAdmin = user.role === 'admin' || user.role === 'mode';
      user.isMode = user.role === 'mode';
    }
    
    return user;
  } catch (error) {
    throw new Error('Could not fetch user by email: ' + error.message);
  }
}

/**
 * Tạo người dùng mới
 * @param {Object} data - Thông tin người dùng
 * @returns {Promise<Object>} Thông tin người dùng đã tạo
 */
async function createUser(data) {
  try {
    await connectToDatabase();
    const username = data.username || data.email.split('@')[0];
    
    // Determine role from isAdmin/isMode for backward compatibility
    let role = 'user';
    if (data.role) {
      role = data.role;
    } else if (data.isMode) {
      role = 'mode';
    } else if (data.isAdmin) {
      role = 'admin';
    }
    
    const result = await pool.request()
      .input('username', sql.NVarChar, username)
      .input('email', sql.NVarChar, data.email)
      .input('password', sql.NVarChar, data.password || null)  // Allow null password for SSO
      .input('firstName', sql.NVarChar, data.firstName || null)
      .input('lastName', sql.NVarChar, data.lastName || null)
      .input('role', sql.NVarChar, role)
      .input('status', sql.NVarChar, data.status || 'active')
      .input('sso_id', sql.NVarChar, data.sso_id || null)
      .input('lastLogin', sql.DateTime, data.lastLogin || new Date())
      .input('createdAt', sql.DateTime, new Date())
      .input('updatedAt', sql.DateTime, new Date())
      .query(`
        INSERT INTO users (
          username, email, password, firstName, lastName,
          role, status, sso_id, lastLogin,
          createdAt, updatedAt
        )
        OUTPUT INSERTED.*
        VALUES (
          @username, @email, @password, @firstName, @lastName,
          @role, @status, @sso_id, @lastLogin,
          @createdAt, @updatedAt
        )
      `);
      
    const user = result.recordset[0];
    if (user) {
      // Add backward compatibility
      user.isAdmin = user.role === 'admin' || user.role === 'mode';
      user.isMode = user.role === 'mode';
    }
    
    return user;
  } catch (error) {
    throw new Error('Could not create user: ' + error.message);
  }
}

/**
 * Cập nhật thông tin người dùng
 * @param {number} id - ID của người dùng
 * @param {Object} data - Thông tin cần cập nhật
 * @returns {Promise<Object>} Thông tin người dùng đã cập nhật
 */
async function updateUser(id, data) {
  try {
    await connectToDatabase();
    const request = pool.request().input('id', sql.Int, id);

    // Handle role conversion from isAdmin/isMode for backward compatibility
    if ((data.isAdmin !== undefined || data.isMode !== undefined) && data.role === undefined) {
      if (data.isMode) {
        data.role = 'mode';
      } else if (data.isAdmin) {
        data.role = 'admin';
      } else {
        data.role = 'user';
      }
    }

    // Danh sách các trường có thể cập nhật
    const updatableFields = {
      username: sql.NVarChar,
      firstName: sql.NVarChar,
      lastName: sql.NVarChar,
      email: sql.NVarChar,
      avatar: sql.NVarChar,
      role: sql.NVarChar,
      status: sql.NVarChar,
      sso_id: sql.NVarChar,
      lastLogin: sql.DateTime
    };

    const updates = [];
    
    // Xử lý tất cả các trường có thể cập nhật
    Object.keys(data).forEach(field => {
      if (field in updatableFields && data[field] !== undefined) {
        updates.push(`${field} = @${field}`);
        request.input(field, updatableFields[field], data[field]);
      }
    });

    // Xử lý trường hợp đặc biệt: password
    if (data.password) {
      const hashedPassword = await bcrypt.hash(data.password, 10);
      updates.push('password = @password');
      request.input('password', sql.NVarChar, hashedPassword);
    }

    // Luôn cập nhật updatedAt
    updates.push('updatedAt = @updatedAt');
    request.input('updatedAt', sql.DateTime, new Date());

    if (updates.length === 0) {
      throw new Error('No valid fields to update');
    }

    const result = await request.query(`
      UPDATE users 
      SET ${updates.join(', ')}
      OUTPUT INSERTED.*
      WHERE id = @id AND isDeleted = 0
    `);
    
    const user = result.recordset[0];
    if (user) {
      // Add backward compatibility
      user.isAdmin = user.role === 'admin' || user.role === 'mode';
      user.isMode = user.role === 'mode';
    }
    
    return user;
  } catch (error) {
    console.error('Error updating user:', error);
    throw new Error('Could not update user: ' + error.message);
  }
}

/**
 * Xóa cứng người dùng
 * @param {number} id - ID của người dùng
 * @returns {Promise<boolean>} Kết quả xóa
 */
async function deleteUser(id) {
  try {
    await connectToDatabase();
    await pool.request()
      .input('id', sql.Int, id)
      .input('updatedAt', sql.DateTime, new Date())
      .query('DELETE FROM users WHERE id = @id');
    return true;
  } catch (error) {
    throw new Error('Could not delete user: ' + error.message);
  }
}

/**
 * Xóa mềm người dùng bằng cách set isDeleted = 1
 * @param {number} id - ID của người dùng
 * @returns {Promise<boolean>} Kết quả xóa
 */
async function softDeleteUser(id) {
  try {
    await connectToDatabase();
    const request = pool.request();
    const query = `UPDATE users SET isDeleted = 1, updatedAt = @updatedAt WHERE id = @id`;
    await request
      .input('id', sql.Int, id)
      .input('updatedAt', sql.DateTime, new Date())
      .query(query);
    return true;
  } catch (error) {
    throw new Error('Lỗi khi xóa người dùng: ' + error.message);
  }
}

/**
 * Phục hồi người dùng đã xóa mềm
 * @param {number} id - ID của người dùng
 * @returns {Promise<boolean>} Kết quả phục hồi
 */
async function restoreUser(id) {
  try {
    await connectToDatabase();
    const request = pool.request();
    const query = `UPDATE users SET isDeleted = 0, updatedAt = @updatedAt WHERE id = @id`;
    await request
      .input('id', sql.Int, id)
      .input('updatedAt', sql.DateTime, new Date())
      .query(query);
    return true;
  } catch (error) {
    throw new Error('Lỗi khi phục hồi người dùng: ' + error.message);
  }
}

/**
 * Cập nhật thời gian đăng nhập của người dùng
 * @param {number} id - ID của người dùng
 * @returns {Promise<boolean>} Kết quả cập nhật
 */
async function updateLoginTime(id) {
  try {
    await connectToDatabase();
    await pool.request()
      .input('id', sql.Int, id)
      .input('updatedAt', sql.DateTime, new Date())
      .query('UPDATE users SET updatedAt = @updatedAt WHERE id = @id AND isDeleted = 0');
    return true;
  } catch (error) {
    throw new Error('Could not update login time: ' + error.message);
  }
}

module.exports = {
  getAllUsers,
  getUserById,
  getUserByEmail,
  createUser,
  updateUser,
  deleteUser,
  softDeleteUser,
  restoreUser,
  updateLoginTime
}; 