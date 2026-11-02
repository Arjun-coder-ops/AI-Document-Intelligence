import crypto from 'crypto';
import { type EmbeddingProvider, GeminiEmbeddingProvider, MODEL_CONFIG } from '@docsage/rag';

export class MockEmbeddingProvider implements EmbeddingProvider {
  constructor(public readonly dimension: number = MODEL_CONFIG.embedding.dimension) {}

  async embedText(text: string): Promise<number[]> {
    await Promise.resolve();
    const hash = crypto.createHash('sha256').update(text).digest();
    const vec: number[] = [];
    for (let i = 0; i < this.dimension; i++) {
      // Deterministic float between -1 and 1
      const byte = hash[i % hash.length] ?? 0;
      vec.push(Number((byte / 128 - 1).toFixed(4)));
    }
    // Normalize vector
    const norm = Math.sqrt(vec.reduce((sum, val) => sum + val * val, 0));
    return vec.map((val) => Number((val / (norm || 1)).toFixed(4)));
  }

  async embedBatch(texts: string[]): Promise<number[][]> {
    return Promise.all(texts.map((t) => this.embedText(t)));
  }
}

export function getEmbeddingProvider(): EmbeddingProvider {
  const geminiKey = process.env['GEMINI_API_KEY'];
  if (geminiKey && !geminiKey.includes('placeholder')) {
    return new GeminiEmbeddingProvider(geminiKey);
  }

  const dimension = Number(process.env['EMBEDDING_DIM'] ?? MODEL_CONFIG.embedding.dimension);
  return new MockEmbeddingProvider(dimension);
}
