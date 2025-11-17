import { requestClient } from './request';

export interface AIModel {
  _id?: string;
  modelId: string;
  name: string;
  type: 'gemini' | 'local';
  provider: string;
  modelKey: string;
  apiKey?: string;
  apiKeyEncrypted?: boolean;
  localPath?: string;
  localType?: 'gguf' | 'transformers' | 'onnx';
  enabled: boolean;
  defaultMaxTokens?: number;
  defaultTemperature?: number;
  defaultTopP?: number;
  description?: string;
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
}

/**
 * Get models list
 * - If admin: returns all models (including disabled)
 * - If not admin: returns only enabled models
 */
export function getModels() {
  return requestClient.get('/models/list');
}

/**
 * Get available (enabled) models for chat - uses /models/list which filters by user role
 * @deprecated Use getModels() instead - it now handles both admin and user cases
 */
export function getAvailableModels() {
  return requestClient.get('/models/list');
}

export function getModel(modelId: string) {
  return requestClient.get(`/models/${modelId}`);
}

export function createModel(model: Partial<AIModel>) {
  return requestClient.post('/models/create', model);
}

export function updateModel(modelId: string, model: Partial<AIModel>) {
  return requestClient.put(`/models/${modelId}`, model);
}

export function deleteModel(modelId: string) {
  return requestClient.delete(`/models/${modelId}`);
}

