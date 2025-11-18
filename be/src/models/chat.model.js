const { pool, sql } = require('../config/db');

/**
 * Lấy tất cả chat
 */
const getAllChats = async () => {
  try {
    const result = await pool.request()
      .query(`
        SELECT c.*, u.username as user_name
        FROM chats c
        LEFT JOIN users u ON c.user_id = u.id
        WHERE c.isDeleted = 0
      `);
    
    return result.recordset;
  } catch (error) {
    throw new Error('Could not fetch chats: ' + error.message);
  }
};

/**
 * Lấy chat theo ID
 */
const getChatById = async (id) => {
  try {
    const result = await pool.request()
      .input('id', sql.Int, id)
      .query(`
        SELECT c.*, u.username as user_name
        FROM chats c
        LEFT JOIN users u ON c.user_id = u.id
        WHERE c.id = @id AND c.isDeleted = 0
      `);
    
    return result.recordset[0];
  } catch (error) {
    throw new Error('Could not fetch chat: ' + error.message);
  }
};

/**
 * Lấy tất cả chat của một người dùng
 */
const getChatsByUserId = async (userId) => {
  try {
    const result = await pool.request()
      .input('userId', sql.Int, userId)
      .query(`
        SELECT c.*, u.username as user_name
        FROM chats c
        LEFT JOIN users u ON c.user_id = u.id
        WHERE c.user_id = @userId AND c.isDeleted = 0
        ORDER BY c.updatedAt DESC
      `);
    
    return result.recordset;
  } catch (error) {
    throw new Error('Could not fetch user chats: ' + error.message);
  }
};

/**
 * Tạo chat mới
 */
const createChat = async (data) => {
  try {
    
    const result = await pool.request()
      .input('userId', sql.Int, data.user_id)
      .input('title', sql.NVarChar, data.title || 'New Chat')
      .input('model', sql.NVarChar, data.model || 'gemini-2.0-flash')
      .input('isDeleted', sql.Bit, 0)  // Thêm trường isDeleted
      .input('createdAt', sql.DateTime, new Date())
      .input('updatedAt', sql.DateTime, new Date())
      .query(`
        INSERT INTO chats (user_id, title, model, isDeleted, createdAt, updatedAt)
        OUTPUT INSERTED.*
        VALUES (@userId, @title, @model, @isDeleted, @createdAt, @updatedAt)
      `);
    
    if (!result.recordset || result.recordset.length === 0) {
      throw new Error('No records returned after insert operation');
    }
    
    return result.recordset[0];
  } catch (error) {
    console.error('Error creating chat:', error);
    throw new Error('Could not create chat: ' + error.message);
  }
};

/**
 * Cập nhật chat
 */
const updateChat = async (id, data) => {
  try {
    const updates = [];
    const request = pool.request().input('id', sql.Int, id);

    if (data.title) {
      updates.push('title = @title');
      request.input('title', sql.NVarChar, data.title);
    }
    if (data.model) {
      updates.push('model = @model');
      request.input('model', sql.NVarChar, data.model);
    }

    updates.push('updatedAt = @updatedAt');
    request.input('updatedAt', sql.DateTime, new Date());

    const result = await request.query(`
      UPDATE chats 
      SET ${updates.join(', ')}
      OUTPUT INSERTED.*
      WHERE id = @id AND isDeleted = 0
    `);
    return result.recordset[0];
  } catch (error) {
    throw new Error('Could not update chat: ' + error.message);
  }
};

/**
 * Xóa mềm chat
 */
const deleteChat = async (id) => {
  try {
    await pool.request()
      .input('id', sql.Int, id)
      .input('updatedAt', sql.DateTime, new Date())
      .query('UPDATE chats SET isDeleted = 1, updatedAt = @updatedAt WHERE id = @id');
    
    return true;
  } catch (error) {
    throw new Error('Could not delete chat: ' + error.message);
  }
};

/**
 * Đếm số lượng chat của một người dùng
 */
const countChatsByUserId = async (userId) => {
  try {
    const result = await pool.request()
      .input('userId', sql.Int, userId)
      .query(`
        SELECT COUNT(*) as count
        FROM chats
        WHERE user_id = @userId AND isDeleted = 0
      `);
    return result.recordset[0].count;
  } catch (error) {
    throw new Error(`Error counting chats for user: ${error.message}`);
  }
};

module.exports = {
  getAllChats,
  createChat,
  getChatById,
  getChatsByUserId,
  updateChat,
  deleteChat,
  countChatsByUserId
};