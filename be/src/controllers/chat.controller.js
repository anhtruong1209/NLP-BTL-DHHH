// Thêm thư viện multer để xử lý file upload
const multer = require('multer');
const fs = require('fs-extra');
const path = require('path');
const Chat = require('../models/chat.model');
const Message = require('../models/message.model');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');
const { pool } = require('../config/db');
const sql = require('mssql');
const Log = require('../models/log.model');
const { optimizeConversationContext, createGeminiSystemPrompt } = require('../utils/helpers');

// Cấu hình lưu trữ file upload
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(__dirname, '../../uploads');
    // Kiểm tra và tạo thư mục nếu chưa tồn tại
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    // Tạo tên file duy nhất để tránh trùng lặp
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const fileExt = path.extname(file.originalname);
    cb(null, uniqueSuffix + fileExt);
  }
});

// Lọc loại file được phép upload
const fileFilter = (req, file, cb) => {
  // Danh sách các loại file được phép
  const allowedTypes = [
    'image/jpeg', 'image/png', 'image/gif', 'image/webp',
    'application/pdf'
  ];
  
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new AppError(`Không hỗ trợ định dạng file: ${file.mimetype}. Chỉ chấp nhận hình ảnh và PDF.`, 400), false);
  }
};

// Cấu hình upload
const upload = multer({ 
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // Giới hạn 10MB
  }
});

// Middleware xử lý upload nhiều file
exports.uploadFiles = upload.array('files', 5); // Tối đa 5 file

/**
 * Lấy tất cả chat
 */
exports.getAllChats = catchAsync(async (req, res) => {
  const chats = await Chat.getAllChats();
  res.status(200).json(chats);
});

/**
 * Lấy chat theo ID
 */
exports.getChatById = catchAsync(async (req, res, next) => {
  const chat = await Chat.getChatById(req.params.id);
  if (!chat) {
    return next(new AppError('Chat not found', 404));
  }
  // Check if user has permission to view this chat
  if (chat.user_id !== req.user.id && !req.user.isAdmin) {
    return next(new AppError('Not authorized to view this chat', 403));
  }
  res.status(200).json(chat);
});

/**
 * Lấy tất cả chat của người dùng hiện tại
 */
exports.getMyChats = catchAsync(async (req, res) => {
  const chats = await Chat.getChatsByUserId(req.user.id);
  res.status(200).json(chats);
});

/**
 * Lấy tất cả chat của một công cụ AI
 */
exports.getChatsByToolId = catchAsync(async (req, res, next) => {
  // Only admin can view all chats of a tool
  if (!req.user.isAdmin) {
    return next(new AppError('Not authorized to perform this action', 403));
  }
  
  const chats = await Chat.getChatsByToolId(req.params.toolId);
  res.status(200).json(chats);
});

/**
 * Tạo chat mới
 */
exports.createChat = catchAsync(async (req, res) => {
  
  const chatData = {
    user_id: req.user.id,
    title: req.body.title || 'New Chat',
    model: req.body.model || 'gemini-2.0-flash'
  };
  
  const chat = await Chat.createChat(chatData);
  
  if (!chat || !chat.id) {
    console.error('Chat created but missing ID or invalid response:', chat);
    return res.status(500).json({
      status: 'error',
      message: 'Failed to create chat. Invalid response from database.'
    });
  }
  
  // Log tạo chat
  await Log.createLog({
    userId: req.user.id,
    action: 'CREATE',
    entityType: 'chat',
    entityId: chat.id,
    description: `Người dùng đã tạo cuộc trò chuyện mới: ${chat.title}`,
    newData: chat,
    ipAddress: req.ip,
    userAgent: req.headers['user-agent']
  });
  
  res.status(201).json({
    status: 'success',
    data: { chat }
  });
});

/**
 * Cập nhật chat
 */
exports.updateChat = catchAsync(async (req, res, next) => {
  const chat = await Chat.getChatById(req.params.id);
  if (!chat) {
    return next(new AppError('Chat not found', 404));
  }
  // Check if user has permission to update this chat
  if (chat.user_id !== req.user.id && !req.user.isAdmin) {
    return next(new AppError('Not authorized to update this chat', 403));
  }
  const updatedChat = await Chat.updateChat(req.params.id, req.body);
  // Log cập nhật chat
  await Log.createLog({
    userId: req.user.id,
    action: 'UPDATE',
    entityType: 'chat',
    entityId: chat.id,
    description: `Người dùng đã cập nhật cuộc trò chuyện: ${chat.title}`,
    oldData: chat,
    newData: updatedChat,
    ipAddress: req.ip,
    userAgent: req.headers['user-agent']
  });
  res.status(200).json(updatedChat);
});

/**
 * Xóa chat
 */
exports.deleteChat = catchAsync(async (req, res, next) => {
  const chat = await Chat.getChatById(req.params.id);
  if (!chat) {
    return next(new AppError('Chat not found', 404));
  }
  // Check if user has permission to delete this chat
  if (chat.user_id !== req.user.id && !req.user.isAdmin) {
    return next(new AppError('Not authorized to delete this chat', 403));
  }
  await Chat.deleteChat(req.params.id);
  // Log xóa chat
  await Log.createLog({
    userId: req.user.id,
    action: 'DELETE',
    entityType: 'chat',
    entityId: chat.id,
    description: `Người dùng đã xóa cuộc trò chuyện: ${chat.title}`,
    oldData: chat,
    ipAddress: req.ip,
    userAgent: req.headers['user-agent']
  });
  res.status(200).json({ message: 'Chat deleted successfully' });
});

