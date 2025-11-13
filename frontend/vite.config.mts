import { defineConfig } from '@vben/vite-config';

export default defineConfig(async () => {
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
      optimizeDeps: {
        exclude: ['jiti'],
      },
      // HTML plugin is configured by @vben/vite-config
      // We pass appTitle through application config
      build: {
        rollupOptions: {
          plugins: [
            {
              name: 'replace-jiti',
              resolveId(id) {
                // Replace jiti with empty module for browser builds
                if (id === 'jiti' || id.startsWith('jiti/')) {
                  return '\0jiti-stub';
                }
                return null;
              },
              load(id) {
                // Return empty module for jiti
                if (id === '\0jiti-stub') {
                  return 'export default {};';
                }
                return null;
              },
            },
            {
              name: 'replace-node-modules',
              resolveId(id) {
                // Replace node: modules with empty stubs
                if (id.startsWith('node:')) {
                  return `\0${id}`;
                }
                return null;
              },
              load(id) {
                if (id.startsWith('\0node:')) {
                  return 'export default {};';
                }
                return null;
              },
            },
          ],
        },
      },
      resolve: {
        alias: {
          // Alias jiti to empty module
          'jiti': 'data:text/javascript,export default {}',
        },
      },
    },
  };
});
