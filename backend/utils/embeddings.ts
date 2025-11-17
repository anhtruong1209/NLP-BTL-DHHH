import crypto from 'node:crypto';

const EMBEDDING_DIMENSION = 384;

interface Embedder {
  embed(text: string): Promise<number[]>;
}

/**
 * Simple deterministic embedder used for local development.
 * It hashes text into a fixed-size numeric vector so similarity
 * searches remain stable across processes without requiring a heavy model.
 */
class HashEmbedder implements Embedder {
  private dimension: number;

  constructor(dimension: number = EMBEDDING_DIMENSION) {
    this.dimension = dimension;
  }

  async embed(text: string): Promise<number[]> {
    const cleaned = text.normalize('NFKD');
    const buffer = crypto
      .createHash('sha256')
      .update(cleaned)
      .digest();

    const vector = new Array(this.dimension).fill(0);
    for (let i = 0; i < this.dimension; i++) {
      const byte = buffer[i % buffer.length];
      const charCode = cleaned.charCodeAt(i % cleaned.length) || 0;
      vector[i] = (byte + charCode) / 255;
    }
    return vector;
  }
}

let cachedEmbedder: HashEmbedder | null = null;

export function getEmbedder(): Embedder {
  if (!cachedEmbedder) {
    cachedEmbedder = new HashEmbedder();
  }
  return cachedEmbedder;
}

export async function embedText(text: string): Promise<number[]> {
  const embedder = getEmbedder();
  return embedder.embed(text);
}

export function cosineSimilarity(a: number[], b: number[]): number {
  if (!a.length || !b.length || a.length !== b.length) {
    return 0;
  }
  let dot = 0;
  let magA = 0;
  let magB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }
  if (!magA || !magB) {
    return 0;
  }
  return dot / (Math.sqrt(magA) * Math.sqrt(magB));
}

export function chunkTextByLength(
  text: string,
  chunkSize = 500,
  overlap = 100,
): string[] {
  const normalized = text.replace(/\r\n/g, '\n').trim();
  if (!normalized) {
    return [];
  }
  const chunks: string[] = [];
  let start = 0;

  while (start < normalized.length) {
    const end = Math.min(normalized.length, start + chunkSize);
    chunks.push(normalized.slice(start, end));
    if (end === normalized.length) {
      break;
    }
    start = end - overlap;
    if (start < 0) {
      start = 0;
    }
  }

  return chunks;
}


