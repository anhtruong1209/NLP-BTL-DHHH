/**
 * Bọc hàm xử lý route để bắt lỗi không đồng bộ
 * @param {Function} fn - Hàm xử lý route
 * @returns {Function} Hàm middleware Express với xử lý lỗi
 */
module.exports = fn => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}; 