const { pool } = require('../config/db');

class Message {
  /**
   * Tạo tin nhắn mới
   */
  static async createMessage(messageData) {
    try {
      // Validate attachments data
      if (messageData.attachments && typeof messageData.attachments !== 'string') {
        messageData.attachments = JSON.stringify(messageData.attachments);
      }
      
      const request = pool.request()
        .input('chat_id', messageData.chat_id)
        .input('role', messageData.role)
        .input('content', messageData.content)
        .input('tokens', messageData.tokens || 0)
        .input('attachments', messageData.attachments || null);
        
      const result = await request.query(`
        INSERT INTO messages (chat_id, role, content, tokens, attachments)
        OUTPUT INSERTED.*
        VALUES (@chat_id, @role, @content, @tokens, @attachments)
      `);
        
      if (result.recordset.length > 0) {
        return result.recordset[0];
      }
      return null;
    } catch (error) {
      console.error('Error creating message:', error);
      throw new Error(`Failed to create message: ${error.message}`);
    }
  }

  /**
   * Lấy tin nhắn theo ID
   */
  static async getMessageById(id) {
    try {
      const result = await pool.request()
        .input('id', id)
        .query(`SELECT * FROM messages WHERE id = @id`);
        
      if (result.recordset.length > 0) {
        const message = result.recordset[0];
        
        // Parse attachments if exists
        if (message.attachments) {
          try {
            message.attachments = JSON.parse(message.attachments);
          } catch (err) {
            console.warn('Failed to parse attachments JSON:', err);
          }
        }
        
        return message;
      }
      return null;
    } catch (error) {
      console.error('Error fetching message:', error);
      throw new Error(`Failed to fetch message: ${error.message}`);
    }
  }

  /**
   * Lấy tất cả tin nhắn của một chat
   */
  static async getMessagesByChatId(chatId) {
    try {
      const result = await pool.request()
        .input('chatId', chatId)
        .query(`SELECT * FROM messages WHERE chat_id = @chatId ORDER BY createdAt ASC`);
        
      // Parse attachments for each message if exists
      const messages = result.recordset;
      messages.forEach(message => {
        if (message.attachments) {
          try {
            message.attachments = JSON.parse(message.attachments);
          } catch (err) {
            console.warn(`Failed to parse attachments JSON for message ${message.id}:`, err);
          }
        }
      });
        
      return messages;
    } catch (error) {
      console.error('Error fetching messages:', error);
      throw new Error(`Failed to fetch messages: ${error.message}`);
    }
  }

  /**
   * Xóa tin nhắn theo ID
   */
  static async deleteMessage(id) {
    try {
      await pool.request()
        .input('id', id)
        .query(`DELETE FROM messages WHERE id = @id`);
      return true;
    } catch (error) {
      console.error('Error deleting message:', error);
      throw new Error(`Failed to delete message: ${error.message}`);
    }
  }

  /**
   * Xóa tất cả tin nhắn của một chat
   */
  static async deleteMessagesByChatId(chatId) {
    try {
      await pool.request()
        .input('chatId', chatId)
        .query(`DELETE FROM messages WHERE chat_id = @chatId`);
      return true;
    } catch (error) {
      console.error('Error deleting messages:', error);
      throw new Error(`Failed to delete messages: ${error.message}`);
    }
  }
}

module.exports = Message;