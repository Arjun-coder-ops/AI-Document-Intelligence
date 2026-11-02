import { describe, it, expect } from 'vitest';
import { computeRRFScore, calculateRRF, fuseRRF } from './rrf.js';

describe('Phase 1 - Reciprocal Rank Fusion (RRF) Mathematical Audit', () => {
  // ─── 1. Exact Hand-Computed Scores (1-indexed base) ─────────────────────────
  describe('Hand-Computed RRF Score Formulas', () => {
    it('calculates exact 1-indexed formula: 1 / (k + rank) with default k=60', () => {
      // Hand calculation for k = 60:
      // Rank 1: 1 / (60 + 1) = 1 / 61 = 0.01639344262295082
      const r1 = computeRRFScore(1, null, 60);
      expect(r1).toBeCloseTo(1 / 61, 10);
      expect(r1).toBeCloseTo(0.0163934426, 8);

      // Rank 2: 1 / (60 + 2) = 1 / 62 = 0.016129032258064516
      const r2 = computeRRFScore(2, null, 60);
      expect(r2).toBeCloseTo(1 / 62, 10);
      expect(r2).toBeCloseTo(0.0161290323, 8);

      // Rank 5: 1 / (60 + 5) = 1 / 65 = 0.015384615384615385
      const r5 = computeRRFScore(5, null, 60);
      expect(r5).toBeCloseTo(1 / 65, 10);

      // Strict monotonicity: Rank 1 > Rank 2 > Rank 5
      expect(r1).toBeGreaterThan(r2);
      expect(r2).toBeGreaterThan(r5);
    });

    it('verifies rank base is strictly 1-indexed and handles rank 0 / null safely', () => {
      // In 1-indexed RRF, rank 0 is invalid/non-existent and must not inflate the score
      expect(computeRRFScore(0, null, 60)).toBe(0);
      expect(computeRRFScore(-1, null, 60)).toBe(0);
      expect(computeRRFScore(null, null, 60)).toBe(0);

      // If an item was at 0-index in array, fuseRRF assigns rank = index + 1 (i.e. rank 1, score 1/61)
      // Confirm that rank 1 evaluates to 1/(60+1), NOT 1/(60+0) which would be 1/60
      const scoreRank1 = computeRRFScore(1, null, 60);
      expect(scoreRank1).not.toBeCloseTo(1 / 60, 6);
      expect(scoreRank1).toBeCloseTo(1 / 61, 6);
    });

    it('hand-computes combined score when item appears in both dense and lexical lists', () => {
      // Item A: dense rank 2, lexical rank 3, k = 60
      // Hand calculation:
      // dense component   = 1 / (60 + 2) = 1 / 62 ≈ 0.0161290323
      // lexical component = 1 / (60 + 3) = 1 / 63 ≈ 0.0158730159
      // Total RRF score   = 1/62 + 1/63 = (63 + 62) / (62 * 63) = 125 / 3906 ≈ 0.0320020481
      const fusedScore = computeRRFScore(2, 3, 60);
      const expected = 1 / 62 + 1 / 63;
      expect(fusedScore).toBeCloseTo(expected, 10);
      expect(fusedScore).toBeCloseTo(0.0320020481, 8);
    });

    it('supports custom smoothing parameter k', () => {
      // When k = 20:
      // Rank 1 in dense: 1 / (20 + 1) = 1 / 21 ≈ 0.0476190476
      const scoreK20 = computeRRFScore(1, null, 20);
      expect(scoreK20).toBeCloseTo(1 / 21, 10);
    });
  });

  // ─── 2. Deduplication and Candidate Preservation ─────────────────────────────
  describe('fuseRRF Deduplication & Candidate Retention', () => {
    it('deduplicates chunk IDs across both lists and preserves unified chunk records', () => {
      const dense = [
        { id: 'chunk-1', content: 'Dense match 1' },
        { id: 'chunk-2', content: 'Dense match 2' },
      ];
      const lexical = [
        { id: 'chunk-2', content: 'Dense match 2' },
        { id: 'chunk-3', content: 'Lexical match 3' },
      ];

      const fused = fuseRRF(dense, lexical, 60);

      // Total distinct candidates must be exactly 3 (chunk-1, chunk-2, chunk-3)
      expect(fused).toHaveLength(3);
      const ids = fused.map((c) => c.id);
      expect(new Set(ids).size).toBe(3);

      // chunk-2 appeared in both: dense rank 2, lexical rank 1
      // Score = 1 / (60 + 2) + 1 / (60 + 1) = 1/62 + 1/61 ≈ 0.0325224749
      const chunk2 = fused.find((c) => c.id === 'chunk-2');
      expect(chunk2).toBeDefined();
      expect(chunk2?.denseRank).toBe(2);
      expect(chunk2?.lexicalRank).toBe(1);
      expect(chunk2?.rrfScore).toBeCloseTo(1 / 62 + 1 / 61, 8);

      // chunk-2 must be ranked first because it appeared in both lists
      expect(fused[0]?.id).toBe('chunk-2');
    });

    it('retains candidates from BOTH lists even when disjoint', () => {
      const dense = [
        { id: 'd-1', content: 'Dense only 1' },
        { id: 'd-2', content: 'Dense only 2' },
        { id: 'd-3', content: 'Dense only 3' },
      ];
      const lexical = [
        { id: 'l-1', content: 'Lexical only 1' },
        { id: 'l-2', content: 'Lexical only 2' },
      ];

      const fused = fuseRRF(dense, lexical, 60);

      // All 5 candidates must be present
      expect(fused).toHaveLength(5);
      const fusedIds = fused.map((c) => c.id);
      expect(fusedIds).toContain('d-1');
      expect(fusedIds).toContain('d-2');
      expect(fusedIds).toContain('d-3');
      expect(fusedIds).toContain('l-1');
      expect(fusedIds).toContain('l-2');

      // Dense-only candidate has null lexicalRank
      const d1 = fused.find((c) => c.id === 'd-1');
      expect(d1?.denseRank).toBe(1);
      expect(d1?.lexicalRank).toBeNull();
      expect(d1?.rrfScore).toBeCloseTo(1 / 61, 8);

      // Lexical-only candidate has null denseRank
      const l1 = fused.find((c) => c.id === 'l-1');
      expect(l1?.denseRank).toBeNull();
      expect(l1?.lexicalRank).toBe(1);
      expect(l1?.rrfScore).toBeCloseTo(1 / 61, 8);
    });

    it('handles empty dense list gracefully (pure lexical fallback)', () => {
      const dense: Array<{ id: string }> = [];
      const lexical = [{ id: 'l-1' }, { id: 'l-2' }];

      const fused = fuseRRF(dense, lexical, 60);
      expect(fused).toHaveLength(2);
      expect(fused[0]?.id).toBe('l-1');
      expect(fused[0]?.denseRank).toBeNull();
      expect(fused[0]?.lexicalRank).toBe(1);
      expect(fused[0]?.rrfScore).toBeCloseTo(1 / 61, 8);
    });

    it('handles empty lexical list gracefully (pure dense fallback)', () => {
      const dense = [{ id: 'd-1' }, { id: 'd-2' }];
      const lexical: Array<{ id: string }> = [];

      const fused = fuseRRF(dense, lexical, 60);
      expect(fused).toHaveLength(2);
      expect(fused[0]?.id).toBe('d-1');
      expect(fused[0]?.denseRank).toBe(1);
      expect(fused[0]?.lexicalRank).toBeNull();
      expect(fused[0]?.rrfScore).toBeCloseTo(1 / 61, 8);
    });

    it('breaks ties deterministically by minimum rank and chunk ID', () => {
      // Two items with identical score:
      // Item 'chunk-beta' at dense rank 1 (1/61)
      // Item 'chunk-alpha' at lexical rank 1 (1/61)
      const dense = [{ id: 'chunk-beta' }];
      const lexical = [{ id: 'chunk-alpha' }];

      const fused = fuseRRF(dense, lexical, 60);
      expect(fused).toHaveLength(2);
      expect(fused[0]?.rrfScore).toBeCloseTo(fused[1]?.rrfScore ?? 0, 10);
      // Min ranks are equal (both 1), so alphabetical tie-breaker applies: chunk-alpha < chunk-beta
      expect(fused[0]?.id).toBe('chunk-alpha');
      expect(fused[1]?.id).toBe('chunk-beta');
    });

    it('tests calculateRRF map-based helper directly', () => {
      const denseRanks = new Map<string, number>([
        ['c1', 1],
        ['c2', 2],
      ]);
      const lexicalRanks = new Map<string, number>([
        ['c2', 1],
        ['c3', 3],
      ]);

      const scores = calculateRRF(denseRanks, lexicalRanks, 60);
      expect(scores.size).toBe(3);
      expect(scores.get('c1')).toBeCloseTo(1 / 61, 8);
      expect(scores.get('c2')).toBeCloseTo(1 / 62 + 1 / 61, 8);
      expect(scores.get('c3')).toBeCloseTo(1 / 63, 8);
    });
  });
});
