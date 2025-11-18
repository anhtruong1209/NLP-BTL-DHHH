import { requestClient } from './request';
import axios from 'axios';
import { useAppConfig } from '@vben/hooks';
import { useAccessStore } from '@vben/stores';

/**
 * Interface cho API Key (Model) từ backend
 * Backend dùng bảng api_keys với structure:
 * id, name, service_name (description), model, api_key, is_active, usage_count, last_used, createdAt, updatedAt
 */
export interface AIModel {
  id?: number;
  modelId?: string; // Alias cho id để tương thích
  name: string;
  description?: string; // Map từ service_name
  model: string; // Model name như 'gemini-2.5-flash'
  key?: string; // API key (map từ api_key)
  apiKey?: string; // Alias cho key
  status?: 'active' | 'inactive'; // Map từ is_active
  enabled?: boolean; // Alias cho is_active
  is_active?: boolean | number; // Từ backend
  usage_count?: number;
  last_used?: string;
  createdAt?: string;
  updatedAt?: string;
  // Legacy fields để tương thích
  type?: 'gemini' | 'local';
  provider?: string;
  modelKey?: string;
}

/**
 * Get models list - Backend mới dùng /api/api-keys (admin only)
 * Trả về { status: 'success', results: number, data: { apiKeys: [...] } }
 */
