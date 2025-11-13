#!/usr/bin/env node
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { existsSync, copyFileSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = resolve(__dirname, '..');
const playgroundDir = resolve(__dirname);

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
  
  // Copy web.config to dist folder
  const webConfigPath = resolve(playgroundDir, 'web.config');
  const distPath = resolve(playgroundDir, 'dist');
  const distWebConfigPath = resolve(distPath, 'web.config');
  
  if (existsSync(webConfigPath)) {
    if (!existsSync(distPath)) {
      throw new Error('Dist folder does not exist. Build may have failed.');
    }
    copyFileSync(webConfigPath, distWebConfigPath);
    console.log('✓ web.config copied to dist folder');
  } else {
    console.warn('⚠ web.config not found, skipping...');
  }
  
  console.log('✓ Build completed successfully!');
  console.log(`✓ Output directory: ${distPath}`);
  console.log('\n📦 Next steps:');
  console.log('1. Copy the contents of the "dist" folder to your IIS website directory');
  console.log('2. Make sure URL Rewrite module is installed in IIS');
  console.log('3. Configure your IIS website to point to the dist folder');
  
} catch (error) {
  console.error('Build failed:', error.message);
  process.exit(1);
}

