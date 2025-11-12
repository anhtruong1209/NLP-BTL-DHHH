import { requestClient } from './request';

export interface AIModel {
  _id?: string;
  modelId: string;
  name: string;
  type: 'gemini' | 'local';
  provider: string;
  modelKey: string;
  payloadModel?: string;
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

export function getModels() {
  return requestClient.get('/models/list');
}

/**
 * Get available (enabled) models for chat - public endpoint, no admin required
 */
export function getAvailableModels() {
  return requestClient.get('/models/available');
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