export async function getModels() {
  // Dùng axios trực tiếp để bypass interceptor có thể transform sai
  const { apiURL } = useAppConfig(import.meta.env, import.meta.env.PROD);
  const accessStore = useAccessStore();
  
  try {
    const response = await axios.get(`${apiURL}/api-keys`, {
      headers: {
        Authorization: accessStore.accessToken ? `Bearer ${accessStore.accessToken}` : '',
      },
      withCredentials: true,
    });
    
    console.log('[getModels] Raw axios response:', response);
    console.log('[getModels] response.data:', response.data);
    
    // Backend trả về { status: 'success', results: number, data: { apiKeys: [...] } }
    const responseData = response.data;
    let apiKeys: any[] = [];
    
    // Xử lý nhiều format có thể có
    if (responseData && typeof responseData === 'object') {
      // Format: { status: 'success', data: { apiKeys: [...] } }
      if (responseData.data && responseData.data.apiKeys && Array.isArray(responseData.data.apiKeys)) {
        apiKeys = responseData.data.apiKeys;
      }
      // Format: { status: 'success', apiKeys: [...] }
      else if (responseData.apiKeys && Array.isArray(responseData.apiKeys)) {
        apiKeys = responseData.apiKeys;
      }
      // Format: { data: { apiKeys: [...] } } (từ interceptor)
      else if (responseData.data && Array.isArray(responseData.data)) {
        apiKeys = responseData.data;
      }
      // Format: array trực tiếp
      else if (Array.isArray(responseData)) {
        apiKeys = responseData;
      }
    }
    
    console.log('[getModels] Extracted apiKeys:', apiKeys);
    
    // Map api_keys structure sang AIModel
    const models: AIModel[] = apiKeys.map((ak: any) => {
      // Xử lý is_active: có thể là boolean, number (1/0), hoặc string ('true'/'false')
      let isActive = false;
      if (ak.is_active === true || ak.is_active === 1 || ak.is_active === '1' || ak.is_active === 'true') {
        isActive = true;
      } else if (ak.is_active === false || ak.is_active === 0 || ak.is_active === '0' || ak.is_active === 'false') {
        isActive = false;
      }
      
      console.log(`[getModels] Mapping model ${ak.id}: is_active=${ak.is_active} (type: ${typeof ak.is_active}) -> enabled=${isActive}`);
      
      return {
        id: ak.id,
        modelId: String(ak.id), // Tương thích với code cũ
        name: ak.name || ak.service_name || '',
        description: ak.service_name || ak.description || '',
        model: ak.model || '',
        key: ak.api_key || ak.key || '',
        apiKey: ak.api_key || ak.key || '',
        status: isActive ? 'active' : 'inactive',
        enabled: isActive,
        is_active: ak.is_active,
        usage_count: ak.usage_count || 0,
        last_used: ak.last_used || ak.lastUsed || null,
        createdAt: ak.createdAt || ak.created_at,
        updatedAt: ak.updatedAt || ak.updated_at,
        type: 'gemini', // Mặc định là gemini
        provider: 'google',
        modelKey: ak.model || '',
      };
    });
    
    console.log('[getModels] Mapped models:', models);
    
    return { status: 'success', models };
  } catch (error: any) {
    console.error('[getModels] Error:', error);
    console.log('[getModels] error.response:', error?.response);
    console.log('[getModels] error.response?.data:', error?.response?.data);
    
    // Nếu có error nhưng response data hợp lệ
    if (error?.response?.data) {
      const responseData = error.response.data;
      let apiKeys: any[] = [];
      
      // Xử lý nhiều format
      if (responseData.data && responseData.data.apiKeys && Array.isArray(responseData.data.apiKeys)) {
        apiKeys = responseData.data.apiKeys;
      } else if (responseData.apiKeys && Array.isArray(responseData.apiKeys)) {
        apiKeys = responseData.apiKeys;
      } else if (Array.isArray(responseData)) {
        apiKeys = responseData;
      }
      
      if (apiKeys.length > 0) {
        const models: AIModel[] = apiKeys.map((ak: any) => {
          // Xử lý is_active: có thể là boolean, number (1/0), hoặc string ('true'/'false')
          let isActive = false;
          if (ak.is_active === true || ak.is_active === 1 || ak.is_active === '1' || ak.is_active === 'true') {
            isActive = true;
          } else if (ak.is_active === false || ak.is_active === 0 || ak.is_active === '0' || ak.is_active === 'false') {
            isActive = false;
          }
          
          return {
            id: ak.id,
            modelId: String(ak.id),
            name: ak.name || ak.service_name || '',
            description: ak.service_name || ak.description || '',
            model: ak.model || '',
            key: ak.api_key || ak.key || '',
            apiKey: ak.api_key || ak.key || '',
            status: isActive ? 'active' : 'inactive',
            enabled: isActive,
            is_active: ak.is_active,
            usage_count: ak.usage_count || 0,
            last_used: ak.last_used || ak.lastUsed || null,
            createdAt: ak.createdAt || ak.created_at,
            updatedAt: ak.updatedAt || ak.updated_at,
            type: 'gemini',
            provider: 'google',
            modelKey: ak.model || '',
          };
        });
        return { status: 'success', models };
      }
    }
    throw error;
  }
}

/**
 * Get available (enabled) models for chat - Backend mới dùng /api/chats/models/list
 */
export function getAvailableModels() {
  return requestClient.get<{ status: string; models: Array<{ value: string; label: string }> }>('/chats/models/list');
}

/**
 * Get model by ID - Backend dùng /api/api-keys/:id
 */
