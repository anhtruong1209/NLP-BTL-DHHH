const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const xss = require('xss-clean');
const hpp = require('hpp');
const cookieParser = require('cookie-parser');
const path = require('path');
const multer = require('multer');
const fs = require('fs');

const AppError = require('./utils/appError');
const errorHandler = require('./middleware/error.middleware');
const authMiddleware = require('./middleware/auth.middleware');
const { initializeDatabase } = require('./config/db-init');

// Import routes
const authRoutes = require('./routes/auth.routes');
const userRoutes = require('./routes/user.routes');
const categoryRoutes = require('./routes/category.routes');
const toolRoutes = require('./routes/tool.routes');
const chatRoutes = require('./routes/chat.routes');
const adminRoutes = require('./routes/admin.routes');
const apiKeyRoutes = require('./routes/api-key.routes');
const courseRoutes = require('./routes/course.routes');
const courseDetailRoutes = require('./routes/course-detail.routes');
const logRoutes = require('./routes/log.routes');
const approvalRoutes = require('./routes/approval.routes');
const bannerRoutes = require('./routes/banner.routes');

const app = express();

// Khởi tạo cấu trúc database khi ứng dụng khởi động
initializeDatabase().catch(err => {
  console.error('Failed to initialize database structure:', err);
});

// Quan trọng: Đặt 'trust proxy' nếu ứng dụng của bạn chạy sau proxy (ví dụ: Nginx, IIS, Heroku, v.v.)
// Điều này giúp express-rate-limit và các middleware khác xác định đúng IP của người dùng.
app.set('trust proxy', 1);

// 1) GLOBAL MIDDLEWARES
// Set security HTTP headers - ĐẢM BẢO CHỈ CÓ MỘT CẤU HÌNH HELMET NHƯ BÊN DƯỚI
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        "default-src": ["*", "'self'", "'unsafe-inline'", "'unsafe-eval'", "data:", "blob:"],
        "script-src": ["*", "'self'", "'unsafe-inline'", "'unsafe-eval'"], 
        "style-src": ["*", "'self'", "'unsafe-inline'"],
        "img-src": ["*", "'self'", "data:", "blob:"],
        "connect-src": ["*", "'self'"],
        "font-src": ["*", "'self'", "data:"],
        "object-src": ["*", "'self'"],
        "frame-src": ["*", "'self'"],
        "worker-src": ["*", "'self'", "blob:"],
        "child-src": ["*", "'self'", "blob:"],
        "media-src": ["*", "'self'", "data:", "blob:"]
      },
    },
  })
);

// Serve static files (for other uploads, not banners)
app.use('/uploads', express.static(path.join(__dirname, '../public/uploads')));

// Tạo thư mục uploads nếu chưa tồn tại (for other uploads)
const uploadsDir = path.join(__dirname, '../public/uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Serve React frontend static files
app.use(express.static(path.join(__dirname, '../AI')));

// Development logging
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

// Body parser, reading data from body into req.body - tăng giới hạn để xử lý base64 images
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(cookieParser());

// Attach SSO access token from header if present

// Data sanitization against XSS
app.use(xss());

// Prevent parameter pollution
app.use(hpp({
  whitelist: [
    'category_id',
    'featured',
    'search',
    'limit',
    'sort'
  ]
}));

// CORS configuration - Allow all origins (reflect origin) with credentials
app.use(cors({
  origin: true,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin', 'X-SSO-Access-Token'],
  exposedHeaders: ['Content-Length', 'Content-Type', 'X-Requested-With', 'X-SSO-Access-Token']
}));

// Handle preflight requests globally
app.options('*', cors({
  origin: true,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin', 'X-SSO-Access-Token'],
  exposedHeaders: ['Content-Length', 'Content-Type', 'X-Requested-With', 'X-SSO-Access-Token']
}));

// Debug middleware để in ra request
app.use((req, res, next) => {
  
  // Debug request body cho login
  if (req.url.includes('/api/auth/login') || req.url.includes('/auth/login')) {
  }
  
  next();
});

// Thêm route test để kiểm tra kết nối
app.get('/api/test', (req, res) => {
  res.status(200).json({
    status: 'success',
    message: 'API kết nối thành công'
  });
});

// Thêm route debug cho auth
app.post('/api/auth/debug', (req, res) => {
  res.status(200).json({
    status: 'success',
    message: 'Auth debug route',
    body: req.body
  });
});

// Định nghĩa các API routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/tools', toolRoutes);
app.use('/api/chats', chatRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/api-keys', apiKeyRoutes);
app.use('/api/courses', courseRoutes);
app.use('/api/course-details', courseDetailRoutes);
app.use('/api/logs', logRoutes);
app.use('/api/approvals', approvalRoutes);
app.use('/api/banners', bannerRoutes);

// Alternative auth routes (không có tiền tố /api)
app.use('/auth', authRoutes);
// Serve React app for all non-API routes (SPA fallback)
app.get('*', (req, res, next) => {
  // Bỏ qua các route API, uploads, auth
  if (
    req.path.startsWith('/api/') ||
    req.path.startsWith('/auth/') ||
    req.path.startsWith('/uploads/')
  ) {
    return next();
  }
  // Trả về index.html của React app
  res.sendFile(path.join(__dirname, '../AI/index.html'));
});
// Middleware để bắt lỗi nếu không tìm thấy route - PHẢI ĐƯỢC ĐỊNH NGHĨA SAU TẤT CẢ ROUTES
app.all('*', (req, res, next) => {
  next(new AppError(`Không tìm thấy ${req.originalUrl} trên máy chủ này`, 404));
});

// Global error handler - Đây là middleware cuối cùng để xử lý tất cả lỗi
app.use(errorHandler);

module.exports = app; 