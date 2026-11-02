import type { Citation } from '@docsage/shared';

export interface DocumentChunk {
  ordinal: number;
  content: string;
  tokenCount: number;
  page: number | null;
  section: string | null;
  contentSha256: string;
}

export interface RetrievedChunk {
  id: string;
  tenantId: string;
  documentId: string;
  documentTitle: string;
  ordinal: number;
  content: string;
  tokenCount: number;
  page: number | null;
  section: string | null;
  score: number;
  source: 'dense' | 'lexical' | 'hybrid';
}

export interface RetrievalConfig {
  hybrid: boolean;
  denseLimit: number;
  lexicalLimit: number;
  fusionK: number;
  rerank: boolean;
  rerankTopK: number;
  relevanceThreshold: number;
  efSearch: number;
}

export const DEFAULT_RETRIEVAL_CONFIG: RetrievalConfig = {
  hybrid: true,
  denseLimit: 25,
  lexicalLimit: 25,
  fusionK: 60,
  rerank: true,
  rerankTopK: 5,
  relevanceThreshold: 0.012,
  efSearch: 40,
};

export interface Reranker {
  readonly name: string;
  rerank(
    query: string,
    documents: Array<{ id: string; content: string }>,
    topK: number,
  ): Promise<Array<{ id: string; score: number }>>;
}

export interface PromptContextChunk {
  citationIndex: number;
  chunkId: string;
  documentId: string;
  documentTitle: string;
  page: number | null;
  section: string | null;
  content: string;
}

export interface FormattedPrompt {
  systemPrompt: string;
  userPrompt: string;
  contextChunks: PromptContextChunk[];
}

export interface VerifiedCitationResult {
  verifiedCitations: Citation[];
  hallucinatedIndices: number[];
  cleanedText: string;
}

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
