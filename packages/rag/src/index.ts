export * from './chunker.js';
export * from './types.js';
export * from './rrf.js';
export * from './rerank.js';
export * from './prompt.js';
export * from './citations.js';
export * from './threshold.js';
export * from './retrieval.js';
export * from './llm.js';
export * from './circuit-breaker.js';

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
