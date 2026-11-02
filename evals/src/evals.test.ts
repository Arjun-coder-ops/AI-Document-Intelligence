import { describe, it, expect } from 'vitest';
import {
  calculateRecallAtK,
  calculateMRR,
  calculateNDCGAtK,
  calculateHitRate,
  bootstrapConfidenceInterval,
} from './metrics.js';
import { GOLDEN_QUESTIONS, CORPUS } from './generate-dataset.js';
import { splitDataset } from './runner.js';

describe('Level 6: Evaluation Harness & Metrics Verification', () => {
  // ── 1. Information Retrieval Metrics Math ─────────────────────────────────
  describe('IR Metrics Math', () => {
    const goldChunks = ['c-1', 'c-3'];

    it('calculates exact Recall@K', () => {
      // Top 1 retrieves c-1 (1 of 2 gold chunks) -> 0.5
      expect(calculateRecallAtK(goldChunks, ['c-1', 'c-2', 'c-3'], 1)).toBe(0.5);

      // Top 3 retrieves c-1 and c-3 (2 of 2 gold chunks) -> 1.0
      expect(calculateRecallAtK(goldChunks, ['c-1', 'c-2', 'c-3'], 3)).toBe(1.0);

      // Top 2 retrieves c-2 and c-4 (0 of 2 gold chunks) -> 0.0
      expect(calculateRecallAtK(goldChunks, ['c-2', 'c-4'], 2)).toBe(0.0);
    });

    it('calculates Mean Reciprocal Rank (MRR)', () => {
      // First gold chunk is at index 0 (rank 1) -> 1/1 = 1.0
      expect(calculateMRR(goldChunks, ['c-1', 'c-2', 'c-3'])).toBe(1.0);

      // First gold chunk is at index 1 (rank 2) -> 1/2 = 0.5
      expect(calculateMRR(goldChunks, ['c-2', 'c-3', 'c-1'])).toBe(0.5);

      // No gold chunk found -> 0.0
      expect(calculateMRR(goldChunks, ['c-9', 'c-8'])).toBe(0.0);
    });

    it('calculates Normalized Discounted Cumulative Gain (nDCG@K)', () => {
      // Perfect ranking: gold chunks at ranks 1 and 2
      const perfect = calculateNDCGAtK(goldChunks, ['c-1', 'c-3', 'c-2'], 5);
      expect(perfect).toBeCloseTo(1.0, 5);

      // Imperfect ranking: gold chunks at ranks 2 and 4
      const lower = calculateNDCGAtK(goldChunks, ['c-2', 'c-1', 'c-9', 'c-3'], 5);
      expect(lower).toBeLessThan(1.0);
      expect(lower).toBeGreaterThan(0.0);
    });

    it('calculates Hit Rate', () => {
      expect(calculateHitRate(goldChunks, ['c-1', 'c-2'], 1)).toBe(1.0);
      expect(calculateHitRate(goldChunks, ['c-2', 'c-9'], 2)).toBe(0.0);
    });
  });

  // ── 2. Bootstrap Confidence Interval Resampling ───────────────────────────
  describe('Bootstrap 95% Confidence Intervals', () => {
    it('produces tight, reproducible confidence intervals around the sample mean', () => {
      const data = [0.8, 0.85, 0.9, 0.82, 0.88, 0.87, 0.89, 0.84, 0.86, 0.91];
      const ci = bootstrapConfidenceInterval(data, 1000, 0.95);

      expect(ci.mean).toBeCloseTo(0.862, 2);
      expect(ci.ciLower).toBeLessThanOrEqual(ci.mean);
      expect(ci.ciUpper).toBeGreaterThanOrEqual(ci.mean);
      expect(ci.ciLower).toBeGreaterThan(0.75);
      expect(ci.ciUpper).toBeLessThan(0.95);
    });
  });

  // ── 3. Golden Dataset Integrity Checks ────────────────────────────────────
  describe('Golden Dataset Compliance', () => {
    it('contains at least 60 total questions and at least 20 unanswerables', () => {
      expect(GOLDEN_QUESTIONS.length).toBeGreaterThanOrEqual(60);

      const unanswerables = GOLDEN_QUESTIONS.filter((q) => q.type === 'unanswerable');
      expect(unanswerables.length).toBeGreaterThanOrEqual(20);

      const factual = GOLDEN_QUESTIONS.filter((q) => q.type === 'factual');
      expect(factual.length).toBeGreaterThanOrEqual(20);

      const multiHop = GOLDEN_QUESTIONS.filter((q) => q.type === 'multi-hop');
      expect(multiHop.length).toBeGreaterThanOrEqual(30);

      const keyword = GOLDEN_QUESTIONS.filter((q) => q.type === 'keyword-exact');
      expect(keyword.length).toBeGreaterThanOrEqual(10);
    });

    it('creates a held-out split of at least 40 questions with disjoint test set', () => {
      const { heldOut, testSet } = splitDataset(GOLDEN_QUESTIONS);

      expect(heldOut.length).toBeGreaterThanOrEqual(40);
      expect(testSet.length).toBeGreaterThanOrEqual(50);

      const heldOutIds = new Set(heldOut.map((q) => q.id));
      for (const t of testSet) {
        expect(heldOutIds.has(t.id)).toBe(false);
      }
    });

    it('ensures all answerable questions reference valid corpus chunk IDs', () => {
      const corpusChunkIds = new Set(CORPUS.map((c) => c.id));

      for (const q of GOLDEN_QUESTIONS) {
        if (q.type !== 'unanswerable') {
          expect(q.goldChunkIds.length).toBeGreaterThan(0);
          for (const goldId of q.goldChunkIds) {
            expect(corpusChunkIds.has(goldId)).toBe(true);
          }
        }
      }
    });
  });
});
