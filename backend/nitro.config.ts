import errorHandler from './error';

process.env.COMPATIBILITY_DATE = new Date().toISOString();

// Get frontend URL from environment variable, fallback to * for all origins
const frontendUrl = process.env.FRONTEND_URL || '*';

export default defineNitroConfig({
  preset: 'vercel',
  devErrorHandler: errorHandler,
  errorHandler: '~/error',
  // Disable automatic API route generation to reduce serverless functions
  // All API routes will be handled by routes/api/[...].ts
  experimental: {
    wasm: true,
  },
  routeRules: {
    '/api/**': {
      cors: true,
      headers: {
        'Access-Control-Allow-Credentials': 'true',
        'Access-Control-Allow-Headers':
          'Accept, Authorization, Content-Length, Content-Type, If-Match, If-Modified-Since, If-None-Match, If-Unmodified-Since, X-CSRF-TOKEN, X-Requested-With',
        'Access-Control-Allow-Methods': 'GET,HEAD,PUT,PATCH,POST,DELETE',
        'Access-Control-Allow-Origin': frontendUrl,
        'Access-Control-Expose-Headers': '*',
      },
    },
  },
  // Exclude api folder from automatic route generation
  ignore: ['api/**'],
});
