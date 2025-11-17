import { baseRequestClient } from '#/api/request';

export interface RagChatParams {
  sessionId?: string;
  message: string;
  model?: string;
  topK?: number;
  collection?: string;
  historyLimit?: number;
  systemPrompt?: string;
}

export function ragChat(params: RagChatParams) {
  return baseRequestClient.post('/rag/chat', params, {
    timeout: 600_000,
  });
}

export function ragSessions(userId?: string) {
  const search = userId ? `?userId=${encodeURIComponent(userId)}` : '';
  return baseRequestClient.get(`/rag/sessions${search}`);
}

export function ragMessages(sessionId: string, limit?: number) {
  const params = new URLSearchParams({ sessionId });
  if (limit) {
    params.set('limit', String(limit));
  }
  return baseRequestClient.get(`/rag/messages?${params.toString()}`);
}


