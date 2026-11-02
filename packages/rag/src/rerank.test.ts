import { describe, it, expect, vi, afterEach } from 'vitest';
import { NoOpReranker, MockReranker, ListwiseLLMReranker, CohereReranker } from './rerank.js';

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

  it('ListwiseLLMReranker parses model index arrays and falls back gracefully', async () => {
    const mockLLM = async () => {
      await Promise.resolve();
      return 'Here is the ranking: [2, 3, 1]';
    };
    const reranker = new ListwiseLLMReranker(mockLLM);

    const ranked = await reranker.rerank('Raft query', docs, 2);
    expect(ranked.length).toBe(2);
    expect(ranked[0]?.id).toBe('doc-2');
    expect(ranked[1]?.id).toBe('doc-3');

    // Test fallback on parse error
    const brokenLLM = async () => {
      await Promise.resolve();
      return 'No JSON returned';
    };
    const fallbackReranker = new ListwiseLLMReranker(brokenLLM);
    const fallbackRanked = await fallbackReranker.rerank('query', docs, 2);
    expect(fallbackRanked.length).toBe(2);
    expect(fallbackRanked[0]?.id).toBe('doc-1');
  });

  describe('CohereReranker', () => {
    it('throws error when apiKey is missing', async () => {
      const reranker = new CohereReranker('');
      await expect(reranker.rerank('query', docs, 2)).rejects.toThrow(/COHERE_API_KEY/);
    });

    it('reranks documents successfully with valid API response', async () => {
      const reranker = new CohereReranker('mock-cohere-key');
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => {
          await Promise.resolve();
          return {
            results: [
              { index: 1, relevance_score: 0.985 },
              { index: 2, relevance_score: 0.812 },
            ],
          };
        },
      } as unknown as Response);

      const ranked = await reranker.rerank('Raft query', docs, 2);
      expect(ranked.length).toBe(2);
      expect(ranked[0]?.id).toBe('doc-2');
      expect(ranked[0]?.score).toBe(0.985);
      expect(ranked[1]?.id).toBe('doc-3');
    });

    it('throws error when API returns non-OK status', async () => {
      const reranker = new CohereReranker('mock-cohere-key');
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: async () => {
          await Promise.resolve();
          return 'Internal Server Error';
        },
      } as unknown as Response);

      await expect(reranker.rerank('query', docs, 2)).rejects.toThrow(
        /Cohere rerank failed with status 500/,
      );
    });
  });
});
