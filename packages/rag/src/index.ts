export * from './chunker.js';
import type { Citation } from '@docsage/shared';

export interface EmbeddingProvider {
  readonly dimension: number;
  embedText(text: string): Promise<number[]>;
  embedBatch(texts: string[]): Promise<number[][]>;
}

export interface StreamCallbacks {
  onToken?: (token: string) => void;
  onMeta?: (meta: { requestId: string; model: string }) => void;
  onCitations?: (citations: Citation[]) => void;
  onError?: (err: Error) => void;
}

export interface LLMProvider {
  readonly modelName: string;
  generateText(
    prompt: string,
    options?: { temperature?: number; maxTokens?: number },
  ): Promise<string>;
  streamText(
    prompt: string,
    callbacks: StreamCallbacks,
    options?: { signal?: AbortSignal; temperature?: number; maxTokens?: number },
  ): Promise<void>;
}

export interface Reranker {
  rerank(
    query: string,
    documents: Array<{ id: string; content: string }>,
    topK: number,
  ): Promise<Array<{ id: string; score: number }>>;
}

export interface ChunkOptions {
  targetTokens: number;
  overlapTokens: number;
}

export interface DocumentChunk {
  ordinal: number;
  content: string;
  tokenCount: number;
  page: number | null;
  section: string | null;
  contentSha256: string;
}

/**
 * Standard Reciprocal Rank Fusion calculation
 * RRF(d) = sum(1 / (k + r(d)))
 */
export function calculateRRF(
  denseRanks: Map<string, number>,
  lexicalRanks: Map<string, number>,
  k = 60,
): Map<string, number> {
  const scores = new Map<string, number>();

  for (const [id, rank] of denseRanks.entries()) {
    scores.set(id, (scores.get(id) ?? 0) + 1 / (k + rank));
  }

  for (const [id, rank] of lexicalRanks.entries()) {
    scores.set(id, (scores.get(id) ?? 0) + 1 / (k + rank));
  }

  return scores;
}
