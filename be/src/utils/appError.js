/**
 * Lớp AppError để xử lý lỗi ứng dụng
 * @extends Error
 */
class AppError extends Error {
  /**
   * Tạo một đối tượng lỗi mới
   * @param {string} message - Thông báo lỗi
   * @param {number} statusCode - Mã trạng thái HTTP
   */
  constructor(message, statusCode) {
    super(message);
    
    this.statusCode = statusCode;
    this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
    this.isOperational = true;
    
    Error.captureStackTrace(this, this.constructor);
  }
}

module.exports = AppError; 