import errorHandler from './error';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

process.env.COMPATIBILITY_DATE = new Date().toISOString();

// Get frontend URL from environment variable, fallback to * for all origins
const frontendUrl = process.env.FRONTEND_URL || '*';

// Get the directory where this config file is located (backend directory)
const backendDir = dirname(fileURLToPath(import.meta.url));

export default defineNitroConfig({
  preset: 'vercel',
  devErrorHandler: errorHandler,
  errorHandler: '~/error',
  // Set srcDir to backend directory to ensure correct path resolution
  srcDir: backendDir,
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
  // Configure alias resolution for production
  // ~ should resolve to the backend directory root (where nitro.config.ts is located)
  alias: {
    '~': backendDir,
  },
  // Ensure imports resolve correctly
  imports: {
    presets: [
      {
        from: 'h3',
        imports: ['defineEventHandler', 'setResponseStatus'],
      },
    ],
  },
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
