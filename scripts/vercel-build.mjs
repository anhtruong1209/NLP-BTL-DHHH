// Build backend (Nitro -> .vercel/output) and frontend (playground/dist),
// then merge frontend static assets into .vercel/output/static so one Vercel
// project can serve both FE and API together.
import { spawn } from 'node:child_process';
import { cp, mkdir, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const vercelOut = resolve(root, '.vercel/output');
const backendOut = resolve(root, 'apps/backend-mock/.output');
const staticDir = resolve(vercelOut, 'static');
const feDist = resolve(root, 'playground/dist');

async function run() {
  // Install already handled by Vercel; ensure builds run in monorepo
  const workspacesToBuildFirst = [
    '@vben-core/design',
    '@vben-core/form-ui',
    '@vben-core/popup-ui',
    '@vben-core/menu-ui',
    '@vben-core/shadcn-ui',
    '@vben-core/composables',
    '@vben-core/icons',
    '@vben-core/layout-ui',
    '@vben-core/popup-ui',
    '@vben-core/shadcn-ui',
    '@vben-core/shared',
    '@vben-core/tabs-ui',
    '@vben/constants',
    '@vben/hooks',
    '@vben/locales',
    '@vben/preferences',
    '@vben/stores',
    '@vben/types',
    '@vben/utils',
  ];

  for (const ws of workspacesToBuildFirst) {
    await runCmd('pnpm', ['-F', ws, 'build']).catch((error) => {
      const message = String(error?.message || '');
      if (message.includes('not found') || message.includes('missing script')) {
        console.log(`[vercel-build] ${ws} build skipped (no build script or package missing).`);
        return;
      }
      throw error;
    });
  }
  await rm(vercelOut, { recursive: true, force: true });
  await rm(backendOut, { recursive: true, force: true });

  await runCmd('pnpm', ['-F', '@vben/backend-mock', 'build']);

  const backendOutputDir = existsSync(vercelOut)
    ? vercelOut
    : existsSync(backendOut)
      ? backendOut
      : null;

  if (!backendOutputDir) {
    throw new Error('Backend build did not produce .vercel/output or apps/backend-mock/.output');
  }

  if (backendOutputDir !== vercelOut) {
    await cp(backendOutputDir, vercelOut, { recursive: true });
  }
  await runCmd('pnpm', ['-F', '@vben/playground', 'build']);

  // Prepare static folder inside .vercel/output
  if (!existsSync(vercelOut)) {
    throw new Error('Backend build did not produce .vercel/output');
  }
  if (!existsSync(staticDir)) {
    await mkdir(staticDir, { recursive: true });
  }
  // Copy FE dist into Vercel static
  await cp(feDist, staticDir, { recursive: true });
  console.log('[vercel-build] Copied playground/dist -> .vercel/output/static');
}

function runCmd(cmd, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, {
      stdio: 'inherit',
      shell: process.platform === 'win32',
      ...options,
    });
    child.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`${cmd} ${args.join(' ')} failed with ${code}`))));
  });
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});


