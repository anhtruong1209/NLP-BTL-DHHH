// Prefetch Xenova model assets into a local cache folder so runtime can work offline.
// Will NOT fail the install if download is blocked; prints a warning instead.

import { pipeline, env } from '@xenova/transformers';
import { mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

async function main() {
  try {
    const root = './models/qwen2.5-0.5b-instruct';
    const modelDir = join(root, 'Xenova', 'Qwen2.5-0.5B-Instruct');
    const tokenizerCfg = join(modelDir, 'tokenizer_config.json');
    if (existsSync(tokenizerCfg)) {
      console.log('[prep-local-model] Model already present, skip download:', modelDir);
      return;
    }
    env.cacheDir = root;
    env.allowLocalModels = true;
    // Allow remote only during install to fetch assets if missing
    env.allowRemoteModels = true;
    // Pass HF token if provided (for private/limited rate envs)
    if (process.env.HF_TOKEN) {
      env.HF_TOKEN = process.env.HF_TOKEN;
      console.log('[prep-local-model] Using HF_TOKEN for authenticated downloads');
    }
    mkdirSync(root, { recursive: true });
    console.log('[prep-local-model] Downloading model to', root);
    const gen = await pipeline('text-generation', 'Xenova/Qwen2.5-0.5B-Instruct');
    await gen('warmup', { max_new_tokens: 1 });
    console.log('[prep-local-model] Cached Xenova/Qwen2.5-0.5B-Instruct successfully at', modelDir);
  } catch (e) {
    console.warn('[prep-local-model] Skipped prefetch (non-blocking):', e?.message || e);
  }
}

main();


