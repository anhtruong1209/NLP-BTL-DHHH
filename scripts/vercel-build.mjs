// Build backend (Nitro -> .vercel/output) and frontend (playground/dist),
// then merge frontend static assets into .vercel/output/static so one Vercel
// project can serve both FE and API together.
import { spawn } from 'node:child_process';
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
  await runCmd('pnpm', ['-F', '@vben-core/design', 'build']);
  await runCmd('pnpm', ['-F', '@vben/backend-mock', 'build']);
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

function runCmd(cmd, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: 'inherit', shell: process.platform === 'win32' });
    child.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`${cmd} ${args.join(' ')} failed with ${code}`))));
  });
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});