/**
 * Lấy tất cả tin nhắn của một cuộc trò chuyện
 */
exports.getMessages = catchAsync(async (req, res, next) => {
  const chat = await Chat.getChatById(req.params.id);
  if (!chat) {
    return next(new AppError('Chat not found', 404));
  }
  // Check if user has permission to view messages
  if (chat.user_id !== req.user.id && !req.user.isAdmin) {
    return next(new AppError('Not authorized to view these messages', 403));
  }
  const messages = await Message.getMessagesByChatId(req.params.id);
  res.status(200).json(messages);
});

/**
 * Xử lý tin nhắn với AI - Giống Gemini
 */
exports.processAIMessage = catchAsync(async (req, res, next) => {
  
  const message = req.body.message || '';
  let model = req.body.model || 'gemini-2.5-flash';
  
  // Lấy cờ bật/tắt Google Search từ request
  let useGoogleSearch = true; // Mặc định là bật
  if (req.body.useGoogleSearch !== undefined) {
    // Chuyển đổi từ string sang boolean nếu cần
    useGoogleSearch = req.body.useGoogleSearch === 'true' || req.body.useGoogleSearch === true;
  }
  
  // Parse history from request if provided
  let conversationHistory = [];
  if (req.body.history && Array.isArray(req.body.history)) {
    conversationHistory = req.body.history.filter(msg => 
      msg && typeof msg === 'object' && msg.role && msg.content
    );
  }
  
  // Kiểm tra và chuyển đổi apiKeyId sang số nếu có
  let apiKeyId = null;
  if (req.body.apiKeyId) {
    try {
      // Nếu apiKeyId là chuỗi số, chuyển đổi thành số
      if (/^\d+$/.test(req.body.apiKeyId)) {
        apiKeyId = parseInt(req.body.apiKeyId, 10);
      } else {
        // Nếu apiKeyId là tên model, tìm ID tương ứng hoặc sử dụng mặc định
        apiKeyId = null; // Sẽ sử dụng model để tìm API key phù hợp
      }
    } catch (error) {
      console.error(`Error parsing apiKeyId: ${req.body.apiKeyId}`, error);
      apiKeyId = null;
    }
  }
  
  // Xử lý file uploads và base64 attachments nếu có
  const attachments = [];
  const fileContents = [];
  
  // Xử lý base64 attachments từ frontend
  if (req.body.attachments && Array.isArray(req.body.attachments)) {
    for (const attachment of req.body.attachments) {
      if (attachment.base64) {
        // Thêm thông tin file vào attachments
        const attachmentInfo = {
          filename: attachment.filename || attachment.name,
          originalname: attachment.originalname || attachment.name,
          mimetype: attachment.type,
          size: attachment.size,
          base64: attachment.base64
        };
        attachments.push(attachmentInfo);
        
        // Xử lý base64 data cho AI
        try {
          if (attachment.type && attachment.type.includes('image/')) {
            // Loại bỏ data:image/...;base64, prefix nếu có
            const base64Data = attachment.base64.replace(/^data:image\/[a-z]+;base64,/, '');
            fileContents.push({
              type: 'image',
              data: base64Data,
              mimeType: attachment.type
            });
          } else if (attachment.type && attachment.type.includes('application/pdf')) {
            // Loại bỏ data:application/pdf;base64, prefix nếu có
            const base64Data = attachment.base64.replace(/^data:application\/pdf;base64,/, '');
            fileContents.push({
              type: 'pdf',
              data: base64Data,
              mimeType: attachment.type,
              name: attachment.originalname || attachment.name
            });
          }
        } catch (error) {
          console.error(`Error processing base64 attachment ${attachment.name}:`, error);
        }
      }
    }
  }
  
  // Xử lý file uploads nếu có
  if (req.files && req.files.length > 0) {
    for (const file of req.files) {
      // Thêm thông tin file vào attachments
      const attachment = {
        filename: file.filename,
        originalname: file.originalname,
        mimetype: file.mimetype,
        size: file.size,
        path: file.path
      };
      attachments.push(attachment);
      
      // Đọc nội dung file nếu là các định dạng hỗ trợ
      try {
        if (file.mimetype.includes('image/')) {
          // File hình ảnh - chuyển thành base64 để gửi cho Gemini
          const fileData = fs.readFileSync(file.path);
          const base64Data = fileData.toString('base64');
          fileContents.push({
            type: 'image',
            data: base64Data,
            mimeType: file.mimetype
          });
        } 
        else if (file.mimetype.includes('application/pdf')) {
          // Xử lý PDF files - chuyển thành base64 để gửi cho Gemini
          const fileData = fs.readFileSync(file.path);
          const base64Data = fileData.toString('base64');
          fileContents.push({
            type: 'pdf',
            data: base64Data,
            mimeType: file.mimetype,
            name: file.originalname
          });
        }
        else if (file.mimetype.includes('text/') || 
                file.mimetype.includes('application/msword') ||
                file.mimetype.includes('application/vnd.openxmlformats-officedocument.wordprocessingml.document')) {
          // Xử lý các file văn bản và Word
          // Với Word cần các thư viện bổ sung để trích xuất text
          fileContents.push({
            type: 'document',
            name: file.originalname,
            mimeType: file.mimetype
          });
        }
      } catch (error) {
        console.error(`Error reading file ${file.originalname}:`, error);
      }
    }
  }
  
  // Kiểm tra xem có chatId không để xác định đây là trò chuyện mới hay tiếp tục
  let chatId = null;
  if (req.body.chatId) {
    // Đảm bảo chatId là số hợp lệ
    try {
      // Kiểm tra và chuyển đổi sang số
      chatId = parseInt(req.body.chatId, 10);
      
      // Kiểm tra nếu kết quả không phải là một số hợp lệ
      if (isNaN(chatId) || !Number.isInteger(chatId) || chatId <= 0) {
        chatId = null;
      } else {
      }
    } catch (error) {
      console.error(`Error parsing chatId: ${req.body.chatId}`, error);
      chatId = null;
    }
  }
  
  let chat;
  let chatMessages = [];
  
  try {
    // Nếu có chatId, lấy chat hiện có và kiểm tra quyền
    if (chatId) {
      try {
        chat = await Chat.getChatById(chatId);
        if (!chat) {
          console.warn(`Chat not found with ID: ${chatId}`);
          return next(new AppError('Chat not found', 404));
        }
        
        if (chat.user_id !== req.user.id && !req.user.isAdmin) {
          console.warn(`Unauthorized access to chat ${chatId} by user ${req.user.id}`);
          return next(new AppError('Not authorized to access this chat', 403));
        }
        
        // Lấy tin nhắn hiện có của chat này
        try {
          chatMessages = await Message.getMessagesByChatId(chatId);
        } catch (messagesError) {
          console.error(`Error loading messages for chat ${chatId}:`, messagesError);
          // Tiếp tục với mảng rỗng nếu không thể lấy được tin nhắn
          chatMessages = [];
        }
      } catch (chatError) {
        console.error(`Error getting chat ${chatId}:`, chatError);
        // Tạo chat mới thay vì lỗi
        chatId = null;
      }
    }
    
    // Nếu không có chatId hoặc xảy ra lỗi khi lấy chat, tạo mới
    if (!chatId) {
      // Tạo chat mới
      const chatData = {
        user_id: req.user.id,
        title: req.body.title || (message.length > 0 ? 
          // Sử dụng nội dung tin nhắn làm tiêu đề, giới hạn 50 ký tự
          (message.length > 50 ? message.substring(0, 50) + '...' : message) : 
          `Trò chuyện ${new Date().toLocaleDateString('vi-VN')}`),
        model
      };
      
      chat = await Chat.createChat(chatData);
    }
    
    // Lưu tin nhắn của người dùng, bao gồm thông tin về tệp đính kèm
    const userMessageData = {
      chat_id: chat.id,
      role: 'user',
      content: message,
      tokens: Math.ceil(message.length / 4), // Ước tính tokens
      attachments: attachments.length > 0 ? JSON.stringify(attachments) : null
    };
    
    const savedUserMessage = await Message.createMessage(userMessageData);
    
    // Xử lý câu trả lời AI
    // Chuẩn bị dữ liệu cho API Gemini với định dạng phù hợp
    let geminiPrompt = message;
    let parts = [];
    
    // Kiểm tra nếu có file PDF, thêm hướng dẫn cụ thể cho AI
    const hasPDF = fileContents.some(f => f.type === 'pdf');
    if (hasPDF) {
      // Kiểm tra kích thước dữ liệu PDF
      const pdfFilesData = fileContents.filter(f => f.type === 'pdf');
      const totalPDFSize = pdfFilesData.reduce((total, file) => total + (file.data ? file.data.length : 0), 0);
      
      // Nếu PDF quá lớn, thêm cảnh báo
      const isLargePDF = totalPDFSize > 10000000; // Khoảng 1MB base64 data
      
      if (!geminiPrompt || geminiPrompt.trim() === '') {
        // Nếu người dùng không nhập prompt cụ thể, tạo một prompt mặc định
        geminiPrompt = "Hãy phân tích và tóm tắt nội dung chính của tài liệu PDF này. Trình bày các điểm quan trọng nhất và cung cấp tổng quan về nội dung.";
      }
      
      // Thêm hướng dẫn chi tiết cho AI về cách xử lý PDF
      const pdfInstructions = `
Đây là một tài liệu PDF cần được phân tích. Hãy thực hiện các bước sau:
1. Xác định tiêu đề và chủ đề chính của tài liệu
2. Tóm tắt các điểm chính và thông tin quan trọng
3. Trình bày nội dung một cách có cấu trúc và dễ hiểu
4. Nếu có bảng, biểu đồ hoặc hình ảnh, hãy mô tả thông tin chúng cung cấp
5. Kết luận với những điểm quan trọng nhất

Phản hồi của bạn nên có cấu trúc rõ ràng với các đề mục và đoạn văn ngắn gọn, dễ đọc.
${isLargePDF ? "\nLƯU Ý: Đây là tài liệu lớn. Nếu không thể xử lý toàn bộ, hãy tập trung vào phần đầu và tóm tắt tổng quan." : ""}
`;
      geminiPrompt = pdfInstructions + "\n\nYêu cầu cụ thể: " + geminiPrompt;
      
      // Nếu PDF quá lớn, thêm thông báo cho người dùng
      if (isLargePDF) {
      }
    }
    
    // Thêm nội dung văn bản
    if (message) {
      parts.push({ text: geminiPrompt });
    } else if (hasPDF) {
      // Nếu không có message nhưng có PDF, sử dụng prompt mặc định
      parts.push({ text: geminiPrompt });
    }
    
    // Thêm hình ảnh và PDF nếu có
    for (const fileContent of fileContents) {
      if (fileContent.type === 'image') {
        parts.push({
          inlineData: {
            mimeType: fileContent.mimeType,
            data: fileContent.data
          }
        });
      } else if (fileContent.type === 'pdf') {
        parts.push({
          inlineData: {
            mimeType: fileContent.mimeType,
            data: fileContent.data
          }
        });
      } else if (fileContent.type === 'document') {
        // Nếu là tài liệu khác, thêm thông tin về tài liệu vào prompt
        geminiPrompt += `\n\nĐã đính kèm tệp: ${fileContent.name} (${fileContent.mimeType})`;
      }
    }
    
    // Thêm thông tin về tệp đính kèm vào nội dung để AI có thể biết
    if (attachments.length > 0 && !parts.find(p => p.inlineData || p.fileData)) {
      const fileDetails = attachments.map(a => `${a.originalname} (${(a.size/1024).toFixed(2)} KB, ${a.mimetype})`).join('\n');
      geminiPrompt += `\n\n[Tệp đính kèm:\n${fileDetails}]`;
    }
    
    // Chuẩn bị lịch sử cuộc trò chuyện cho context
    // Ưu tiên lịch sử từ frontend nếu có
    let aiContext = [];
    
    if (conversationHistory && conversationHistory.length > 0) {
      // Sử dụng lịch sử từ frontend
      aiContext = conversationHistory;
    } else if (chatMessages && chatMessages.length > 0) {
      // Sử dụng lịch sử từ database
      aiContext = chatMessages.map(msg => ({ 
        role: msg.role, 
        content: msg.content 
      }));
    }
    
    // Tối ưu hóa lịch sử trò chuyện để không vượt quá giới hạn token
    const optimizedContext = optimizeConversationContext(aiContext, {
      maxMessages: 20,
      maxTokens: 6000,
      alwaysKeepLatest: 4
    });
    
    // Gọi Gemini API với endpoint và cấu trúc mới nhất
    let aiResponse;
    try {
      // Lấy API key từ bảng api_keys trong database
      let apiKey;
      
      if (apiKeyId) {
        try {
          // If an apiKeyId is provided as a number, use it to get the API key
          const apiKeyResult = await pool.request()
            .input('id', sql.Int, apiKeyId)
            .query(`
              SELECT api_key, model
              FROM api_keys 
              WHERE id = @id AND is_active = 1 AND isDeleted = 0
            `);
          
          if (apiKeyResult.recordset && apiKeyResult.recordset.length > 0) {
            apiKey = apiKeyResult.recordset[0].api_key;
            
            // Lấy model từ API key nếu cần
            if (apiKeyResult.recordset[0].model) {
              model = apiKeyResult.recordset[0].model;
            }
            
            // Update usage count for the API key
            await pool.request()
              .input('id', sql.Int, apiKeyId)
              .input('lastUsed', sql.DateTime, new Date())
              .query(`
                UPDATE api_keys 
                SET usage_count = ISNULL(usage_count, 0) + 1, 
                    last_used = @lastUsed 
                WHERE id = @id
              `);
              
          } else {
            console.warn(`No API key found for ID: ${apiKeyId}, falling back to model search`);
          }
        } catch (error) {
          console.error(`Error retrieving API key for ID ${apiKeyId}:`, error);
          // Continue to find key by model
        }
      }
      
      // If no apiKeyId provided or no key found, fall back to the model search
      if (!apiKey) {
        try {
          const apiKeyResult = await pool.request()
            .input('model', sql.NVarChar, model)
            .query(`
              SELECT TOP 1 id, api_key 
              FROM api_keys 
              WHERE model = @model AND is_active = 1 AND isDeleted = 0
            `);
          
          if (apiKeyResult.recordset && apiKeyResult.recordset.length > 0) {
            apiKey = apiKeyResult.recordset[0].api_key;
            
            // Update usage count for the API key
            if (apiKeyResult.recordset[0].id) {
              await pool.request()
                .input('id', sql.Int, apiKeyResult.recordset[0].id)
                .input('lastUsed', sql.DateTime, new Date())
                .query(`
                  UPDATE api_keys 
                  SET usage_count = ISNULL(usage_count, 0) + 1, 
                      last_used = @lastUsed 
                  WHERE id = @id
                `);
                
            }
          } else {
            console.warn(`No API key found for model: ${model}`);
          }
        } catch (error) {
          console.error(`Error retrieving API key for model ${model}:`, error);
        }
      }
      
      if (!apiKey) {
        console.error(`No active API key found for the specified model (${model}) or ID (${apiKeyId})`);
        throw new Error('Không tìm thấy API key hoạt động cho model được chỉ định');
      }

      // Chuẩn bị dữ liệu cho Gemini API
      let geminiPayload;
      
      // Tạo system prompt với cấu hình phù hợp
      const systemPrompt = createGeminiSystemPrompt({
        contextLength: 'long',
        personality: 'expert', 
        domain: 'maritime',
        useGoogleSearch: useGoogleSearch // Truyền cờ useGoogleSearch vào prompt
      });
      
      // Chuẩn bị tin nhắn từ lịch sử trò chuyện
      const geminiMessages = [
        // Thêm system prompt vào đầu để hướng dẫn AI
        systemPrompt
      ];
      
      // Thêm lịch sử trò chuyện đã được tối ưu
      if (optimizedContext.length > 0) {
        geminiMessages.push(
          ...optimizedContext.map(msg => ({
            role: msg.role === 'assistant' ? 'model' : 
                 msg.role === 'system' ? 'model' : 'user',
            parts: [{ text: msg.content }]
          }))
        );
      }
      
      // Mapping model của chúng ta sang model ID của Gemini API (theo tài liệu mới nhất)
      const modelMapping = {
        'gemini-2.5-flash': 'gemini-2.5-flash',
        'gemini-1.5-flash': 'gemini-1.5-flash',
        'gemini-1.5-pro': 'gemini-1.5-pro',
        'gemini-2.0-flash': 'gemini-2.0-flash-exp',
        'gemini-2.5-pro': 'gemini-2.5-pro-exp'
      };

      // Nếu người dùng bật Google Search, ưu tiên sử dụng model Pro nếu có thể
      if (useGoogleSearch) {
        // Nếu đang dùng Flash model, chuyển sang Pro tương ứng nếu có thể
        if (model === 'gemini-2.0-flash') {
          model = 'gemini-2.5-pro';  // Sử dụng model mạnh nhất cho Google Search
        } else if (model === 'gemini-2.5-flash') {
          model = 'gemini-2.5-pro';
        } else if (model === 'gemini-1.5-flash') {
          model = 'gemini-1.5-pro';
        }
      }

      const geminiModel = modelMapping[model] || 'gemini-2.5-flash'; // Mặc định dùng model mới nhất
      
      // Log thông tin debug
      console.log('Using model:', model, '-> mapped to:', geminiModel);
      console.log('API Key ID:', apiKeyId, 'API Key (first 10 chars):', apiKey.substring(0, 10) + '...');
      
      // Kiểm tra nếu có hình ảnh hoặc PDF, sử dụng endpoint generateContent
      if (fileContents.some(f => f.type === 'image' || f.type === 'pdf')) {
        // Log số lượng file theo loại
        const imageCount = fileContents.filter(f => f.type === 'image').length;
        const pdfCount = fileContents.filter(f => f.type === 'pdf').length;
        
        // Tạo yêu cầu multimodal với cả hình ảnh, PDF và văn bản
        geminiPayload = {
          contents: [
            {
              role: "user",
              parts: parts
            }
          ],
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 100000,
            topP: 0.95,
            topK: 40
          }
        };
        
        // Thêm Google Search tool nếu không có file PDF và useGoogleSearch = true
        if (pdfCount === 0 && useGoogleSearch) {
          const { createGoogleSearchTool } = require('../utils/helpers');
          const searchTool = createGoogleSearchTool({ enableSearch: true });
          if (searchTool) {
            if (!geminiPayload.tools) {
              geminiPayload.tools = [];
            }
            geminiPayload.tools.push(searchTool);
          }
        }
        
        // Gọi API generateContent thay vì chat
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent?key=${apiKey}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(geminiPayload),
        });
        
        if (!response.ok) {
          const errorData = await response.json();
          console.error('Gemini API error:', errorData);
          
          // Kiểm tra lỗi cụ thể với model
          if (errorData.error?.message?.includes('not found for API version') || 
              errorData.error?.message?.includes('not supported for generateContent')) {
            throw new Error(`Model không khả dụng: ${geminiModel}. Vui lòng chọn model khác.`);
          }
          
          // Kiểm tra lỗi cụ thể với PDF
          if (pdfCount > 0 && errorData.error?.message?.includes('pdf')) {
            throw new Error(`Lỗi xử lý PDF: ${errorData.error?.message || 'Không thể xử lý file PDF'}`);
          } else {
            throw new Error(`Gemini API error: ${errorData.error?.message || 'Unknown error'}`);
          }
        }
        
        const data = await response.json();
        aiResponse = data;
      } else {
        // Sử dụng API thông thường với tin nhắn văn bản
        // Thêm tin nhắn hiện tại của người dùng
        geminiMessages.push({
          role: 'user',
          parts: [{ text: geminiPrompt }]
        });
        
        // Cấu hình tối ưu cho Gemini API
        geminiPayload = {
          contents: geminiMessages,
          generationConfig: {
            temperature: useGoogleSearch ? 0.2 : 0.7,  // Giảm temperature khi dùng Google Search
            maxOutputTokens: 8192,
            topP: useGoogleSearch ? 0.85 : 0.95,  // Điều chỉnh topP khi dùng Google Search
            topK: useGoogleSearch ? 30 : 40,  // Điều chỉnh topK khi dùng Google Search
            responseMimeType: "text/plain",
            stopSequences: []  // Không có stop sequence
          },
          safetySettings: [
            {
              category: "HARM_CATEGORY_HARASSMENT",
              threshold: "BLOCK_MEDIUM_AND_ABOVE"
            },
            {
              category: "HARM_CATEGORY_HATE_SPEECH",
              threshold: "BLOCK_MEDIUM_AND_ABOVE"
            },
            {
              category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
              threshold: "BLOCK_MEDIUM_AND_ABOVE"
            },
            {
              category: "HARM_CATEGORY_DANGEROUS_CONTENT",
              threshold: "BLOCK_MEDIUM_AND_ABOVE"
            }
          ]
        };
        
        // Thêm Google Search tool nếu useGoogleSearch = true
        if (useGoogleSearch) {
          const { createGoogleSearchTool } = require('../utils/helpers');
          const searchTool = createGoogleSearchTool({ enableSearch: true });
          if (searchTool) {
            if (!geminiPayload.tools) {
              geminiPayload.tools = [];
            }
            geminiPayload.tools.push(searchTool);
          }
        }
        
        // Gọi Gemini API với endpoint và cấu trúc mới nhất
        const maxRetries = 3;
        let retryCount = 0;
        let response;
        
        while (retryCount < maxRetries) {
          try {
            response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent?key=${apiKey}`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify(geminiPayload),
            });
            
            // Nếu API trả về lỗi overloaded, thử lại sau 10 giây
            if (!response.ok) {
              const error = await response.json();
              console.error('Gemini API error:', error);
              
              // Kiểm tra lỗi cụ thể với model
              if (error.error?.message?.includes('not found for API version') || 
                  error.error?.message?.includes('not supported for generateContent')) {
                throw new Error(`Model không khả dụng: ${geminiModel}. Vui lòng chọn model khác.`);
              }
              
              // Kiểm tra nếu là lỗi quá tải
              if (error.error && 
                 (error.error.code === 503 || 
                  error.error.message?.toLowerCase().includes('overloaded'))) {
                
                retryCount++;
                
                if (retryCount < maxRetries) {
                  
                  // Đợi 10 giây trước khi thử lại
                  await new Promise(resolve => setTimeout(resolve, 10000));
                  continue;
                } else {
                  throw new Error(`Model AI đang quá tải. Hệ thống đã thử lại ${maxRetries} lần nhưng không thành công. Vui lòng đợi một lát và thử lại sau.`);
                }
              }
              
              // Nếu không phải lỗi quá tải, ném lỗi như bình thường
              throw new Error(`Gemini API error: ${error.error?.message || 'Unknown error'}`);
            }
            
            // Nếu thành công, thoát khỏi vòng lặp
            break;
          } catch (fetchError) {
            // Nếu là lỗi mạng, thử lại
            if (fetchError.message.includes('fetch') || fetchError.message.includes('network')) {
              retryCount++;
              if (retryCount < maxRetries) {
                await new Promise(resolve => setTimeout(resolve, 10000));
                continue;
              }
            }
            
            // Nếu đã hết số lần thử hoặc không phải lỗi mạng, ném lỗi
            throw fetchError;
          }
        }
        
        // Kiểm tra phản hồi trước khi parse JSON
        const responseText = await response.text();
        
        if (!responseText || responseText.trim() === '') {
          throw new Error('Empty response text from API');
        }
        
        try {
          aiResponse = JSON.parse(responseText);
        } catch (parseError) {
          console.error('Error parsing JSON response:', parseError);
          throw new Error(`Error parsing response: ${parseError.message}`);
        }
        
        // Kiểm tra cấu trúc phản hồi
        if (!aiResponse || Object.keys(aiResponse).length === 0) {
          throw new Error('Invalid API response structure');
        }
      }
      
      
      let aiReplyContent = '';
      
      // Đếm số lượng file PDF để sử dụng trong phản hồi
      const pdfCount = fileContents.filter(f => f.type === 'pdf').length;
      
      // Trích xuất nội dung từ phản hồi
      if (aiResponse.candidates && aiResponse.candidates.length > 0) {
        const candidate = aiResponse.candidates[0];
        
        // Kiểm tra lý do kết thúc
        if (candidate.finishReason === "MAX_TOKENS") {
          console.warn("Gemini API hit token limit. Response may be incomplete.");
          // Thêm thông báo về việc đạt giới hạn token
          aiReplyContent = "**Lưu ý: Phản hồi có thể không đầy đủ do đạt giới hạn token.**\n\n";
        }
        
        if (candidate.content && candidate.content.parts && candidate.content.parts.length > 0) {
          // Đối với generateContent API
          aiReplyContent += candidate.content.parts.map(part => {
            if (part.text) return part.text;
            // Xử lý các loại nội dung khác nếu có
            return '';
          }).join('\n');
        } else if (candidate.content && candidate.content.role) {
          // Trường hợp content có role nhưng không có parts hoặc parts rỗng
          console.warn("API returned content with role but no parts or empty parts");
          aiReplyContent += "Tôi đã phân tích tài liệu của bạn nhưng không thể tạo phản hồi đầy đủ. ";
          aiReplyContent += "Điều này có thể do tài liệu quá dài hoặc phức tạp. ";
          aiReplyContent += "Vui lòng thử lại với một phần cụ thể của tài liệu hoặc đặt câu hỏi cụ thể về nội dung bạn quan tâm.";
        }
        
        // Kiểm tra và thêm thông tin trích dẫn từ Google Search nếu có
        if (candidate.groundingMetadata && candidate.groundingMetadata.groundingSegments) {
          const segments = candidate.groundingMetadata.groundingSegments;
          const sources = [];
          
          // Thu thập các nguồn tham khảo
          segments.forEach(segment => {
            if (segment.groundingParts && segment.groundingParts.length > 0) {
              segment.groundingParts.forEach(part => {
                if (part.googleSearchData) {
                  const source = {
                    title: part.googleSearchData.title,
                    url: part.googleSearchData.url,
                    snippet: part.googleSearchData.snippet || '',
                    publisher: part.googleSearchData.publisher || ''
                  };
                  
                  // Kiểm tra xem nguồn này đã được thêm chưa
                  if (!sources.some(s => s.url === source.url)) {
                    sources.push(source);
                  }
                }
              });
            }
          });
          
          // Thêm nguồn tham khảo vào phản hồi nếu có
          if (sources.length > 0) {
            aiReplyContent += "\n\n**Nguồn tham khảo:**\n";
            sources.forEach((source, index) => {
              // Thêm snippet nếu có
              if (source.snippet) {
                aiReplyContent += `${index + 1}. [${source.title}](${source.url})`;
                if (source.publisher) {
                  aiReplyContent += ` - ${source.publisher}`;
                }
                aiReplyContent += `\n   > ${source.snippet.substring(0, 150)}${source.snippet.length > 150 ? '...' : ''}\n\n`;
              } else {
                aiReplyContent += `${index + 1}. [${source.title}](${source.url})`;
                if (source.publisher) {
                  aiReplyContent += ` - ${source.publisher}`;
                }
                aiReplyContent += '\n\n';
              }
            });
            
            // Thêm ghi chú về việc sử dụng Google Search
            aiReplyContent += "\n*Thông tin được cung cấp bởi Google Search.*";
          }
        }
      } else if (aiResponse.content && aiResponse.content.parts) {
        // Format thay thế có thể có
        aiReplyContent = aiResponse.content.parts
          .filter(part => part.text)
          .map(part => part.text)
          .join('\n');
      }
      
      // Nếu có PDF, thêm thông tin vào phản hồi
      if (pdfCount > 0 && !aiReplyContent.includes('PDF')) {
        const pdfFiles = fileContents.filter(f => f.type === 'pdf').map(f => f.name).join(', ');
        aiReplyContent = `**Phân tích từ ${pdfCount} file PDF (${pdfFiles}):**\n\n${aiReplyContent}`;
      }
      
      if (!aiReplyContent || aiReplyContent.trim() === '') {
        // Xử lý trường hợp phản hồi trống từ Gemini
        console.warn('Empty response received from Gemini API');
        
        // Kiểm tra nếu có thông tin về token count
        if (aiResponse.usageMetadata && aiResponse.usageMetadata.promptTokenCount) {
          const promptTokens = aiResponse.usageMetadata.promptTokenCount;
          
          if (promptTokens > 4000) {
            aiReplyContent = "Tài liệu của bạn khá dài và phức tạp. Tôi không thể xử lý toàn bộ nội dung. Vui lòng thử lại với một phần cụ thể của tài liệu hoặc đặt câu hỏi cụ thể về nội dung bạn quan tâm.";
          } else {
            aiReplyContent = "Xin lỗi, tôi không thể xử lý yêu cầu của bạn lúc này. Vui lòng thử lại sau hoặc điều chỉnh yêu cầu của bạn.";
          }
        } else {
          aiReplyContent = "Xin lỗi, tôi không thể xử lý yêu cầu của bạn lúc này. Vui lòng thử lại sau hoặc điều chỉnh yêu cầu của bạn.";
        }
      }
      
      // Lưu tin nhắn của AI
      const aiMessageData = {
        chat_id: chat.id,
        role: 'assistant',
        content: aiReplyContent,
        tokens: Math.ceil(aiReplyContent.length / 4) // Ước tính tokens
      };
      
      const savedAiMessage = await Message.createMessage(aiMessageData);
      
      // Log gửi message AI (user -> AI)
      await Log.createLog({
        userId: req.user.id,
        action: 'CREATE',
        entityType: 'message',
        entityId: savedUserMessage.id,
        description: `Người dùng đã gửi tin nhắn AI trong chat #${chat.id}`,
        newData: {
          chatId: chat.id,
          userMessage: savedUserMessage,
          aiMessage: savedAiMessage,
          model,
          attachments: attachments.length > 0 ? attachments : undefined
        },
        ipAddress: req.ip,
        userAgent: req.headers['user-agent']
      });
      
      // Trả về kết quả cho client
      res.status(200).json({
        status: 'success',
        data: {
          chat: chat,
          userMessage: savedUserMessage,
          aiMessage: savedAiMessage
        }
      });
      
    } catch (error) {
      console.error('Error processing AI message:', error);
      return next(new AppError(`Error processing message: ${error.message}`, 500));
    }
  } catch (error) {
    console.error('Error in chat processing:', error);
    return next(new AppError(`Error in chat processing: ${error.message}`, 500));
  }
});

