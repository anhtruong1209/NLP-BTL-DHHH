import { connectMongoDB } from './mongodb';

/**
 * Khởi tạo kết nối MongoDB khi server start
 */
export async function initMongoDB() {
  try {
    await connectMongoDB();
    console.log('✅ MongoDB initialized successfully');
  } catch (error) {
    console.error('❌ MongoDB initialization failed:', error);
    // Không throw error để server vẫn có thể chạy nếu MongoDB chưa sẵn sàng
    // Có thể retry sau
  }
}

