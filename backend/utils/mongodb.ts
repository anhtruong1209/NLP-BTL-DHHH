import type { Collection, Db } from 'mongodb';
import { MongoClient } from 'mongodb';

import { hashPassword } from './password-utils';

// --- Collection names -------------------------------------------------------
const COLLECTIONS = {
  users: 'users',
  chatSessions: 'chat_sessions',
  chatMessages: 'chat_messages',
  ragChunks: 'rag_chunks',
  aiModels: 'ai_models',
  roles: 'roles',
  modelUsage: 'model_usage',
} as const;

// --- Domain models ----------------------------------------------------------
export interface ChatSession {
  _id?: string;
  sessionId: string;
  userId: string;
  title: string;
  model?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ChatMessage {
  _id?: string;
  sessionId: string;
  userId: string;
  role: 'user' | 'assistant' | 'system';
  direction?: 'in' | 'out';
  content: string;
  model?: string;
  metadata?: Record<string, any>;
  createdAt: string;
  contextChunks?: Array<{
    collection: string;
    docId?: string;
    chunkId?: string;
    score?: number;
    content: string;
  }>;
}

export interface RagChunk {
  _id?: string;
  collection: string;
  docId: string;
  chunkId: string;
  content: string;
  embedding: number[];
  metadata?: Record<string, any>;
}

export interface AIModel {
  _id?: string;
  modelId?: string;
  modelKey: string;
  name: string;
  type: 'gemini' | 'local';
  enabled: boolean | number;
  apiKey?: string;
  payloadModel?: string;
  defaultMaxTokens?: number;
  defaultTemperature?: number;
  defaultTopP?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface ModelUsage {
  _id?: string;
  modelKey: string;
  userId: string;
  sessionId: string;
  messageId?: string;
  responseTime?: number;
  timestamp: string;
}

export interface SystemRole {
  _id?: string;
  id?: string | number;
  name: string;
  code: string;
  status: 0 | 1;
  remark?: string;
  createTime?: string;
}

let client: MongoClient | null = null;
let db: Db | null = null;
let indexesInitialized = false;

const MONGODB_URI =
  process.env.MONGODB_URI ||
  'mongodb+srv://admin:admin@warrantly-verhical.hsdx3um.mongodb.net/?appName=warrantly-verhical';
const DB_NAME = process.env.MONGODB_DB_NAME || 'chatbot-nlp-vmu';

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

/**
 * Kết nối MongoDB
 */
export async function connectMongoDB(): Promise<Db> {
  if (db) {
    return db;
  }

  try {
    console.log('🔌 Connecting to MongoDB...');
    console.log(
      '📍 URI:',
      MONGODB_URI.replace(/\/\/[^:]+:[^@]+@/, '//***:***@'),
    ); // Ẩn password
    console.log('📦 Database:', DB_NAME);

    client = new MongoClient(MONGODB_URI);
    await client.connect();
    db = client.db(DB_NAME);
    console.log('✅ Connected to MongoDB');

    // Khởi tạo dữ liệu mặc định
    await initializeDefaultUsers();
    await ensureIndexes(db);

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
  return getCollection<SystemUser>(COLLECTIONS.users);
}

export async function getChatSessionsCollection(): Promise<
  Collection<ChatSession>
> {
  return getCollection<ChatSession>(COLLECTIONS.chatSessions);
}

export async function getChatMessagesCollection(): Promise<
  Collection<ChatMessage>
> {
  return getCollection<ChatMessage>(COLLECTIONS.chatMessages);
}

export async function getRagChunksCollection(): Promise<
  Collection<RagChunk>
> {
  return getCollection<RagChunk>(COLLECTIONS.ragChunks);
}

export async function getAIModelsCollection(): Promise<Collection<AIModel>> {
  return getCollection<AIModel>(COLLECTIONS.aiModels);
}

export async function getRolesCollection(): Promise<Collection<SystemRole>> {
  return getCollection<SystemRole>(COLLECTIONS.roles);
}

export async function getModelUsageCollection(): Promise<
  Collection<ModelUsage>
> {
  return getCollection<ModelUsage>(COLLECTIONS.modelUsage);
}

async function getCollection<T>(name: string): Promise<Collection<T>> {
  try {
    const database = await connectMongoDB();
    return database.collection<T>(name);
  } catch (error) {
    console.error(`❌ Error getting "${name}" collection:`, error);
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
        // Ensure admin user has correct roles
        if (!adminUser.roles || !adminUser.roles.includes('admin')) {
          console.log('⚠️ Admin user missing admin role, updating...');
          await usersCollection.updateOne(
            { username: 'admin' },
            { $set: { roles: ['super', 'admin'] } }
          );
        }
        return; // Đã có user, không cần tạo lại
      }
      
      // Nếu thiếu một trong hai, tạo lại
      console.log('⚠️ Some default users missing, recreating...');
      await usersCollection.deleteMany({ username: { $in: ['admin', 'user'] } });
    }

    // Hash passwords before creating users
    const adminPasswordHash = await hashPassword('admin@123');
    const userPasswordHash = await hashPassword('user@123');
    
    const defaultUsers: Omit<SystemUser, '_id'>[] = [
      {
        id: 'admin-001',
        username: 'admin',
        password: adminPasswordHash,
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
        password: userPasswordHash,
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

async function ensureIndexes(database: Db) {
  if (indexesInitialized) {
    return;
  }

  const sessionsCol = database.collection<ChatSession>(COLLECTIONS.chatSessions);
  await sessionsCol.createIndex({ sessionId: 1 }, { unique: true });
  await sessionsCol.createIndex({ userId: 1, updatedAt: -1 });

  const messagesCol = database.collection<ChatMessage>(COLLECTIONS.chatMessages);
  await messagesCol.createIndex({ sessionId: 1, createdAt: 1 });
  await messagesCol.createIndex({ userId: 1, createdAt: -1 });

  const usageCol = database.collection<ModelUsage>(COLLECTIONS.modelUsage);
  await usageCol.createIndex({ modelKey: 1, timestamp: -1 });
  await usageCol.createIndex({ userId: 1, timestamp: -1 });

  indexesInitialized = true;
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

