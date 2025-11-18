const app = require('./app');
const dotenv = require('dotenv');
const path = require('path');

// Đọc cấu hình từ tệp .env
dotenv.config({ path: path.join(__dirname, '../.env') });

// Xử lý lỗi không bắt được trong toàn bộ ứng dụng
process.on('uncaughtException', (err) => {
  console.error('UNCAUGHT EXCEPTION! 💥 Shutting down...');
  console.error(err.name, err.message, err.stack);
  // Thoát ngay lập tức khi có lỗi ngoại lệ không xử lý được
  process.exit(1);
});

// Khởi động máy chủ
const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';

const server = app.listen(PORT, HOST, () => {
});

// Xử lý các promise bị từ chối không bắt được
process.on('unhandledRejection', (err) => {
  console.error('UNHANDLED REJECTION! 💥 Shutting down...');
  console.error(err.name, err.message, err.stack);
  // Đóng server an toàn trước khi thoát
  server.close(() => {
    process.exit(1);
  });
}); 