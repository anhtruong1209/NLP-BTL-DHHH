#!/usr/bin/env node
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = resolve(__dirname, '..');

process.chdir(rootDir);

try {
  console.log('Building workspace dependencies...');
  
  // Build all @vben-core packages
  const corePackages = [
    '@vben-core/design',
    '@vben-core/form-ui',
    '@vben-core/popup-ui',
    '@vben-core/menu-ui',
    '@vben-core/shadcn-ui',
    '@vben-core/composables',
    '@vben-core/icons',
    '@vben-core/layout-ui',
    '@vben-core/shared',
    '@vben-core/tabs-ui',
  ];
  
  // Build all @vben packages
  const vbenPackages = [
    '@vben/constants',
    '@vben/hooks',
    '@vben/locales',
    '@vben/preferences',
    '@vben/stores',
    '@vben/types',
    '@vben/utils',
  ];
  
  const allPackages = [...corePackages, ...vbenPackages];
  
  for (const pkg of allPackages) {
    try {
      console.log(`Building ${pkg}...`);
      execSync(`pnpm -F ${pkg} build`, { stdio: 'inherit', cwd: rootDir });
    } catch (error) {
      console.warn(`Failed to build ${pkg}, continuing...`);
    }
  }
  
  console.log('Building playground...');
  execSync('pnpm --filter @vben/playground build', { stdio: 'inherit', cwd: rootDir });
  
} catch (error) {
  console.error('Build failed:', error.message);
  process.exit(1);
}

