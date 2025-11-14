import errorHandler from './error';

process.env.COMPATIBILITY_DATE = new Date().toISOString();

// Get frontend URL from environment variable, fallback to * for all origins
const frontendUrl = process.env.FRONTEND_URL || '*';

export default defineNitroConfig({
  preset: 'vercel',
  devErrorHandler: errorHandler,
  errorHandler: '~/error',
  // CRITICAL: Only scan routes/ directory, NOT api/ folder
  // This prevents Nitro from auto-generating functions from api/ folder
  // Result: Only 1 function instead of 35+
  scanDirs: ['routes'], // Only scan routes/, not api/
  // Explicitly ignore api folder and other directories
  ignore: [
    'api/**',           // CRITICAL: Ignore api folder completely - Nitro will NOT create functions from it
    'handlers/**',      // Also ignore handlers if it exists
    'apps/**',
    'models/**',
    'scripts/**',
    'types/**',
    'utils/**',
    'middleware/**',
    'routes/[...].ts',  // Ignore root catch-all route (but keep routes/api/[...].ts)
  ],
  // Override Vercel config to route /api/* to __fallback
  vercel: {
    config: {
      routes: [
        { handle: 'filesystem' },
        { src: '/api/(.*)', dest: '/__fallback' },
        { src: '/(.*)', dest: '/__fallback' },
      ],
    },
  },
});
