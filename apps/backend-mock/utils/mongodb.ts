import { MongoClient, Db, Collection } from 'mongodb';

let client: MongoClient | null = null;
let db: Db | null = null;

const MONGODB_URI =  'mongodb+srv://admin:admin@warrantly-verhical.hsdx3um.mongodb.net/?appName=warrantly-verhical';
const DB_NAME = 'chatbot-nlp-vmu';

export interface SystemUser {
  _id?: string;
  id: string;
  username: string;
  password?: string;
  realName: string;
  email?: string;
  phone?: string;
  roles: string[];
  status: 0 | 1;
  createTime?: string;
  remark?: string;
  homePath?: string;
}

export interface RagChunk {
  _id?: string;
  collection: string;
  docId: string;
  chunkId: string;
  content: string;
  embedding: number[];
  metadata?: Record<string, any>;
  createdAt: string;
}

export type ChatRole = 'system' | 'user' | 'assistant' | 'tool';

export interface ChatSession {
  _id?: string;
  sessionId: string;
  userId?: string;
  title?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ChatMessage {
  _id?: string;
  sessionId: string;
  role: ChatRole;
  content: string;
  createdAt: string;
  contextChunks?: Array<{
    collection: string;
    docId: string;
    chunkId: string;
    score: number;
    content: string;
  }>;
}

/**
 * Kết nối MongoDB
 */
export async function connectMongoDB(): Promise<Db> {
  if (db) {
    return db;
  }

  try {
    console.log('🔌 Connecting to MongoDB...');
    console.log('📍 URI:', MONGODB_URI.replace(/\/\/[^:]+:[^@]+@/, '//***:***@')); // Ẩn password
    console.log('📦 Database:', DB_NAME);
    
    client = new MongoClient(MONGODB_URI);
    await client.connect();
    db = client.db(DB_NAME);
    console.log('✅ Connected to MongoDB');
    
    // Khởi tạo dữ liệu mặc định
    await initializeDefaultUsers();
    
    return db;
  } catch (error) {
    console.error('❌ MongoDB connection error:', error);
    if (error instanceof Error) {
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
    }
    throw error;
  }
}

/**
 * Lấy collection users
 */
export async function getUsersCollection(): Promise<Collection<SystemUser>> {
  try {
    const database = await connectMongoDB();
    return database.collection<SystemUser>('users');
  } catch (error) {
    console.error('❌ Error getting users collection:', error);
    throw error;
  }
}

/**
 * Lấy collection chứa các chunk tài liệu đã nhúng
 */
export async function getRagChunksCollection(): Promise<Collection<RagChunk>> {
  try {
    const database = await connectMongoDB();
    return database.collection<RagChunk>('rag_chunks');
  } catch (error) {
    console.error('❌ Error getting rag chunks collection:', error);
    throw error;
  }
}

/**
 * Lấy collection sessions chat
 */
export async function getChatSessionsCollection(): Promise<Collection<ChatSession>> {
  try {
    const database = await connectMongoDB();
    return database.collection<ChatSession>('chat_sessions');
  } catch (error) {
    console.error('❌ Error getting chat sessions collection:', error);
    throw error;
  }
}

/**
 * Lấy collection messages chat
 */
export async function getChatMessagesCollection(): Promise<Collection<ChatMessage>> {
  try {
    const database = await connectMongoDB();
    return database.collection<ChatMessage>('chat_messages');
  } catch (error) {
    console.error('❌ Error getting chat messages collection:', error);
    throw error;
  }
}

/**
 * Khởi tạo 2 user mặc định
 */
async function initializeDefaultUsers() {
  try {
    const usersCollection = await getUsersCollection();
    
    // Kiểm tra xem đã có user chưa
    const existingUsers = await usersCollection.countDocuments();
    console.log(`📊 Existing users count: ${existingUsers}`);
    
    if (existingUsers > 0) {
      // Kiểm tra xem có user admin và user không
      const adminUser = await usersCollection.findOne({ username: 'admin' });
      const normalUser = await usersCollection.findOne({ username: 'user' });
      
      if (adminUser && normalUser) {
        console.log('✅ Default users already exist');
        return; // Đã có user, không cần tạo lại
      }
      
      // Nếu thiếu một trong hai, tạo lại
      console.log('⚠️ Some default users missing, recreating...');
      await usersCollection.deleteMany({ username: { $in: ['admin', 'user'] } });
    }

    const defaultUsers: Omit<SystemUser, '_id'>[] = [
      {
        id: 'admin-001',
        username: 'admin',
        password: 'admin@123',
        realName: 'Administrator',
        email: 'admin@chatbot-nlp-vmu.com',
        phone: '0123456789',
        roles: ['super', 'admin'],
        status: 1,
        createTime: new Date().toISOString(),
        remark: 'Default admin account',
        homePath: '/workspace',
      },
      {
        id: 'user-001',
        username: 'user',
        password: 'user@123',
        realName: 'User',
        email: 'user@chatbot-nlp-vmu.com',
        phone: '0987654321',
        roles: ['user'],
        status: 1,
        createTime: new Date().toISOString(),
        remark: 'Default user account',
        homePath: '/workspace',
      },
    ];

    await usersCollection.insertMany(defaultUsers);
    console.log('✅ Initialized default users:', defaultUsers.map(u => u.username).join(', '));
  } catch (error) {
    console.error('❌ Error initializing default users:', error);
    throw error;
  }
}

/**
 * Đóng kết nối MongoDB
 */
export async function closeMongoDB() {
  if (client) {
    await client.close();
    client = null;
    db = null;
    console.log('✅ MongoDB connection closed');
  }
}