/**
 * Tạo tin nhắn mới
 */
exports.createMessage = catchAsync(async (req, res, next) => {
  // Validate that chatId is an integer
  const chatId = parseInt(req.params.id);
  if (isNaN(chatId)) {
    console.error('Invalid chat ID format:', req.params.id);
    return next(new AppError('Invalid chat ID format', 400));
  }
  
  // Check if chat exists
  const chat = await Chat.getChatById(chatId);
  if (!chat) {
    console.error(`Chat not found with ID: ${chatId}`);
    return next(new AppError('Chat not found', 404));
  }
  
  // Check if user has permission to add messages
  if (chat.user_id !== req.user.id && !req.user.isAdmin) {
    console.error(`User ${req.user.id} not authorized to add messages to chat ${chatId}`);
    return next(new AppError('Not authorized to add messages to this chat', 403));
  }
  
  // Validate message data
  if (!req.body.role || !req.body.content) {
    console.error('Missing required message fields:', { 
      has_role: !!req.body.role, 
      has_content: !!req.body.content
    });
    return next(new AppError('Message role and content are required', 400));
  }
  
  // Check maximum length
  const MAX_CONTENT_LENGTH = 64000; // Adjust based on DB field size
  let content = req.body.content;
  if (content.length > MAX_CONTENT_LENGTH) {
    console.warn(`Message content too large (${content.length} chars), truncating to ${MAX_CONTENT_LENGTH}`);
    content = content.substring(0, MAX_CONTENT_LENGTH);
  }
  
  // Create message data
  const messageData = {
    chat_id: chatId,
    role: req.body.role,
    content: content,
    tokens: req.body.tokens || 0
  };
  
  try {
    const message = await Message.createMessage(messageData);
    
    // Log gửi tin nhắn
    await Log.createLog({
      userId: req.user.id,
      action: 'CREATE',
      entityType: 'message',
      entityId: message.id,
      description: `Người dùng đã gửi tin nhắn mới trong chat #${chatId}`,
      newData: message,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent']
    });
    
    if (!message || !message.id) {
      console.error('Failed to create message, received:', message);
      return next(new AppError('Failed to create message', 500));
    }
    
    
    // Return the full message object with its ID
    res.status(201).json({
      id: message.id,
      chat_id: message.chat_id,
      role: message.role,
      content: message.content,
      tokens: message.tokens,
      createdAt: message.createdAt
    });
  } catch (error) {
    console.error(`Error saving message to chat ${chatId}:`, error);
    return next(new AppError(`Error saving message: ${error.message}`, 500));
  }
});

