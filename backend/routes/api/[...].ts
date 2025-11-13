import { defineEventHandler } from 'h3';
import { initMongoDB } from '~/utils/mongodb-init';

// Khởi tạo MongoDB khi server start
initMongoDB().catch(console.error);

// Import tất cả handlers - lazy load để giảm bundle size
const handlers: Record<string, () => Promise<any>> = {
  // Auth
  'POST:/api/auth/login': () => import('~/api/auth/login.post'),
  'POST:/api/auth/logout': () => import('~/api/auth/logout.post'),
  'POST:/api/auth/refresh': () => import('~/api/auth/refresh.post'),
  'GET:/api/auth/codes': () => import('~/api/auth/codes'),
  
  // User
  'GET:/api/user/info': () => import('~/api/user/info'),
  
  // Models
  'GET:/api/models/list': () => import('~/api/models/list.get'),
  'GET:/api/models/available': () => import('~/api/models/available.get'),
  'POST:/api/models/create': () => import('~/api/models/create.post'),
  'POST:/api/models/fix-model-keys': () => import('~/api/models/fix-model-keys.post'),
  'GET:/api/models/:id': () => import('~/api/models/[modelId].get'),
  'PUT:/api/models/:id': () => import('~/api/models/[modelId].put'),
  'DELETE:/api/models/:id': () => import('~/api/models/[modelId].delete'),
  
  // System
  'GET:/api/system/user/list': () => import('~/api/system/user/list'),
  'PUT:/api/system/user/:id': () => import('~/api/system/user/[id].put'),
  'DELETE:/api/system/user/:id': () => import('~/api/system/user/[id].delete'),
  'POST:/api/system/user/reset-password': () => import('~/api/system/user/reset-password.post'),
  'GET:/api/system/role/list': () => import('~/api/system/role/list'),
  'PUT:/api/system/role/:id': () => import('~/api/system/role/[id].put'),
  'DELETE:/api/system/role/:id': () => import('~/api/system/role/[id].delete'),
  'GET:/api/system/menu/list': () => import('~/api/system/menu/list'),
  'GET:/api/system/menu/name-exists': () => import('~/api/system/menu/name-exists'),
  'GET:/api/system/menu/path-exists': () => import('~/api/system/menu/path-exists'),
  
  // Analytics
  'GET:/api/analytics/stats': () => import('~/api/analytics/stats.get'),
  
  // Timezone
  'GET:/api/timezone': () => import('~/api/timezone/getTimezone'),
  'GET:/api/timezone/options': () => import('~/api/timezone/getTimezoneOptions'),
  'POST:/api/timezone': () => import('~/api/timezone/setTimezone'),
  
  // RAG
  'POST:/api/rag/chat': () => import('~/api/rag/chat.post'),
  'POST:/api/rag/ingest': () => import('~/api/rag/ingest.post'),
  'GET:/api/rag/messages': () => import('~/api/rag/messages.get'),
  'GET:/api/rag/sessions': () => import('~/api/rag/sessions.get'),
  'DELETE:/api/rag/sessions/:id': () => import('~/api/rag/sessions/[sessionId].delete'),
  'POST:/api/rag/sessions/:id/pin': () => import('~/api/rag/sessions/[sessionId]/pin.post'),
  'PUT:/api/rag/sessions/:id/title': () => import('~/api/rag/sessions/[sessionId]/title.put'),
};

function matchRoute(path: string, method: string): string | null {
  const routeKey = `${method}:${path}`;
  
  // Try exact match first
  if (handlers[routeKey]) {
    return routeKey;
  }
  
  // Try pattern matching for dynamic routes
  for (const [pattern, handler] of Object.entries(handlers)) {
    const [patternMethod, patternPath] = pattern.split(':');
    if (patternMethod !== method) continue;
    
    // Convert pattern to regex
    const regexPattern = patternPath.replace(/:[^/]+/g, '[^/]+');
    const regex = new RegExp(`^${regexPattern}$`);
    
    if (regex.test(path)) {
      return pattern;
    }
  }
  
  return null;
}

export default defineEventHandler(async (event) => {
  const path = event.path || '';
  const method = event.method;
  
  const routeKey = matchRoute(path, method);
  
  if (!routeKey || !handlers[routeKey]) {
    event.node.res.statusCode = 404;
    return { error: 'Not Found', path, method };
  }
  
  try {
    const handlerModule = await handlers[routeKey]();
    const handler = handlerModule.default || handlerModule;
    
    if (typeof handler === 'function') {
      return handler(event);
    }
    
    event.node.res.statusCode = 500;
    return { error: 'Invalid handler', path, method };
  } catch (error) {
    console.error('Handler error:', error);
    event.node.res.statusCode = 500;
    return { 
      error: 'Internal Server Error', 
      message: error instanceof Error ? error.message : 'Unknown error',
      path, 
      method 
    };
  }
});
