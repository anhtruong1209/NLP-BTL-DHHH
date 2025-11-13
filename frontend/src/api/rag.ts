import { baseRequestClient } from './request';

export interface IngestItem {
  docId?: string;
  text: string;
  metadata?: Record<string, any>;
}

export function ragIngest(params: {
  collection?: string;
  texts: IngestItem[];
  chunkSize?: number;
  chunkOverlap?: number;
}) {
  return baseRequestClient.post('/rag/ingest', params, { timeout: 300000 });
}

export function ragChat(params: {
  sessionId?: string;
  userId?: string;
  message: string;
  model?: string;
  topK?: number;
  collection?: string;
  historyLimit?: number;
  systemPrompt?: string;
}) {
  return baseRequestClient.post('/rag/chat', params, { timeout: 600000 });
}

export function ragSessions(userId?: string) {
  const search = new URLSearchParams(userId ? { userId } : {}).toString();
  const url = search ? `/rag/sessions?${search}` : '/rag/sessions';
  return baseRequestClient.get(url);
}

export function ragMessages(sessionId: string, limit = 200, userId?: string) {
  const search = new URLSearchParams({
    sessionId,
    limit: String(limit),
    ...(userId ? { userId } : {}),
  }).toString();
  return baseRequestClient.get(`/rag/messages?${search}`);
}

export function ragPinSession(sessionId: string, pinned: boolean) {
  return baseRequestClient.post(`/rag/sessions/${sessionId}/pin`, { pinned });
}

export function ragUpdateSessionTitle(sessionId: string, title: string) {
  return baseRequestClient.put(`/rag/sessions/${sessionId}/title`, { title });
}

export function ragDeleteSession(sessionId: string) {
  return baseRequestClient.delete(`/rag/sessions/${sessionId}`);
}