/**
 * Xóa tất cả tin nhắn của một cuộc trò chuyện
 */
exports.deleteAllMessages = catchAsync(async (req, res, next) => {
  const chat = await Chat.getChatById(req.params.id);
  if (!chat) {
    return next(new AppError('Chat not found', 404));
  }
  
  if (chat.user_id !== req.user.id && !req.user.isAdmin) {
    return next(new AppError('Not authorized to delete messages from this chat', 403));
  }
  
  await Message.deleteMessagesByChatId(req.params.id);
  // Log xóa tất cả tin nhắn
  await Log.createLog({
    userId: req.user.id,
    action: 'DELETE',
    entityType: 'message',
    entityId: chat.id,
    description: `Người dùng đã xóa tất cả tin nhắn trong chat #${chat.id}`,
    oldData: { chatId: chat.id },
    ipAddress: req.ip,
    userAgent: req.headers['user-agent']
  });
  res.status(200).json({ message: 'All messages deleted successfully' });
});

/**
 * Lấy danh sách model AI có sẵn
 */
exports.getAvailableModels = catchAsync(async (req, res) => {
  try {
    // Lấy danh sách model từ bảng api_keys với name và model
    // label = name, value = model
    // Chỉ lấy 1 row cho mỗi model (lấy row đầu tiên theo id)
    const result = await pool.request().query(`
      SELECT name, model
      FROM (
        SELECT name, model, 
               ROW_NUMBER() OVER (PARTITION BY model ORDER BY id) as rn
        FROM api_keys 
        WHERE is_active = 1 AND isDeleted = 0
      ) AS ranked
      WHERE rn = 1
      ORDER BY model
    `);
    
    console.log('[getAvailableModels] Raw query result:', JSON.stringify(result.recordset, null, 2));
    
    // Xử lý kết quả: label = name, value = model
    const models = result.recordset.map(row => {
      const model = row.model || '';
      const name = row.name || model || 'Unknown Model';
      
      return {
        value: model,  // value = model (để truyền vào API)
        label: name    // label = name (để hiển thị)
      };
    }).filter(item => item.value); // Lọc bỏ các item không có value
    
    console.log('[getAvailableModels] Mapped models:', JSON.stringify(models, null, 2));
    
    // Loại bỏ trùng lặp dựa trên value (model)
    const uniqueModels = [];
    const modelSet = new Set();
    
    models.forEach(item => {
      if (!modelSet.has(item.value)) {
        modelSet.add(item.value);
        uniqueModels.push(item);
      } else {
        console.warn(`[getAvailableModels] Duplicate model found: ${item.value} (${item.label})`);
      }
    });
    
    console.log('[getAvailableModels] Final unique models:', JSON.stringify(uniqueModels, null, 2));
    console.log(`[getAvailableModels] Total models: ${uniqueModels.length}`);
    
    res.status(200).json({
      status: 'success',
      models: uniqueModels
    });
  } catch (error) {
    console.error('Error fetching models:', error);
    res.status(200).json({
      status: 'success',
      models: []
    });
  }
});

/**
 * Lấy answer của một tin nhắn trong chat
 */
exports.getMessageAnswer = catchAsync(async (req, res, next) => {
  const chat = await Chat.getChatById(req.params.id);
  if (!chat) {
    return next(new AppError('Chat not found', 404));
  }
  
  if (chat.user_id !== req.user.id && !req.user.isAdmin) {
    return next(new AppError('Not authorized to view messages from this chat', 403));
  }
  
  const message = await Message.getMessageById(req.params.messageId);
  if (!message) {
    return next(new AppError('Message not found', 404));
  }
  
  if (message.chat_id !== parseInt(req.params.id)) {
    return next(new AppError('Message does not belong to this chat', 400));
  }
  
  if (!message.answer) {
    return next(new AppError('This message has no answer', 404));
  }
  
  res.status(200).json({ answer: message.answer });
}); 