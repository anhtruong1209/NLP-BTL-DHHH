import { defineEventHandler } from 'h3';
import { initMongoDB } from '~/utils/mongodb-init';

// Khởi tạo MongoDB khi server start
initMongoDB().catch(console.error);

// Lazy load handlers - only import when needed
// Using relative paths to avoid alias resolution issues in production
function getHandler(routeKey: string): (() => Promise<any>) | null {
  // Use relative paths from routes/api/[...].ts to api/ folder
  const handlerMap: Record<string, string> = {
    // Auth
    'POST:/api/auth/login': '../../api/auth/login.post',
    'POST:/api/auth/logout': '../../api/auth/logout.post',
    'GET:/api/auth/codes': '../../api/auth/codes',
    // User
    'GET:/api/user/info': '../../api/user/info',
    // Models
    'GET:/api/models/list': '../../api/models/list.get',
    'GET:/api/models/:id': '../../api/models/[modelId].get',
    // System
    'GET:/api/system/user/list': '../../api/system/user/list',
    'GET:/api/system/role/list': '../../api/system/role/list',
    // RAG
    'POST:/api/rag/chat': '../../api/rag/chat.post',
    'POST:/api/rag/ingest': '../../api/rag/ingest.post',
    'GET:/api/rag/sessions': '../../api/rag/sessions.get',
  };
  
  const modulePath = handlerMap[routeKey];
  if (!modulePath) return null;
  
  // Dynamic import only when handler is actually needed
  return () => import(modulePath);
}

function matchRoute(path: string, method: string): string | null {
  const routeKey = `${method}:${path}`;
  
  // Handler map for pattern matching
  const handlerPatterns = [
    'POST:/api/auth/login',
    'POST:/api/auth/logout',
    'GET:/api/auth/codes',
    'GET:/api/user/info',
    'GET:/api/models/list',
    'GET:/api/models/:id',
    'GET:/api/system/user/list',
    'GET:/api/system/role/list',
    'POST:/api/rag/chat',
    'POST:/api/rag/ingest',
    'GET:/api/rag/sessions',
  ];
  
  // Try exact match first
  if (getHandler(routeKey)) {
    return routeKey;
  }
  
  // Try pattern matching for dynamic routes
  for (const pattern of handlerPatterns) {
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
  
  // Handle OPTIONS preflight request FIRST - before any other processing
  // This prevents any handler imports or route matching
  if (method === 'OPTIONS') {
    console.log('[CORS] Handling OPTIONS preflight for:', rawPath);
    
    // Set CORS headers for OPTIONS
    const requestOrigin = (event.node.req.headers.origin || '').toString();
    const allowedOrigin = 'https://nlp-btl-dhhh.vercel.app';
    const requestedHeaders =
      (event.node.req.headers['access-control-request-headers'] as string) || '';

    event.node.res.setHeader('Vary', 'Origin');
    event.node.res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
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
    
    event.node.res.statusCode = 204;
    event.node.res.statusMessage = 'No Content';
    event.node.res.end();
    return;
  }
  
  // CORS handling for non-OPTIONS requests
  const requestOrigin = (event.node.req.headers.origin || '').toString();
  const allowedOrigin = 'https://nlp-btl-dhhh.vercel.app';
  const allowOriginHeader = allowedOrigin;

  const requestedHeaders =
    (event.node.req.headers['access-control-request-headers'] as string) || '';

  // Set CORS headers
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

  // Normalize path: strip query string and trailing slash
  const path = rawPath.replace(/[?#].*$/, '').replace(/\/+$/, '') || '/';
  
  console.log('[API Route] Request:', { method, rawPath, path });
  
  const routeKey = matchRoute(path, method);
  
  console.log('[API Route] Matched route:', routeKey);
  
  if (!routeKey) {
    console.log('[API Route] No route matched');
    event.node.res.statusCode = 404;
    return { error: 'Not Found', path, method };
  }
  
  const handlerFactory = getHandler(routeKey);
  if (!handlerFactory) {
    console.log('[API Route] No handler found for route:', routeKey);
    event.node.res.statusCode = 404;
    return { error: 'Not Found', path, method, routeKey };
  }
  
  try {
    // Lazy load handler only for non-OPTIONS requests
    const handlerModule = await handlerFactory();
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
