const express = require('express');
const toolController = require('../controllers/tool.controller');
const { protect, restrictTo } = require('../middleware/auth.middleware');
const multer = require('multer');
const path = require('path');

// Cấu hình storage cho multer
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, path.join(__dirname, '../../public/uploads'));
  },
  filename: function (req, file, cb) {
    // Tạo tên file duy nhất với timestamp
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, file.fieldname + '-' + uniqueSuffix + ext);
  }
});

// Lọc file hợp lệ
const fileFilter = (req, file, cb) => {
  // Chỉ chấp nhận image files
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Chỉ cho phép tải lên file hình ảnh!'), false);
  }
};

// Cấu hình multer
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // giới hạn 5MB
  },
  fileFilter: fileFilter
});

// Xử lý upload và gán đường dẫn ảnh
const handleImageUpload = (req, res, next) => {
  upload.single('image')(req, res, (err) => {
    if (err) {
      return res.status(400).json({
        status: 'fail',
        message: err.message
      });
    }
    
    // Nếu có file upload, cập nhật đường dẫn ảnh
    if (req.file) {
      req.body.image = `/uploads/${req.file.filename}`;
    }
    
    
    next();
  });
};

const router = express.Router();

// Public routes
router.get('/', toolController.getAllTools);
router.get('/search', toolController.searchTools);
router.get('/by-category', toolController.getToolsByCategory);
router.get('/id/:id', toolController.getToolById);


// Protected routes (Admin only)
router.use(protect, restrictTo('admin'));

router.post('/:id/view', toolController.incrementViewCount);
router.post('/', handleImageUpload, toolController.createTool);
router.patch('/:id', handleImageUpload, toolController.updateTool);
router.delete('/:id', toolController.deleteTool);
router.put('/:id/soft-delete', toolController.softDeleteTool); 

module.exports = router; 