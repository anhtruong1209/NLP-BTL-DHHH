
// Import routes
const authRoutes = require('./routes/auth.routes');
const userRoutes = require('./routes/user.routes');
const toolRoutes = require('./routes/tool.routes');
const categoryRoutes = require('./routes/category.routes');
const chatRoutes = require('./routes/chat.routes'); // Thêm route chat
// ... existing code ...

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/tools', toolRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/chats', chatRoutes); // Thêm route chat

const path = require('path');

// Phục vụ các tệp tĩnh từ thư mục build của React
app.use(express.static(path.join(__dirname, '../../fe/build')));

// Định nghĩa tuyến đường "*" để xử lý tất cả các yêu cầu SPA
app.get('*', (req, res) => {
  // Nếu yêu cầu bắt đầu bằng /api thì trả về lỗi 404
  if (req.path.startsWith('/api')) {
    return res.status(404).json({
      status: 'fail',
      message: `Không thể tìm thấy ${req.path} trên server này!`
    });
  }
  
  // Phục vụ trang index.html cho tất cả các routes khác (cho SPA)
  res.sendFile(path.join(__dirname, '../../fe/build', 'index.html'));
});

// ... existing code ... 