import errorHandler from './error';

process.env.COMPATIBILITY_DATE = new Date().toISOString();

// Get frontend URL from environment variable, fallback to * for all origins
const frontendUrl = process.env.FRONTEND_URL || '*';

export default defineNitroConfig({
  preset: 'vercel',
  devErrorHandler: errorHandler,
  errorHandler: '~/error',
  // CRITICAL: Only scan routes/api/ to create single catch-all function
  // This prevents Nitro from auto-generating functions from api/ folder
  // Result: Only 1-2 functions instead of 35+
  scanDirs: ['routes/api'],
  // Explicitly ignore api folder and other directories to prevent auto-scanning
  ignore: [
    'api/**',
    'apps/**',
    'models/**',
    'scripts/**',
    'types/**',
    'utils/**',
    'middleware/**',
    'routes/[...].ts', // Ignore root route to reduce functions
  ],
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
});
