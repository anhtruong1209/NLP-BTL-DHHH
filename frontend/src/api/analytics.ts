import { requestClient } from './request';

export interface AnalyticsStats {
  totalSessions: number;
  totalMessages: number;
  totalUsers?: number;
  modelUsage: Array<{
    modelKey: string;
    count: number;
    avgResponseTime: number;
  }>;
  dailyStats: Array<{
    date: string;
    count: number;
  }>;
  messagesDailyStats?: Array<{
    date: string;
    count: number;
  }>;
  hourlyStats?: Array<{
    hour: string;
    count: number;
  }>;
  avgResponseTimeDaily?: Array<{
    date: string;
    avgResponseTime: number;
    count: number;
  }>;
  topConversations?: Array<{
    sessionId: string;
    title: string;
    messageCount: number;
    lastMessage: string;
  }>;
  userStats?: Array<{
    userId: string;
    sessionCount: number;
  }>;
}

export function getAnalyticsStats(params?: { userId?: string; days?: number }) {
  const search = new URLSearchParams();
  if (params?.userId) search.append('userId', params.userId);
  if (params?.days) search.append('days', String(params.days));
  const query = search.toString();
  const url = query ? `/analytics/stats?${query}` : '/analytics/stats';
  return requestClient.get(url);
}

