import type { Pipeline } from '@xenova/transformers';
import { pipeline } from '@xenova/transformers';

let embedderPromise: Promise<Pipeline> | null = null;

export async function getEmbedder(): Promise<Pipeline> {
	if (!embedderPromise) {
		embedderPromise = pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
	}
	return embedderPromise;
}

export async function embedText(text: string): Promise<number[]> {
	const embedder = await getEmbedder();
	const output: any = await embedder(text, { pooling: 'mean', normalize: true });
	// output.data is TypedArray
	return Array.from(output.data as Float32Array);
}

export function cosineSimilarity(a: number[], b: number[]): number {
	let dot = 0;
	let normA = 0;
	let normB = 0;
	const len = Math.min(a.length, b.length);
	for (let i = 0; i < len; i++) {
		const va = a[i];
		const vb = b[i];
		dot += va * vb;
		normA += va * va;
		normB += vb * vb;
	}
	if (normA === 0 || normB === 0) return 0;
	return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

export function chunkTextByLength(text: string, chunkSize = 800, overlap = 100): string[] {
	if (chunkSize <= 0) return [text];
	const result: string[] = [];
	let start = 0;
	while (start < text.length) {
		const end = Math.min(text.length, start + chunkSize);
		result.push(text.slice(start, end));
		if (end === text.length) break;
		start = Math.max(0, end - overlap);
	}
	return result;
}


