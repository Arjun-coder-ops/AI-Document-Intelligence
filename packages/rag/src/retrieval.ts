import { fuseRRF } from './rrf.js';
import type { RetrievedChunk, RetrievalConfig, Reranker } from './types.js';
import { DEFAULT_RETRIEVAL_CONFIG } from './types.js';
import { evaluateRelevanceThreshold, DEFAULT_NOT_FOUND_MESSAGE } from './threshold.js';

export interface DatabaseQueryExecutor {
  queryDense(
    tenantId: string,
    queryEmbedding: number[],
    limit: number,
    efSearch: number,
  ): Promise<RetrievedChunk[]>;
  queryLexical(
    tenantId: string,
    queryText: string,
    limit: number,
  ): Promise<RetrievedChunk[]>;
}

export interface RetrievalResult {
  chunks: RetrievedChunk[];
  shortCircuited: boolean;
  topScore: number;
  fallbackMessage?: string | undefined;
}

export async function executeHybridRetrieval(
  tenantId: string,
  queryText: string,
  queryEmbedding: number[],
  executor: DatabaseQueryExecutor,
  reranker?: Reranker,
  config: Partial<RetrievalConfig> = {},
): Promise<RetrievalResult> {
  const mergedConfig: RetrievalConfig = {
    ...DEFAULT_RETRIEVAL_CONFIG,
    ...config,
  };

  const [denseCandidates, lexicalCandidates] = await Promise.all([
    executor.queryDense(tenantId, queryEmbedding, mergedConfig.denseLimit, mergedConfig.efSearch),
    mergedConfig.hybrid
      ? executor.queryLexical(tenantId, queryText, mergedConfig.lexicalLimit)
      : Promise.resolve([]),
  ]);

  let rankedCandidates: RetrievedChunk[] = [];

  if (mergedConfig.hybrid) {
    // Perform Reciprocal Rank Fusion
    const fused = fuseRRF(denseCandidates, lexicalCandidates, mergedConfig.fusionK);
    rankedCandidates = fused.map((item) => ({
      ...item,
      score: item.rrfScore,
      source: 'hybrid' as const,
    }));
  } else {
    rankedCandidates = denseCandidates;
  }

  if (rankedCandidates.length === 0) {
    return {
      chunks: [],
      shortCircuited: true,
      topScore: 0,
      fallbackMessage: DEFAULT_NOT_FOUND_MESSAGE,
    };
  }

  // Optional Cross-Encoder / Listwise Reranking
  let finalChunks: RetrievedChunk[] = rankedCandidates;
  if (mergedConfig.rerank && reranker) {
    const candidatesToRerank = rankedCandidates.slice(0, 20);
    const rerankedScores = await reranker.rerank(
      queryText,
      candidatesToRerank.map((c) => ({ id: c.id, content: c.content })),
      mergedConfig.rerankTopK,
    );

    const chunkById = new Map<string, RetrievedChunk>(candidatesToRerank.map((c) => [c.id, c]));
    const rerankedList: RetrievedChunk[] = [];

    for (const scored of rerankedScores) {
      const orig = chunkById.get(scored.id);
      if (orig) {
        rerankedList.push({
          ...orig,
          score: scored.score,
        });
      }
    }

    finalChunks = rerankedList;
  } else {
    finalChunks = rankedCandidates.slice(0, mergedConfig.rerankTopK);
  }

  // Check relevance threshold cutoff
  const scores = finalChunks.map((c) => c.score);
  const thresholdEval = evaluateRelevanceThreshold(scores, mergedConfig.relevanceThreshold);

  if (!thresholdEval.passesThreshold) {
    return {
      chunks: [],
      shortCircuited: true,
      topScore: thresholdEval.topScore,
      fallbackMessage: thresholdEval.fallbackMessage,
    };
  }

  return {
    chunks: finalChunks,
    shortCircuited: false,
    topScore: thresholdEval.topScore,
  };
}
