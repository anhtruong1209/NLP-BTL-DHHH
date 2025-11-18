/**
 * Các hàm tiện ích cho ứng dụng
 */

const generateRandomCode = (length = 6) => {
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  
  for (let i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  
  return result;
};

/**
 * Định dạng ngày tháng
 * @param {Date} date - Đối tượng Date cần định dạng
 * @param {string} format - Định dạng mong muốn (mặc định: DD/MM/YYYY)
 * @returns {string} Chuỗi ngày tháng đã định dạng
 */
const formatDate = (date, format = 'DD/MM/YYYY') => {
  const d = new Date(date);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  
  let formattedDate = format;
  formattedDate = formattedDate.replace('DD', day);
  formattedDate = formattedDate.replace('MM', month);
  formattedDate = formattedDate.replace('YYYY', year);
  
  return formattedDate;
};

/**
 * Cắt ngắn chuỗi và thêm dấu ba chấm nếu cần
 * @param {string} text - Chuỗi cần cắt ngắn
 * @param {number} maxLength - Độ dài tối đa
 * @returns {string} - Chuỗi đã cắt ngắn
 */
const truncateText = (text, maxLength) => {
  if (!text || text.length <= maxLength) {
    return text;
  }
  
  return text.slice(0, maxLength) + '...';
};

/**
 * Chuyển đổi kích thước file sang đơn vị đọc được
 * @param {number} bytes - Kích thước file tính bằng byte
 * @returns {string} - Kích thước file đã định dạng
 */
const formatFileSize = (bytes) => {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

/**
 * Phân trang kết quả
 * @param {Array} items - Mảng các mục cần phân trang
 * @param {number} page - Số trang hiện tại
 * @param {number} limit - Số mục trên mỗi trang
 * @returns {Object} Đối tượng chứa thông tin phân trang
 */
const paginate = (items, page = 1, limit = 10) => {
  const currentPage = parseInt(page, 10) || 1;
  const itemsPerPage = parseInt(limit, 10) || 10;
  
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  
  const results = {
    data: items.slice(startIndex, endIndex),
    pagination: {
      total: items.length,
      totalPages: Math.ceil(items.length / itemsPerPage),
      currentPage,
      itemsPerPage,
      hasNextPage: endIndex < items.length,
      hasPrevPage: currentPage > 1
    }
  };
  
  return results;
};

/**
 * Manages conversation context for Gemini API
 * Applies windowing to keep context size manageable
 * @param {Array} messages - Array of conversation messages
 * @param {Object} options - Options for context management
 * @returns {Array} - Optimized message history for Gemini
 */
exports.optimizeConversationContext = (messages, options = {}) => {
  // Default options
  const {
    maxMessages = 20,
    maxTokens = 6000,
    alwaysKeepLatest = 4,
    alwaysKeepFirst = true
  } = options;
  
  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return [];
  }
  
  // Estimate token count (rough approximation)
  const estimateTokens = (text) => {
    if (!text) return 0;
    // Average English word is ~4 chars + 1 for space
    return Math.ceil(text.length / 4);
  };
  
  // Clone messages to avoid modifying the original array
  let optimizedMessages = [...messages];
  
  // If we have too many messages, apply windowing strategy
  if (optimizedMessages.length > maxMessages) {
    // Always keep the first message if it contains system instructions
    const firstMessage = alwaysKeepFirst ? [optimizedMessages[0]] : [];
    
    // Always keep the latest N messages
    const latestMessages = optimizedMessages.slice(-alwaysKeepLatest);
    
    // For the middle section, prioritize:
    // 1. User questions (messages with question marks)
    // 2. Short exchanges that provide important context
    const middleMessages = optimizedMessages.slice(
      alwaysKeepFirst ? 1 : 0, 
      optimizedMessages.length - alwaysKeepLatest
    );
    
    // Prioritize messages with questions
    const questionMessages = middleMessages.filter(msg => 
      msg.content && msg.content.includes('?')
    );
    
    // Select important middle messages while staying under token budget
    let selectedMiddle = [];
    let currentTokens = 0;
    
    // First add question messages as they're likely important
    for (const msg of questionMessages) {
      const tokenCount = estimateTokens(msg.content);
      if (currentTokens + tokenCount <= maxTokens / 2) {
        selectedMiddle.push(msg);
        currentTokens += tokenCount;
      }
    }
    
    // Then add other messages if we have budget
    for (const msg of middleMessages) {
      // Skip if already added as a question
      if (questionMessages.includes(msg)) continue;
      
      const tokenCount = estimateTokens(msg.content);
      if (currentTokens + tokenCount <= maxTokens / 2) {
        selectedMiddle.push(msg);
        currentTokens += tokenCount;
      }
    }
    
    // Sort selected messages by their original order
    selectedMiddle.sort((a, b) => {
      const indexA = middleMessages.indexOf(a);
      const indexB = middleMessages.indexOf(b);
      return indexA - indexB;
    });
    
    // Combine first, selected middle, and latest messages
    optimizedMessages = [...firstMessage, ...selectedMiddle, ...latestMessages];
    
    // If we had to skip messages, add a system message indicating truncated history
    if (optimizedMessages.length < messages.length) {
      const skippedCount = messages.length - optimizedMessages.length;
      optimizedMessages.splice(firstMessage.length, 0, {
        role: 'system',
        content: `[Note: ${skippedCount} older messages were omitted to stay within context limits]`
      });
    }
  }
  
  return optimizedMessages;
};

/**
 * Creates a system prompt for Gemini based on conversation context
 * @param {Object} options - Options for the system prompt
 * @returns {Object} - System prompt message in Gemini format
 */
exports.createGeminiSystemPrompt = (options = {}) => {
  const {
    contextLength = 'medium',
    personality = 'helpful',
    domain = 'general',
    useGoogleSearch = false // Tắt mặc định tính năng Google Search
  } = options;
  
  // Base system prompt
  let systemPromptText = "Bạn là trợ lý AI thông minh, hữu ích và chuyên nghiệp. ";
  
  // Thêm hướng dẫn về Google Search nếu được bật
  if (useGoogleSearch) {
    systemPromptText += "Bạn có khả năng tìm kiếm thông tin trên Google để cung cấp câu trả lời chính xác và cập nhật. " +
    "Khi sử dụng thông tin từ Google Search, hãy trích dẫn nguồn một cách rõ ràng và chính xác. " +
    "Không bịa đặt thông tin hoặc trích dẫn. Nếu không tìm thấy thông tin cần thiết, hãy thẳng thắn thừa nhận. " +
    "Khi cung cấp thông tin, hãy tóm tắt nội dung từ các nguồn đáng tin cậy thay vì sao chép nguyên văn. ";
  }
  
  // Adjust based on personality
  if (personality === 'expert') {
    systemPromptText += "Hãy trả lời với giọng điệu của một chuyên gia, sử dụng thuật ngữ chính xác và cung cấp thông tin chuyên sâu. ";
  } else if (personality === 'friendly') {
    systemPromptText += "Hãy trả lời với giọng điệu thân thiện, dễ hiểu và gần gũi. ";
  }
  
  // Adjust based on domain
  if (domain === 'maritime') {
    systemPromptText += "Bạn có kiến thức chuyên sâu về lĩnh vực hàng hải, vận tải biển, luật hàng hải quốc tế và các quy định liên quan. ";
  } else if (domain === 'technical') {
    systemPromptText += "Bạn có kiến thức chuyên sâu về công nghệ, lập trình, và kỹ thuật. ";
  }
  
  // Adjust based on context length
  if (contextLength === 'long') {
    systemPromptText += "Hãy nhớ toàn bộ ngữ cảnh của cuộc trò chuyện và đề cập đến thông tin từ các tin nhắn trước đó khi phù hợp. ";
  }
  
  // Add general guidelines
  systemPromptText += "Trả lời ngắn gọn, súc tích nhưng đầy đủ thông tin. Nếu không chắc chắn về câu trả lời, hãy nói rõ điều đó thay vì đưa ra thông tin không chính xác.";
  
  return {
    role: "model",
    parts: [{ text: systemPromptText }]
  };
};

/**
 * Creates a Google Search tool configuration for Gemini API
 * @param {Object} options - Options for the Google Search tool
 * @returns {Object} - Google Search tool configuration
 */
exports.createGoogleSearchTool = (options = {}) => {
  // Default options
  const {
    enableSearch = true
  } = options;
  
  // For Gemini 2.0+ models
  if (enableSearch) {
    return {
      googleSearch: {
        // Cấu hình chi tiết để có kết quả chính xác hơn
        disableAttribution: false,  // Luôn hiển thị nguồn trích dẫn
        includeWebSearchResults: true,  // Bao gồm kết quả tìm kiếm web
        maxWebSearchResultCount: 5,  // Số lượng kết quả tìm kiếm tối đa
        maxSnippetSize: 200,  // Kích thước đoạn trích tối đa
        searchQueryOverride: ""  // Để trống để sử dụng query mặc định từ AI
      }
    };
  }
  
  // Return null if search is disabled
  return null;
};

/**
 * Enhances Gemini API configuration with Google Search capability
 * @param {Object} baseConfig - Base configuration for Gemini API
 * @param {Object} options - Options for enhancing the configuration
 * @returns {Object} - Enhanced configuration with search capability
 */
exports.enhanceGeminiConfig = (baseConfig, options = {}) => {
  const {
    enableSearch = true,
    model = 'gemini-2.0-flash'
  } = options;
  
  // Clone the base configuration to avoid modifying the original
  const enhancedConfig = JSON.parse(JSON.stringify(baseConfig));
  
  // Add Google Search tool if enabled
  if (enableSearch) {
    const searchTool = this.createGoogleSearchTool({ enableSearch });
    
    if (searchTool) {
      // Initialize tools array if it doesn't exist
      if (!enhancedConfig.tools) {
        enhancedConfig.tools = [];
      }
      
      // Add the search tool
      enhancedConfig.tools.push(searchTool);
    }
  }
  
  return enhancedConfig;
}; 