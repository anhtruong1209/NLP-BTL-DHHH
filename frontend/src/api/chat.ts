import { baseRequestClient, requestClient } from '#/api/request';
import axios from 'axios';
import { useAppConfig } from '@vben/hooks';
import { useAccessStore } from '@vben/stores';

export interface ChatMessage {
  id: number;
  chat_id: number;
  role: 'user' | 'assistant';
  content: string;
  tokens?: number;
  attachments?: string;
  createdAt: string;
}

export interface Chat {
  id: number;
  user_id: number;
  title: string;
  model: string;
  createdAt: string;
  updatedAt: string;
}

export interface ProcessAIMessageParams {
  message: string;
  chatId?: number;
  model?: string;
  history?: Array<{ role: string; content: string }>;
  useGoogleSearch?: boolean;
  apiKeyId?: number;
  attachments?: Array<{
    base64: string;
    filename: string;
    type: string;
    size?: number;
  }>;
}

export interface ProcessAIMessageResponse {
  status: string;
  data: {
    chat: Chat;
    userMessage: ChatMessage;
    aiMessage: ChatMessage;
  };
}

export interface AIModel {
  value: string;
  label: string;
}

/**
 * Lấy danh sách chat của user hiện tại
 * Backend trả về array trực tiếp
 */
export async function getMyChats(): Promise<Chat[]> {
  try {
    // Dùng baseRequestClient để bypass interceptor (backend trả về array trực tiếp)
    const response = await baseRequestClient.get<any>('/chats/my');
    // baseRequestClient trả về axios response, nên cần lấy response.data
    const res = response.data || response;
    console.log('[getMyChats] Raw response:', res);
    
    // Backend trả về array trực tiếp, nhưng interceptor có thể wrap
    if (Array.isArray(res)) {
      console.log('[getMyChats] Response is array, returning:', res);
      return res;
    }
    if (res && typeof res === 'object' && 'data' in res && Array.isArray(res.data)) {
      console.log('[getMyChats] Response has data array, returning:', res.data);
      return res.data;
    }
    console.warn('[getMyChats] Response format not recognized, returning empty array');
    return [];
  } catch (error: any) {
    console.log('[getMyChats] Error caught:', error);
    console.log('[getMyChats] error type:', typeof error);
    console.log('[getMyChats] error.response:', error?.response);
    console.log('[getMyChats] error.response?.data:', error?.response?.data);
    
    // Nếu error chính nó là array (interceptor throw error nhưng data là array)
    if (Array.isArray(error)) {
      console.log('[getMyChats] Error is array, returning:', error);
      return error;
    }
    
    // Nếu error có data property là array
    if (error?.data && Array.isArray(error.data)) {
      console.log('[getMyChats] Error.data is array, returning:', error.data);
      return error.data;
    }
    
    // Nếu error nhưng có response data, có thể là interceptor issue hoặc 304 Not Modified
    if (error?.response?.data) {
      let data = error.response.data;
      
      // Nếu data có data field (từ interceptor)
      if (data && typeof data === 'object' && 'data' in data && Array.isArray(data.data)) {
        data = data.data;
      }
      
      if (Array.isArray(data)) {
        console.log('[getMyChats] Extracted array from error.response.data:', data);
        return data;
      }
    }
    
    // Chỉ throw error nếu thực sự không có data hợp lệ
    console.error('[getMyChats] No valid data found, throwing error');
    throw error;
  }
}

/**
 * Tạo chat mới
 */
export function createChat(data: { title?: string; model?: string }) {
  return requestClient.post<{ status: string; data: { chat: Chat } }>('/chats', data);
}

/**
 * Lấy chat theo ID
 */
export function getChatById(chatId: number) {
  return requestClient.get<Chat>(`/chats/${chatId}`);
}

/**
 * Cập nhật chat - Backend dùng PATCH
 */
export async function updateChat(chatId: number, data: { title?: string; model?: string }) {
  const { apiURL } = useAppConfig(import.meta.env, import.meta.env.PROD);
  const accessStore = useAccessStore();
  const response = await axios.patch<Chat>(`${apiURL}/chats/${chatId}`, data, {
    headers: {
      Authorization: accessStore.accessToken ? `Bearer ${accessStore.accessToken}` : '',
    },
    withCredentials: true,
  });
  return response.data;
}

/**
 * Xóa chat
 */
export function deleteChat(chatId: number) {
  return requestClient.delete(`/chats/${chatId}`);
}

/**
 * Lấy messages của một chat
 * Backend trả về array trực tiếp
 */