export async function getModel(modelId: string) {
  try {
    const res = await requestClient.get<any>(`/api-keys/${modelId}`);
    const apiKey = res.data?.apiKey || res.apiKey || res;
    
    return {
      id: apiKey.id,
      modelId: String(apiKey.id),
      name: apiKey.name || '',
      description: apiKey.description || apiKey.service_name || '',
      model: apiKey.model || '',
      key: apiKey.key || apiKey.api_key || '',
      apiKey: apiKey.key || apiKey.api_key || '',
      status: apiKey.status || (apiKey.is_active ? 'active' : 'inactive'),
      enabled: apiKey.is_active === 1 || apiKey.is_active === true,
      is_active: apiKey.is_active,
      usage_count: apiKey.usage_count || 0,
      last_used: apiKey.last_used || apiKey.lastUsed,
      createdAt: apiKey.createdAt || apiKey.created_at,
      updatedAt: apiKey.updatedAt || apiKey.updated_at,
      type: 'gemini',
      provider: 'google',
      modelKey: apiKey.model || '',
    } as AIModel;
  } catch (error: any) {
    if (error?.response?.data) {
      const apiKey = error.response.data.data?.apiKey || error.response.data.apiKey || error.response.data;
      return {
        id: apiKey.id,
        modelId: String(apiKey.id),
        name: apiKey.name || '',
        description: apiKey.description || apiKey.service_name || '',
        model: apiKey.model || '',
        key: apiKey.key || apiKey.api_key || '',
        apiKey: apiKey.key || apiKey.api_key || '',
        status: apiKey.status || (apiKey.is_active ? 'active' : 'inactive'),
        enabled: apiKey.is_active === 1 || apiKey.is_active === true,
        is_active: apiKey.is_active,
        usage_count: apiKey.usage_count || 0,
        last_used: apiKey.last_used || apiKey.lastUsed,
        createdAt: apiKey.createdAt || apiKey.created_at,
        updatedAt: apiKey.updatedAt || apiKey.updated_at,
        type: 'gemini',
        provider: 'google',
        modelKey: apiKey.model || '',
      } as AIModel;
    }
    throw error;
  }
}

/**
 * Create model - Backend dùng POST /api/api-keys
 */
export async function createModel(model: Partial<AIModel>) {
  const { apiURL } = useAppConfig(import.meta.env, import.meta.env.PROD);
  const accessStore = useAccessStore();
  
  // Map AIModel sang api_keys structure
  const apiKeyData = {
    name: model.name || '',
    description: model.description || '',
    service_name: model.description || model.name || '',
    model: model.model || model.modelKey || 'gemini-2.5-flash',
    key: model.key || model.apiKey || '',
    status: model.status || (model.enabled !== false ? 'active' : 'inactive'),
    is_active: model.enabled !== false ? 1 : 0,
  };
  
  const response = await axios.post(`${apiURL}/api-keys`, apiKeyData, {
    headers: {
      Authorization: accessStore.accessToken ? `Bearer ${accessStore.accessToken}` : '',
      'Content-Type': 'application/json',
    },
    withCredentials: true,
  });
  
  return response.data;
}

/**
 * Update model - Backend dùng PATCH /api/api-keys/:id
 */
export async function updateModel(modelId: string, model: Partial<AIModel>) {
  const { apiURL } = useAppConfig(import.meta.env, import.meta.env.PROD);
  const accessStore = useAccessStore();
  
  // Map AIModel sang api_keys structure
  const apiKeyData: any = {};
  if (model.name !== undefined) apiKeyData.name = model.name;
  if (model.description !== undefined) {
    apiKeyData.description = model.description;
    apiKeyData.service_name = model.description;
  }
  if (model.model !== undefined || model.modelKey !== undefined) {
    apiKeyData.model = model.model || model.modelKey;
  }
  if (model.key !== undefined || model.apiKey !== undefined) {
    apiKeyData.key = model.key || model.apiKey;
  }
  if (model.status !== undefined) {
    apiKeyData.status = model.status;
    apiKeyData.is_active = model.status === 'active' ? 1 : 0;
  }
  if (model.enabled !== undefined) {
    apiKeyData.is_active = model.enabled ? 1 : 0;
    apiKeyData.status = model.enabled ? 'active' : 'inactive';
  }
  
  const response = await axios.patch(`${apiURL}/api-keys/${modelId}`, apiKeyData, {
    headers: {
      Authorization: accessStore.accessToken ? `Bearer ${accessStore.accessToken}` : '',
      'Content-Type': 'application/json',
    },
    withCredentials: true,
  });
  
  return response.data;
}

/**
 * Delete model - Backend dùng DELETE /api/api-keys/:id
 */
export function deleteModel(modelId: string) {
  return requestClient.delete(`/api-keys/${modelId}`);
}

