const AppError = require('../utils/appError');

/**
 * Xử lý lỗi truy vấn cơ sở dữ liệu
 */
const handleDatabaseError = (err) => {
  console.error('Database Error:', err);
  const message = `Lỗi cơ sở dữ liệu: ${err.message || 'Không xác định'}`;
  return new AppError(message, 500);
};

/**
 * Xử lý lỗi khi JWT không hợp lệ
 */
const handleJWTError = () => new AppError('Token không hợp lệ. Vui lòng đăng nhập lại!', 401);

/**
 * Xử lý lỗi khi JWT hết hạn
 */
const handleJWTExpiredError = () => new AppError('Token đã hết hạn! Vui lòng đăng nhập lại.', 401);

/**
 * Gửi lỗi trong môi trường phát triển với thông tin chi tiết
 */
const sendErrorDev = (err, res) => {
  res.status(err.statusCode).json({
    status: err.status,
    error: err,
    message: err.message,
    stack: err.stack
  });
};

/**
 * Gửi lỗi trong môi trường sản xuất với thông tin giới hạn
 */
const sendErrorProd = (err, res) => {
  // Lỗi hoạt động, gửi thông báo cho client
  if (err.isOperational) {
    res.status(err.statusCode).json({
      status: err.status,
      message: err.message
    });
  } 
  // Lỗi lập trình hoặc lỗi không xác định, không rò rỉ chi tiết
  else {
    // Ghi log lỗi
    console.error('LỖI 💥', err);

    // Gửi thông báo chung
    res.status(500).json({
      status: 'error',
      message: 'Đã xảy ra lỗi ! => ' + err.message
    });
  }
};

/**
 * Middleware xử lý lỗi toàn cục
 */
module.exports = (err, req, res, next) => {
  err.statusCode = err.statusCode || 500;
  err.status = err.status || 'error';

  if (process.env.NODE_ENV === 'development') {
    sendErrorDev(err, res);
  } else if (process.env.NODE_ENV === 'production') {
    let error = { ...err };
    error.message = err.message;

    // Xử lý các loại lỗi cụ thể
    if (error.name === 'JsonWebTokenError') error = handleJWTError();
    if (error.name === 'TokenExpiredError') error = handleJWTExpiredError();
    
    // Xử lý các lỗi cơ sở dữ liệu
    if (error.code === 'EREQUEST' || error.code === 'ESOCKET' || 
        error.code === 'ECONNRESET' || error.code === 'ETIMEOUT' || 
        error.code === 'ELOGIN' || error.sqlState) {
      error = handleDatabaseError(error);
    }

    sendErrorProd(error, res);
  }

  // Đảm bảo response luôn được gửi
  if (!res.headersSent) {
    res.status(500).json({
      status: 'error',
      message: 'Lỗi không xác định'
    });
  }
}; 