import { describe, it, expect, vi, afterEach } from 'vitest';
import { NoOpReranker, MockReranker, GeminiListwiseReranker } from './rerank.js';
import type { LLMProvider } from './types.js';

describe('packages/rag: Reranker Implementations', () => {
  const docs = [
    { id: 'doc-1', content: 'PostgreSQL provides robust relational indexing and ACID guarantees.' },
    {
      id: 'doc-2',
      content: 'Raft consensus enforces replicated log ordering with election timers.',
    },
    {
      id: 'doc-3',
      content: 'HNSW builds multi-layer proximity graphs for approximate nearest neighbors.',
    },
  ];

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('NoOpReranker preserves input order and assigns reciprocal rank scores', async () => {
    const reranker = new NoOpReranker();
    const ranked = await reranker.rerank('query', docs, 2);

    expect(ranked.length).toBe(2);
    expect(ranked[0]?.id).toBe('doc-1');
    expect(ranked[0]?.score).toBe(1.0);
    expect(ranked[1]?.id).toBe('doc-2');
  });

  it('MockReranker scores candidates using lexical term overlap and stopword filtering', async () => {
    const reranker = new MockReranker();
    const ranked = await reranker.rerank('Raft consensus replicated timers', docs, 3);

    expect(ranked[0]?.id).toBe('doc-2');
    expect(ranked[0]?.score).toBeGreaterThan(0);
  });

  describe('GeminiListwiseReranker', () => {
    it('parses model index arrays and returns ranked candidates', async () => {
      const mockProvider: LLMProvider = {
        modelName: 'test-gemini',
        generateText: async () => {
          await Promise.resolve();
          return 'Here is the ranking: [2, 3, 1]';
        },
        streamText: async () => {
          await Promise.resolve();
        },
      };
      const reranker = new GeminiListwiseReranker(mockProvider);

      const ranked = await reranker.rerank('Raft query', docs, 2);
      expect(ranked.length).toBe(2);
      expect(ranked[0]?.id).toBe('doc-2');
      expect(ranked[0]?.score).toBe(1.0);
      expect(ranked[1]?.id).toBe('doc-3');
      expect(ranked[1]?.score).toBe(0.5);
    });

    it('falls back gracefully to input order when response JSON is malformed', async () => {
      const brokenProvider: LLMProvider = {
        modelName: 'test-gemini',
        generateText: async () => {
          await Promise.resolve();
          return 'No JSON indices returned here at all';
        },
        streamText: async () => {
          await Promise.resolve();
        },
      };
      const fallbackReranker = new GeminiListwiseReranker(brokenProvider);
      const fallbackRanked = await fallbackReranker.rerank('query', docs, 2);
      expect(fallbackRanked.length).toBe(2);
      expect(fallbackRanked[0]?.id).toBe('doc-1');
      expect(fallbackRanked[0]?.score).toBe(1.0);
    });

    it('handles empty and single document arrays without calling LLM', async () => {
      const mockProvider: LLMProvider = {
        modelName: 'test-gemini',
        generateText: vi.fn(),
        streamText: vi.fn(),
      };
      const reranker = new GeminiListwiseReranker(mockProvider);

      const emptyRanked = await reranker.rerank('query', [], 5);
      expect(emptyRanked).toEqual([]);
      expect(mockProvider.generateText).not.toHaveBeenCalled();

      const singleRanked = await reranker.rerank('query', [docs[0]!], 5);
      expect(singleRanked).toEqual([{ id: 'doc-1', score: 1.0 }]);
      expect(mockProvider.generateText).not.toHaveBeenCalled();
    });
  });
});
