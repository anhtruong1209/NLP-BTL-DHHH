import { defineEventHandler, setResponseStatus } from 'h3';
import { initMongoDB } from '~/utils/mongodb-init';

// Khởi tạo MongoDB khi server start
initMongoDB().catch(console.error);

// Import tất cả handlers - lazy load để giảm bundle size
const handlers: Record<string, () => Promise<any>> = {
  // Auth
  'POST:/api/auth/login': () => import('~/api/auth/login.post'),
  'POST:/api/auth/logout': () => import('~/api/auth/logout.post'),
  'GET:/api/auth/codes': () => import('~/api/auth/codes'),
  // User
  'GET:/api/user/info': () => import('~/api/user/info'),
  // Models
  'GET:/api/models/list': () => import('~/api/models/list.get'),
  'GET:/api/models/:id': () => import('~/api/models/[modelId].get'),
  
  // System
  'GET:/api/system/user/list': () => import('~/api/system/user/list'),
  'GET:/api/system/role/list': () => import('~/api/system/role/list'),
  // RAG
  'POST:/api/rag/chat': () => import('~/api/rag/chat.post'),
  'POST:/api/rag/ingest': () => import('~/api/rag/ingest.post'),
  'GET:/api/rag/sessions': () => import('~/api/rag/sessions.get'),
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
  const method = event.method;
  const rawPath = event.path || '';
  
  // CORS handling - MUST be set for ALL requests (including OPTIONS)
  const requestOrigin = (event.node.req.headers.origin || '').toString();
  // Hardcode allowed frontend origin
  const allowedOrigin = 'https://nlp-btl-dhhh.vercel.app';
  const allowOriginHeader = allowedOrigin;

  const requestedHeaders =
    (event.node.req.headers['access-control-request-headers'] as string) || '';

  // Set CORS headers FIRST, before any other processing
  event.node.res.setHeader('Vary', 'Origin');
  event.node.res.setHeader('Access-Control-Allow-Origin', allowOriginHeader);
  event.node.res.setHeader('Access-Control-Allow-Credentials', 'true');
  event.node.res.setHeader(
    'Access-Control-Allow-Methods',
    'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
  );
  event.node.res.setHeader(
    'Access-Control-Allow-Headers',
    requestedHeaders ||
      'Accept, Authorization, Content-Length, Content-Type, If-Match, If-Modified-Since, If-None-Match, If-Unmodified-Since, X-CSRF-TOKEN, X-Requested-With',
  );
  event.node.res.setHeader('Access-Control-Max-Age', '86400');
  event.node.res.setHeader('Access-Control-Expose-Headers', '*');

  // Handle OPTIONS preflight request IMMEDIATELY - return 204 No Content
  if (method === 'OPTIONS') {
    console.log('[CORS] Handling OPTIONS preflight for:', rawPath);
    setResponseStatus(event, 204);
    return '';
  }

  // Normalize path: strip query string and trailing slash
  const path = rawPath.replace(/[?#].*$/, '').replace(/\/+$/, '') || '/';
  
  console.log('[API Route] Request:', { method, rawPath, path });
  
  const routeKey = matchRoute(path, method);
  
  console.log('[API Route] Matched route:', routeKey);
  
  if (!routeKey || !handlers[routeKey]) {
    console.log('[API Route] No handler found. Available handlers:', Object.keys(handlers));
    event.node.res.statusCode = 404;
    return { error: 'Not Found', path, method, availableRoutes: Object.keys(handlers) };
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