export async function getChatMessages(chatId: number): Promise<ChatMessage[]> {
  try {
    // Dùng baseRequestClient để bypass interceptor (backend trả về array trực tiếp)
    const response = await baseRequestClient.get<any>(`/chats/${chatId}/messages`);
    // baseRequestClient trả về axios response, nên cần lấy response.data
    const res = response.data || response;
    console.log('[getChatMessages] Raw response:', res);
    
    // Backend trả về array trực tiếp, nhưng interceptor có thể wrap
    if (Array.isArray(res)) {
      console.log('[getChatMessages] Response is array, returning:', res);
      return res;
    }
    if (res && typeof res === 'object' && 'data' in res && Array.isArray(res.data)) {
      console.log('[getChatMessages] Response has data array, returning:', res.data);
      return res.data;
    }
    console.warn('[getChatMessages] Response format not recognized, returning empty array');
    return [];
  } catch (error: any) {
    console.log('[getChatMessages] Error caught:', error);
    console.log('[getChatMessages] error type:', typeof error);
    console.log('[getChatMessages] error.response:', error?.response);
    console.log('[getChatMessages] error.response?.data:', error?.response?.data);
    
    // Nếu error chính nó là array (interceptor throw error nhưng data là array)
    if (Array.isArray(error)) {
      console.log('[getChatMessages] Error is array, returning:', error);
      return error;
    }
    
    // Nếu error có data property là array
    if (error?.data && Array.isArray(error.data)) {
      console.log('[getChatMessages] Error.data is array, returning:', error.data);
      return error.data;
    }
    
    // Nếu error nhưng có response data, có thể là interceptor issue hoặc 304 Not Modified
    if (error?.response?.data) {
      let data = error.response.data;
      
      // Nếu data có data field (từ interceptor)
      if (data && typeof data === 'object' && 'data' in data && Array.isArray(data.data)) {
        data = data.data;
      }
      
      if (Array.isArray(data)) {
        console.log('[getChatMessages] Extracted array from error.response.data:', data);
        return data;
      }
    }
    
    // Chỉ throw error nếu thực sự không có data hợp lệ
    console.error('[getChatMessages] No valid data found, throwing error');
    throw error;
  }
}

/**
 * Tạo message mới
 */
export function createMessage(chatId: number, data: { role: string; content: string; tokens?: number }) {
  return requestClient.post<ChatMessage>(`/chats/${chatId}/messages`, data);
}

/**
 * Xử lý tin nhắn AI (gửi message và nhận phản hồi từ AI)
 */
export function processAIMessage(params: ProcessAIMessageParams) {
  return baseRequestClient.post<ProcessAIMessageResponse>('/chats/process', params, {
    timeout: 600_000, // 10 phút timeout
  });
}

/**
 * Lấy danh sách model AI có sẵn
 * Backend trả về { status: 'success', models: [...] }
 * requestClient có thể transform response, nên cần handle nhiều format
 */
export async function getAvailableModels() {
  try {
    // Dùng baseRequestClient để bypass interceptor (vì backend trả về { status: 'success', models: [...] })
    // Thêm timestamp để tránh cache
    const res = await baseRequestClient.get<any>('/chats/models/list', {
      params: { _t: Date.now() },
    });
    console.log('[getAvailableModels] Raw response:', res);
    
    // Backend trả về { status: 'success', models: [...] }
    // Nhưng interceptor có thể transform, nên check nhiều format
    let models: Array<{ value: string; label: string }> = [];
    
    if (res && typeof res === 'object') {
      if ('models' in res && Array.isArray(res.models)) {
        models = res.models;
      } else if ('data' in res && res.data) {
        const data = res.data;
        if (data.models && Array.isArray(data.models)) {
          models = data.models;
        } else if (Array.isArray(data)) {
          models = data;
        }
      }
    } else if (Array.isArray(res)) {
      models = res;
    }
    
    console.log('[getAvailableModels] Extracted models:', models);
    console.log(`[getAvailableModels] Total models extracted: ${models.length}`);
    
    // Loại bỏ trùng lặp dựa trên value (model) - đảm bảo không có duplicate
    const uniqueModels: Array<{ value: string; label: string }> = [];
    const modelSet = new Set<string>();
    
    models.forEach(item => {
      if (item.value && !modelSet.has(item.value)) {
        modelSet.add(item.value);
        uniqueModels.push(item);
      } else if (item.value) {
        console.warn(`[getAvailableModels] Duplicate model found in frontend: ${item.value} (${item.label})`);
      }
    });
    
    console.log(`[getAvailableModels] Final unique models: ${uniqueModels.length}`, uniqueModels);
    
    return { status: 'success', models: uniqueModels };
  } catch (error: any) {
    console.error('[getAvailableModels] Error:', error);
    console.log('[getAvailableModels] error.response:', error?.response);
    console.log('[getAvailableModels] error.response?.data:', error?.response?.data);
    console.log('[getAvailableModels] error.message:', error?.message);
    
    // Nếu error nhưng có response data, có thể là interceptor issue
    if (error?.response?.data) {
      const data = error.response.data;
      if (data.models && Array.isArray(data.models)) {
        console.log('[getAvailableModels] Extracted models from error.response.data:', data.models);
        return { status: 'success', models: data.models };
      }
      if (data.status === 'success' && Array.isArray(data.models)) {
        console.log('[getAvailableModels] Using error.response.data directly:', data);
        return data;
      }
    }
  }
}

