import { defineConfig } from '@vben/vite-config';
import type { Plugin } from 'vite';
import { fileURLToPath } from 'node:url';

// Plugin to replace jiti and node: modules
function replaceJitiPlugin(): Plugin {
  return {
    name: 'replace-jiti-node',
    enforce: 'pre', // Run before other plugins to intercept early
    resolveId(id, importer) {
      // Replace jiti - handle all possible import paths including full paths
      if (
        id === 'jiti' ||
        id.startsWith('jiti/') ||
        id.includes('/jiti/') ||
        id.includes('jiti/lib/jiti.mjs') ||
        id.endsWith('/jiti') ||
        id.includes('node_modules/jiti') ||
        (importer && importer.includes('jiti'))
      ) {
        return '\0virtual:jiti-stub';
      }
      // Replace node: modules
      if (id.startsWith('node:')) {
        return `\0virtual:${id.replace(/:/g, '-')}`;
      }
      return null;
    },
    load(id) {
      // Return empty module for jiti with all exports
      if (id === '\0virtual:jiti-stub' || id.includes('jiti')) {
        return `
          export default function() { return {}; };
          export function createJiti() { return {}; };
          export const jiti = () => ({});
        `;
      }
      // Return empty module for node: modules
      if (id.includes('virtual:node-')) {
        return 'export default {};';
      }
      return null;
    },
  };
}

export default defineConfig(async () => {
  const resolvePath = (dir: string) => fileURLToPath(new URL(dir, import.meta.url));
  return {
    application: {},
    vite: {
      server: {
        proxy: {
          '/api': {
            changeOrigin: true,
            rewrite: (path) => path.replace(/^\/api/, ''),
            // mock代理目标地址
            target: 'http://localhost:5320/api',
            ws: true,
          },
        },
      },
      plugins: [
        // Add plugin early to intercept jiti imports
        replaceJitiPlugin(),
      ],
      optimizeDeps: {
        exclude: ['jiti'],
      },
      build: {
        commonjsOptions: {
          exclude: ['jiti'],
        },
        rollupOptions: {
          plugins: [
            // Also add to rollup plugins for build time
            {
              name: 'rollup-replace-jiti',
              resolveId(id) {
                // Handle all jiti import patterns including relative paths
                if (
                  id === 'jiti' ||
                  id.includes('jiti') ||
                  id.includes('/jiti/') ||
                  id.endsWith('/jiti') ||
                  id.includes('jiti/lib/jiti.mjs') ||
                  id.includes('node_modules/jiti') ||
                  id.includes('.pnpm/jiti')
                ) {
                  return '\0rollup-jiti-stub';
                }
                // Handle node: modules
                if (id.startsWith('node:') || id.includes('node:module')) {
                  return `\0rollup-${id.replace(/[:/]/g, '-')}`;
                }
                return null;
              },
              load(id) {
                if (id === '\0rollup-jiti-stub' || id.includes('jiti')) {
                  return `
                    const noop = () => ({});
                    export default noop;
                    export { noop as createJiti, noop as jiti };
                    export function createRequire() { return () => ({}); }
                  `;
                }
                if (id.includes('rollup-node-') || id.includes('node-module')) {
                  return 'export default {}; export function createRequire() { return () => ({}); }';
                }
                return null;
              },
            },
          ],
        },
      },
      resolve: {
        alias: {
          // Alias jiti to empty module - multiple patterns
          'jiti': 'data:text/javascript,export default () => ({});',
          'jiti/lib/jiti.mjs': 'data:text/javascript,export default () => ({});',
          '#': resolvePath('./src/'),
          '#/': resolvePath('./src/'),
          '@': resolvePath('./src/'),
          '@/': resolvePath('./src/'),
        },
      },
    },
  };
});
