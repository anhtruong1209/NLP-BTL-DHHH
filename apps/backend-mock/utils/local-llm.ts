import { pipeline, env } from '@xenova/transformers';

// Node 22-safe local generation using @xenova/transformers (pure JS/WASM)
// Model: Qwen2.5-0.5B-Instruct (multilingual, includes Vietnamese)
// Reference: https://huggingface.co/Qwen/Qwen2.5-0.5B-Instruct

// Use local cache directory inside project
env.cacheDir = './.cache/transformers';
env.allowLocalModels = true;

let generatorPromise: Promise<any> | null = null;

async function getGenerator() {
	if (!generatorPromise) {
		console.log('[LocalLLM] loading text-generation pipeline (Qwen2.5-0.5B-Instruct)...');
		generatorPromise = pipeline('text-generation', 'Xenova/Qwen2.5-0.5B-Instruct');
	}
	return generatorPromise;
}

export async function generateLocalCompletion(
	prompt: string,
	opts?: { maxTokens?: number; temperature?: number; topP?: number },
) {
	const generator = await getGenerator();
	const max_new_tokens = Math.max(32, Math.min(1024, opts?.maxTokens ?? 512));
	const temperature = opts?.temperature ?? 0.7;
	const top_p = opts?.topP ?? 0.9;
	console.log('[LocalLLM] generating (xenova)...', {
		max_new_tokens,
		temperature,
		top_p,
		promptLen: prompt.length,
	});
	const out = await generator(prompt, {
		max_new_tokens,
		temperature,
		top_p,
		// return_full_text keeps original prompt; we will strip it ourselves
		return_full_text: true,
	});
	// out[0].generated_text contains prompt + completion; strip prompt prefix
	const text: string = out?.[0]?.generated_text ?? '';
	const completion = text.startsWith(prompt) ? text.slice(prompt.length) : text;
	return completion.trim();
}


