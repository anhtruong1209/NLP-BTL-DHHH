/**
 * @param {Object} res - Response object
 * @param {Error} error - Error object
 */
exports.handleApiError = (res, error) => {
  console.error('API Error:', error);
  
  const statusCode = error.response?.status || 500;
  const errorMessage = error.response?.data?.message || error.message || 'Internal Server Error';
  
  res.status(statusCode).json({
    success: false,
    message: errorMessage,
    error: process.env.NODE_ENV === 'development' ? error.stack : undefined
  });
}; 