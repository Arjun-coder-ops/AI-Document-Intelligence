import { describe, it, expect } from 'vitest';
import {
  computeRRFScore,
  fuseRRF,
  evaluateRelevanceThreshold,
  DEFAULT_NOT_FOUND_MESSAGE,
  verifyAndExtractCitations,
  buildRAGPrompt,
  sanitizeXml,
  executeHybridRetrieval,
  MockReranker,
  type DatabaseQueryExecutor,
  type PromptContextChunk,
} from './index.js';

describe('Level 4: Retrieval Quality & Math Verifications', () => {
  // ─── 1. RRF Math ─────────────────────────────────────────────────────────────
  describe('Reciprocal Rank Fusion (RRF)', () => {
    it('computes exact reciprocal rank scores for single-list items (1-indexed)', () => {
      // For k = 60, rank 1 score = 1 / (60 + 1) = 1 / 61
      const scoreRank1 = computeRRFScore(1, null, 60);
      expect(scoreRank1).toBeCloseTo(1 / 61, 6);

      // Rank 2 score = 1 / (60 + 2) = 1 / 62
      const scoreRank2 = computeRRFScore(2, null, 60);
      expect(scoreRank2).toBeCloseTo(1 / 62, 6);
      expect(scoreRank1).toBeGreaterThan(scoreRank2);
    });

    it('correctly sums reciprocal ranks when an item appears in both dense and lexical lists', () => {
      // Item appearing at rank 1 in dense AND rank 1 in lexical
      const fusedScore = computeRRFScore(1, 1, 60);
      const expected = 1 / 61 + 1 / 61;
      expect(fusedScore).toBeCloseTo(expected, 6);
    });

    it('ranks items present in both lists higher than items appearing in only one list', () => {
      const dense = [
        { id: 'doc-A', title: 'Doc A' },
        { id: 'doc-B', title: 'Doc B' },
      ];
      const lexical = [
        { id: 'doc-B', title: 'Doc B' },
        { id: 'doc-C', title: 'Doc C' },
      ];

      // doc-A is dense rank 1 (1/61 ~ 0.01639)
      // doc-B is dense rank 2 (1/62) + lexical rank 1 (1/61) ~ 0.03252
      // doc-C is lexical rank 2 (1/62 ~ 0.01613)
      const fused = fuseRRF(dense, lexical, 60);

      expect(fused[0]?.id).toBe('doc-B'); // Joint winner!
      expect(fused[1]?.id).toBe('doc-A');
      expect(fused[2]?.id).toBe('doc-C');

      expect(fused[0]?.rrfScore).toBeCloseTo(1 / 62 + 1 / 61, 6);
      expect(fused[1]?.rrfScore).toBeCloseTo(1 / 61, 6);
      expect(fused[2]?.rrfScore).toBeCloseTo(1 / 62, 6);
    });

    it('breaks ties deterministically by minimum rank and ID', () => {
      const dense = [{ id: 'doc-Z', title: 'Doc Z' }];
      const lexical = [{ id: 'doc-A', title: 'Doc A' }];

      // Both have identical score 1/61
      const fused = fuseRRF(dense, lexical, 60);
      expect(fused).toHaveLength(2);
      expect(fused[0]?.rrfScore).toEqual(fused[1]?.rrfScore);
      expect(fused[0]?.id).toBe('doc-A'); // Alphabetical tie-break
      expect(fused[1]?.id).toBe('doc-Z');
    });
  });

  // ─── 2. Threshold Short-Circuit ──────────────────────────────────────────────
  describe('Relevance Threshold Evaluation', () => {
    it('short-circuits when candidate scores are below threshold', () => {
      const lowScores = [0.005, 0.008, 0.002];
      const result = evaluateRelevanceThreshold(lowScores, 0.012);

      expect(result.passesThreshold).toBe(false);
      expect(result.topScore).toBe(0.008);
      expect(result.fallbackMessage).toBe(DEFAULT_NOT_FOUND_MESSAGE);
    });

    it('short-circuits immediately on empty candidates', () => {
      const result = evaluateRelevanceThreshold([], 0.012);

      expect(result.passesThreshold).toBe(false);
      expect(result.topScore).toBe(0);
      expect(result.fallbackMessage).toBe(DEFAULT_NOT_FOUND_MESSAGE);
    });

    it('passes when top candidate score equals or exceeds threshold', () => {
      const scores = [0.01, 0.025, 0.015];
      const result = evaluateRelevanceThreshold(scores, 0.012);

      expect(result.passesThreshold).toBe(true);
      expect(result.topScore).toBe(0.025);
      expect(result.fallbackMessage).toBeUndefined();
    });
  });

  // ─── 3. Citation Parsing & Verification ──────────────────────────────────────
  describe('Citation Verification and Hallucination Stripping', () => {
    const contextChunks: PromptContextChunk[] = [
      {
        citationIndex: 1,
        chunkId: '00000000-0000-0000-0000-000000000001',
        documentId: '10000000-0000-0000-0000-000000000001',
        documentTitle: 'Quarterly Report 2026',
        page: 3,
        section: 'Financials',
        content: 'Q3 net revenue exceeded $14.2M representing 22% year-over-year expansion.',
      },
      {
        citationIndex: 2,
        chunkId: '00000000-0000-0000-0000-000000000002',
        documentId: '10000000-0000-0000-0000-000000000001',
        documentTitle: 'Quarterly Report 2026',
        page: 4,
        section: 'Operating Margins',
        content: 'Gross margin improved by 180 basis points due to infrastructure optimization.',
      },
    ];

    it('correctly maps valid [n] markers to chunk metadata', () => {
      const response =
        'Revenue reached $14.2M in Q3 [1], while gross margins expanded by 180 bps [2].';

      const result = verifyAndExtractCitations(response, contextChunks);

      expect(result.verifiedCitations).toHaveLength(2);
      expect(result.hallucinatedIndices).toHaveLength(0);

      const [c1, c2] = result.verifiedCitations;
      expect(c1?.documentTitle).toBe('Quarterly Report 2026');
      expect(c1?.page).toBe(3);
      expect(c1?.snippet).toContain('Q3 net revenue');

      expect(c2?.documentTitle).toBe('Quarterly Report 2026');
      expect(c2?.page).toBe(4);
      expect(c2?.snippet).toContain('Gross margin improved');
    });

    it('identifies and strips hallucinated citation markers from output', () => {
      const responseWithHallucination =
        'Revenue hit $14.2M [1]. Furthermore, churn dropped to 0.4% [99].';

      const result = verifyAndExtractCitations(responseWithHallucination, contextChunks);

      expect(result.verifiedCitations).toHaveLength(1);
      expect(result.hallucinatedIndices).toEqual([99]);
      // Cleaned text should NOT contain the hallucinated [99]
      expect(result.cleanedText).toContain('[1]');
      expect(result.cleanedText).not.toContain('[99]');
    });

    it('deduplicates multiple mentions of the same citation marker', () => {
      const responseWithRepeats =
        'As confirmed by Q3 data [1], revenue grew significantly. Later in section 3 [1], details are elaborated.';

      const result = verifyAndExtractCitations(responseWithRepeats, contextChunks);

      expect(result.verifiedCitations).toHaveLength(1);
      expect(result.verifiedCitations[0]?.chunkId).toBe('00000000-0000-0000-0000-000000000001');
    });
  });

  // ─── 4. Prompt Sandboxing & Injection Defenses ───────────────────────────────
  describe('Prompt XML Sandboxing', () => {
    it('escapes dangerous XML characters in chunk content to prevent breakout', () => {
      const dangerousText = '<script>alert("hack")</script> & </context>';
      const sanitized = sanitizeXml(dangerousText);

      expect(sanitized).toBe(
        '&lt;script&gt;alert(&quot;hack&quot;)&lt;/script&gt; &amp; &lt;/context&gt;',
      );
      expect(sanitized).not.toContain('<script>');
      expect(sanitized).not.toContain('</context>');
    });

    it('generates system prompt containing untrusted data boundary rules', () => {
      const prompt = buildRAGPrompt('What were Q3 sales?', [
        {
          id: 'chunk-1',
          tenantId: 'tenant-1',
          documentId: 'doc-1',
          documentTitle: 'Sales.pdf',
          ordinal: 0,
          content: 'Sales totaled $10M.',
          tokenCount: 4,
          page: 1,
          section: 'Executive Summary',
          score: 0.9,
          source: 'dense',
        },
      ]);

      expect(prompt.systemPrompt).toContain('UNTRUSTED DATA BOUNDARY');
      expect(prompt.systemPrompt).toContain('GROUNDING CONSTRAINT');
      expect(prompt.systemPrompt).toContain('CITATION MANDATE');
      expect(prompt.userPrompt).toContain('<context>');
      expect(prompt.userPrompt).toContain(
        '<chunk id="1" document="Sales.pdf" page="1" section="Executive Summary">',
      );
      expect(prompt.userPrompt).toContain('Sales totaled $10M.');
    });
  });

  // ─── 5. Hybrid Retrieval Execution Pipeline ──────────────────────────────────
  describe('executeHybridRetrieval End-to-End Orchestration', () => {
    const mockExecutor: DatabaseQueryExecutor = {
      async queryDense(_tenantId, _emb, _limit, _efSearch) {
        await Promise.resolve();
        return [
          {
            id: 'c-1',
            tenantId: 't-1',
            documentId: 'd-1',
            documentTitle: 'Annual Report',
            ordinal: 0,
            content: 'Operating income grew to $50M.',
            tokenCount: 6,
            page: 1,
            section: 'Income',
            score: 0.88,
            source: 'dense',
          },
          {
            id: 'c-2',
            tenantId: 't-1',
            documentId: 'd-1',
            documentTitle: 'Annual Report',
            ordinal: 1,
            content: 'Research and development expenses totaled $12M.',
            tokenCount: 8,
            page: 2,
            section: 'R&D',
            score: 0.72,
            source: 'dense',
          },
        ];
      },
      async queryLexical(_tenantId, _query, _limit) {
        await Promise.resolve();
        return [
          {
            id: 'c-1',
            tenantId: 't-1',
            documentId: 'd-1',
            documentTitle: 'Annual Report',
            ordinal: 0,
            content: 'Operating income grew to $50M.',
            tokenCount: 6,
            page: 1,
            section: 'Income',
            score: 0.95,
            source: 'lexical',
          },
        ];
      },
    };

    it('orchestrates dense + lexical search with RRF and reranker', async () => {
      const reranker = new MockReranker();
      const result = await executeHybridRetrieval(
        't-1',
        'operating income',
        [0.1, 0.2, 0.3],
        mockExecutor,
        reranker,
        {
          hybrid: true,
          relevanceThreshold: 0.01,
          rerank: true,
          rerankTopK: 5,
        },
      );

      expect(result.shortCircuited).toBe(false);
      expect(result.chunks.length).toBeGreaterThan(0);
      expect(result.chunks[0]?.id).toBe('c-1');
    });

    it('short-circuits when results are below the tuned relevance cutoff', async () => {
      const result = await executeHybridRetrieval(
        't-1',
        'completely unrelated query',
        [0.1, 0.2, 0.3],
        mockExecutor,
        undefined,
        {
          hybrid: true,
          relevanceThreshold: 0.999, // Unattainably high cutoff to test short-circuit
        },
      );

      expect(result.shortCircuited).toBe(true);
      expect(result.chunks).toHaveLength(0);
      expect(result.fallbackMessage).toBe(DEFAULT_NOT_FOUND_MESSAGE);
    });
  });
});
