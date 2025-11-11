// Build backend (Nitro -> .vercel/output) and frontend (playground/dist),
// then merge frontend static assets into .vercel/output/static so one Vercel
// project can serve both FE and API together.
import { execa } from 'execa';
import { cp, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const vercelOut = resolve(root, '.vercel/output');
const staticDir = resolve(vercelOut, 'static');
const feDist = resolve(root, 'playground/dist');

async function run() {
  // Install already handled by Vercel; ensure builds run in monorepo
  await execa('pnpm', ['-F', '@vben/backend-mock', 'build'], { stdio: 'inherit' });
  await execa('pnpm', ['-F', '@vben/playground', 'build'], { stdio: 'inherit' });

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

run().catch((e) => {
  console.error(e);
  process.exit(1);
});


