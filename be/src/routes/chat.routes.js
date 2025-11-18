const express = require('express');
const chatController = require('../controllers/chat.controller');
const authMiddleware = require('../middleware/auth.middleware');
const { pool } = require('../config/db');
const catchAsync = require('../utils/catchAsync');
const path = require('path');
const fs = require('fs');
const multer = require('multer');

const router = express.Router();

// Thêm route mới để xử lý phân tích hình ảnh
// Cấu hình upload cho route phân tích hình ảnh
const imageUpload = multer({
  storage: multer.diskStorage({
    destination: function (req, file, cb) {
      const uploadDir = path.join(__dirname, '../../uploads');
      fs.mkdirSync(uploadDir, { recursive: true });
      cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      const fileExt = path.extname(file.originalname);
      cb(null, 'image-' + uniqueSuffix + fileExt);
    }
  }),
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/') || file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Chỉ chấp nhận tệp hình ảnh và PDF'), false);
    }
  },
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  }
}).single('image');

// Diagnostic endpoint không cần xác thực
router.get('/diagnostic', catchAsync(async (req, res) => {
  try {
    // Kiểm tra kết nối DB
    await pool.connect();
    
    // Kiểm tra bảng chats
    const chatsResult = await pool.request().query(`
      SELECT TOP 5 * FROM chats ORDER BY id DESC
    `);
    
    // Kiểm tra bảng messages
    const messagesResult = await pool.request().query(`
      SELECT TOP 5 * FROM messages ORDER BY id DESC
    `);
    
    // Trả về thông tin chẩn đoán
    res.status(200).json({
      status: 'success',
      database_connected: true,
      tables: {
        chats: {
          count: chatsResult.recordset.length,
          latest: chatsResult.recordset.map(chat => ({
            id: chat.id,
            title: chat.title,
            createdAt: chat.createdAt
          }))
        },
        messages: {
          count: messagesResult.recordset.length,
          latest: messagesResult.recordset.map(msg => ({
            id: msg.id,
            chat_id: msg.chat_id,
            role: msg.role,
            createdAt: msg.createdAt
          }))
        }
      }
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Database diagnostic failed',
      error: error.message
    });
  }
}));

// Tất cả các routes còn lại yêu cầu xác thực
router.use(authMiddleware.protect);

// Lấy danh sách model AI có sẵn
router.get('/models/list', chatController.getAvailableModels);

// API endpoint xử lý tin nhắn AI với hỗ trợ upload file và base64
router.post('/process', (req, res, next) => {
  // Kiểm tra Content-Type để quyết định có sử dụng multer hay không
  const contentType = req.headers['content-type'] || '';
  
  if (contentType.includes('application/json')) {
    // Nếu là JSON request, bỏ qua multer middleware
    next();
  } else {
    // Nếu là FormData, sử dụng multer middleware
    chatController.uploadFiles(req, res, next);
  }
}, chatController.processAIMessage);

// Lấy tất cả chat của người dùng hiện tại
router.get('/my', chatController.getMyChats);

// Tạo chat mới
router.post('/', chatController.createChat);

// Xử lý chat theo ID
router.route('/:id')
  .get(chatController.getChatById)
  .patch(chatController.updateChat)
  .delete(chatController.deleteChat);

// Xử lý tin nhắn của một chat
router.route('/:id/messages')
  .get(chatController.getMessages)
  .post(chatController.createMessage)
  .delete(chatController.deleteAllMessages);

// Lấy answer của một message trong chat
router.get('/:id/messages/:messageId/answer', chatController.getMessageAnswer);

// Loại bỏ route để phân tích hình ảnh (không cần thiết nữa)

// Admin routes
router.use(authMiddleware.restrictTo('admin'));

// Lấy tất cả chat (chỉ admin)
router.get('/', chatController.getAllChats);

// Lấy chat theo công cụ AI (chỉ admin)
router.get('/tool/:toolId', chatController.getChatsByToolId);

module.exports = router;