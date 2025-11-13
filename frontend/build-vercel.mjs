#!/usr/bin/env node
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
// Get root directory (2 levels up from frontend/build-vercel.mjs)
const rootDir = resolve(__dirname, '../..');

// Ensure we're in the root directory
process.chdir(rootDir);
console.log('Working directory:', process.cwd());

try {
  console.log('Building workspace dependencies...');
  
  // Build all @vben-core packages in order
  const corePackages = [
    '@vben-core/shared',      // Build shared first
    '@vben-core/design',      // Then design
    '@vben-core/icons',
    '@vben-core/composables',
    '@vben-core/form-ui',
    '@vben-core/popup-ui',
    '@vben-core/menu-ui',
    '@vben-core/shadcn-ui',
    '@vben-core/layout-ui',
    '@vben-core/tabs-ui',
  ];
  
  // Build all @vben packages
  const vbenPackages = [
    '@vben/types',
    '@vben/constants',
    '@vben/utils',
    '@vben/hooks',
    '@vben/locales',
    '@vben/preferences',
    '@vben/stores',
  ];
  
  const allPackages = [...corePackages, ...vbenPackages];
  
  for (const pkg of allPackages) {
    try {
      console.log(`\n[Building ${pkg}]`);
      execSync(`pnpm -F ${pkg} build`, { 
        stdio: 'inherit', 
        cwd: rootDir,
        env: { ...process.env, NODE_OPTIONS: '--max-old-space-size=8192' }
      });
      console.log(`✓ ${pkg} built successfully`);
    } catch (error) {
      console.error(`✗ Failed to build ${pkg}:`, error.message);
      // Don't continue if critical packages fail
      if (pkg === '@vben-core/design' || pkg === '@vben-core/shared') {
        throw error;
      }
    }
  }
  
  console.log('\n[Building playground]');
  execSync('pnpm --filter @vben/playground build', { 
    stdio: 'inherit', 
    cwd: rootDir,
    env: { ...process.env, NODE_OPTIONS: '--max-old-space-size=8192' }
  });
  console.log('✓ Build completed successfully!');
  
} catch (error) {
  console.error('\n✗ Build failed:', error.message);
  process.exit(1);
}

