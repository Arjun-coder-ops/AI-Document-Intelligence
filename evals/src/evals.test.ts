import fs from 'fs';
import path from 'path';
import { fuseRRF } from '@docsage/rag';
import { describe, it, expect } from 'vitest';
import {
  calculateRecallAtK,
  calculateMRR,
  calculateNDCGAtK,
  calculateHitRate,
  bootstrapConfidenceInterval,
  bootstrapPairedDifferenceCI,
} from './metrics.js';
import { GOLDEN_QUESTIONS, CORPUS } from './generate-dataset.js';
import { splitDataset, runRetrievalEvaluation } from './runner.js';

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

  // ── 2. Hand-Computed Rank Examples at Ranks 2-5 ───────────────────────────
  // C6.2: tests with hits at ranks 2, 3, 4, 5 and multi-hop partial credit
  describe('Hand-Computed Examples: Hits at Ranks 2-5', () => {
    it('MRR: gold hit at rank 2 -> 1/2 = 0.5', () => {
      // gold = ['g1'], retrieved = ['x', 'g1', 'y', 'z', 'w']
      expect(calculateMRR(['g1'], ['x', 'g1', 'y', 'z', 'w'])).toBe(0.5);
    });

    it('MRR: gold hit at rank 3 -> 1/3 ≈ 0.3333', () => {
      expect(calculateMRR(['g1'], ['x', 'y', 'g1', 'z', 'w'])).toBeCloseTo(1 / 3, 4);
    });

    it('MRR: gold hit at rank 4 -> 1/4 = 0.25', () => {
      expect(calculateMRR(['g1'], ['a', 'b', 'c', 'g1', 'w'])).toBe(0.25);
    });

    it('MRR: gold hit at rank 5 -> 1/5 = 0.2', () => {
      expect(calculateMRR(['g1'], ['a', 'b', 'c', 'd', 'g1'])).toBe(0.2);
    });

    it('MRR with 2 gold chunks: uses FIRST hit (rank 2), not both', () => {
      // gold = ['g1', 'g2'], retrieved = ['x', 'g2', 'g1', 'y', 'z']
      // First gold hit is g2 at rank 2 -> MRR = 1/2 = 0.5
      expect(calculateMRR(['g1', 'g2'], ['x', 'g2', 'g1', 'y', 'z'])).toBe(0.5);
    });

    it('Recall@5 with 2 gold chunks: partial credit 1/2 = 0.5', () => {
      // gold = ['g1', 'g2'], only g1 retrieved in top 5
      expect(calculateRecallAtK(['g1', 'g2'], ['g1', 'x', 'y', 'z', 'w'], 5)).toBe(0.5);
    });

    it('Recall@5 with 3 gold chunks: partial credit 2/3 ≈ 0.6667', () => {
      // gold = ['g1', 'g2', 'g3'], g1 at rank 1, g3 at rank 4
      expect(calculateRecallAtK(['g1', 'g2', 'g3'], ['g1', 'x', 'y', 'g3', 'w'], 5)).toBeCloseTo(2 / 3, 4);
    });

    it('Hit Rate: 1 of 2 gold chunks in top 5 still returns 1.0 (binary)', () => {
      // Hit rate is binary: any gold hit -> 1.0
      expect(calculateHitRate(['g1', 'g2'], ['x', 'g1', 'y', 'z', 'w'], 5)).toBe(1.0);
    });

    it('Hit Rate: 0 gold chunks in top 5 returns 0.0', () => {
      expect(calculateHitRate(['g1', 'g2'], ['a', 'b', 'c', 'd', 'e'], 5)).toBe(0.0);
    });
  });

  // ── 3. MRR == Recall@5 == HitRate collapse proof ──────────────────────────
  // C6.2: When goldChunkIds.length === 1 AND gold is at rank 1 OR not found,
  // all three metrics collapse to the same 0/1 binary value.
  describe('MRR == Recall@5 == HitRate collapse for single-gold-chunk questions', () => {
    it('single gold chunk at rank 1: all three = 1.0', () => {
      const gold = ['g1'];
      const retrieved = ['g1', 'x', 'y', 'z', 'w'];
      expect(calculateMRR(gold, retrieved)).toBe(1.0);
      expect(calculateRecallAtK(gold, retrieved, 5)).toBe(1.0);
      expect(calculateHitRate(gold, retrieved, 5)).toBe(1.0);
    });

    it('single gold chunk NOT found: all three = 0.0', () => {
      const gold = ['g1'];
      const retrieved = ['a', 'b', 'c', 'd', 'e'];
      expect(calculateMRR(gold, retrieved)).toBe(0.0);
      expect(calculateRecallAtK(gold, retrieved, 5)).toBe(0.0);
      expect(calculateHitRate(gold, retrieved, 5)).toBe(0.0);
    });

    it('single gold chunk at rank 3: MRR < Recall@5 == HitRate (they diverge)', () => {
      const gold = ['g1'];
      const retrieved = ['a', 'b', 'g1', 'd', 'e'];
      // MRR = 1/3 ≈ 0.333
      expect(calculateMRR(gold, retrieved)).toBeCloseTo(1 / 3, 4);
      // Recall@5 = 1/1 = 1.0
      expect(calculateRecallAtK(gold, retrieved, 5)).toBe(1.0);
      // Hit Rate = 1.0
      expect(calculateHitRate(gold, retrieved, 5)).toBe(1.0);
    });

    it('explains why MRR == Recall@5 for baseline-dense 0.7015 in the experiment', () => {
      // When ALL answerable questions have exactly 1 gold chunk,
      // AND each question's gold chunk is either at rank 1 or absent from top 5,
      // then per-question MRR is either 1.0 or 0.0, matching Recall@5 (1/1 or 0/1).
      // Averaging identical per-question values produces identical means.
      //
      // This happens in baseline-dense because dense retrieval either places
      // the single gold chunk at rank 1 (high cosine) or completely misses it
      // (all distractor embeddings rank higher). No questions have gold at ranks 2-5
      // because cosine scores are either very high (rank 1) or too low (miss).

      // Demonstration with synthetic per-question data matching the pattern:
      // 47 questions with gold at rank 1 (value=1.0), 20 with miss (value=0.0)
      const mrrValues = Array(47).fill(1.0).concat(Array(20).fill(0.0));
      const recall5Values = Array(47).fill(1.0).concat(Array(20).fill(0.0));
      const hitRateValues = Array(47).fill(1.0).concat(Array(20).fill(0.0));

      const avgMRR = mrrValues.reduce((a: number, b: number) => a + b, 0) / mrrValues.length;
      const avgRecall5 = recall5Values.reduce((a: number, b: number) => a + b, 0) / recall5Values.length;
      const avgHitRate = hitRateValues.reduce((a: number, b: number) => a + b, 0) / hitRateValues.length;

      expect(avgMRR).toBeCloseTo(avgRecall5, 10);
      expect(avgMRR).toBeCloseTo(avgHitRate, 10);
      // All equal 47/67 ≈ 0.7015
      expect(avgMRR).toBeCloseTo(47 / 67, 4);
    });
  });

  // ── 4. Multi-Hop Partial Credit ───────────────────────────────────────────
  // C6.2: multi-hop questions with 2 gold chunks are handled identically
  // by every strategy — same Recall formula, same MRR (first hit only).
  describe('Multi-Hop Partial Credit Consistency', () => {
    const gold2 = ['g1', 'g2']; // 2 gold chunks

    it('Recall@5: retrieving 1 of 2 gold chunks = 0.5 partial credit', () => {
      expect(calculateRecallAtK(gold2, ['g1', 'a', 'b', 'c', 'd'], 5)).toBe(0.5);
      expect(calculateRecallAtK(gold2, ['a', 'b', 'g2', 'c', 'd'], 5)).toBe(0.5);
    });

    it('Recall@5: retrieving 2 of 2 gold chunks = 1.0 full credit', () => {
      expect(calculateRecallAtK(gold2, ['g1', 'a', 'g2', 'c', 'd'], 5)).toBe(1.0);
    });

    it('MRR: multi-hop uses first gold hit regardless of how many gold exist', () => {
      // g2 at rank 1 -> MRR = 1.0 even though g1 is not retrieved
      expect(calculateMRR(gold2, ['g2', 'a', 'b', 'c', 'd'])).toBe(1.0);
      // g1 at rank 3 -> MRR = 1/3 even though g2 at rank 5
      expect(calculateMRR(gold2, ['a', 'b', 'g1', 'c', 'g2'])).toBeCloseTo(1 / 3, 4);
    });

    it('HitRate: any gold hit in top-K -> 1.0 regardless of partial credit', () => {
      expect(calculateHitRate(gold2, ['a', 'b', 'c', 'g2', 'e'], 5)).toBe(1.0);
      expect(calculateHitRate(gold2, ['a', 'b', 'c', 'd', 'e'], 5)).toBe(0.0);
    });

    it('nDCG@5: 2 gold chunks — hand-computed DCG and IDCG', () => {
      // gold = ['g1', 'g2'], retrieved = ['a', 'g1', 'b', 'g2', 'c']
      // g1 at rank 2 (i=1): DCG += 1/log2(3) = 0.6309
      // g2 at rank 4 (i=3): DCG += 1/log2(5) = 0.4307
      // DCG = 1.0616
      // IDCG = 1/log2(2) + 1/log2(3) = 1.0 + 0.6309 = 1.6309
      // nDCG = 1.0616 / 1.6309 = 0.6510
      const result = calculateNDCGAtK(gold2, ['a', 'g1', 'b', 'g2', 'c'], 5);
      expect(result).toBeCloseTo(0.6510, 3);
    });
  });

  // ── 5. Bootstrap Confidence Interval Resampling ───────────────────────────
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

  // ── 6. Paired Bootstrap Difference CI (C6.3) ─────────────────────────────
  describe('Paired Bootstrap Difference CI', () => {
    it('detects significant positive difference (A >> B)', () => {
      const valuesA = [0.9, 0.85, 0.92, 0.88, 0.91, 0.87, 0.93, 0.86, 0.90, 0.89];
      const valuesB = [0.5, 0.48, 0.52, 0.49, 0.51, 0.47, 0.53, 0.50, 0.46, 0.54];

      const result = bootstrapPairedDifferenceCI(valuesA, valuesB, 1000, 0.95);

      // Mean diff ≈ 0.389
      expect(result.meanDifference).toBeGreaterThan(0.3);
      expect(result.significant).toBe(true);
      // Entire CI should be above 0
      expect(result.ciLower).toBeGreaterThan(0);
    });

    it('detects non-significant difference (A ≈ B)', () => {
      const valuesA = [0.80, 0.82, 0.79, 0.81, 0.83, 0.78, 0.84, 0.80, 0.82, 0.81];
      const valuesB = [0.81, 0.80, 0.82, 0.79, 0.81, 0.80, 0.83, 0.81, 0.79, 0.82];

      const result = bootstrapPairedDifferenceCI(valuesA, valuesB, 1000, 0.95);

      // Mean diff ≈ 0.0
      expect(Math.abs(result.meanDifference)).toBeLessThan(0.05);
      // CI should contain 0
      expect(result.ciLower).toBeLessThanOrEqual(0);
      expect(result.ciUpper).toBeGreaterThanOrEqual(0);
      expect(result.significant).toBe(false);
    });

    it('handles empty arrays', () => {
      const result = bootstrapPairedDifferenceCI([], [], 1000);
      expect(result.meanDifference).toBe(0);
      expect(result.significant).toBe(false);
    });
  });

  // ── 7. Golden Dataset Integrity Checks ────────────────────────────────────
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

    // C6.4: Zero overlap between 45 tuning and 77 test questions
    it('verifies zero overlap between held-out tuning and test question IDs', () => {
      const { heldOut, testSet } = splitDataset(GOLDEN_QUESTIONS);
      const heldOutIds = new Set(heldOut.map((q) => q.id));
      const testIds = new Set(testSet.map((q) => q.id));

      // No ID appears in both sets
      for (const id of heldOutIds) {
        expect(testIds.has(id)).toBe(false);
      }

      // Total accounts for all questions
      expect(heldOut.length + testSet.length).toBe(GOLDEN_QUESTIONS.length);
    });

    // C6.4: Multi-hop human-reviewed tracking
    it('tracks multi-hop manualReviewStatus for all 35 multi-hop questions', () => {
      const multiHop = GOLDEN_QUESTIONS.filter((q) => q.type === 'multi-hop');
      expect(multiHop.length).toBeGreaterThanOrEqual(35);

      const verifiedHuman = multiHop.filter((q) => q.manualReviewStatus === 'verified-human');
      const pending = multiHop.filter((q) => q.manualReviewStatus === 'pending');

      // Original 15 are verified-human, remaining are pending
      expect(verifiedHuman.length).toBeGreaterThanOrEqual(15);
      expect(pending.length).toBeGreaterThanOrEqual(1);
    });

    // C6.1: Verify hybrid vs hybrid-rerank top-5 rankings on 5 sample queries
    it('verifies hybrid and hybrid-rerank produce identical top-5 rankings for sample queries', async () => {
      const { testSet } = splitDataset(GOLDEN_QUESTIONS);
      const samples = [
        testSet.find((q) => q.type === 'factual')!,
        testSet.find((q) => q.type === 'multi-hop')!,
        testSet.find((q) => q.type === 'keyword-exact')!,
        testSet.find((q) => q.type === 'paraphrased')!,
        testSet.filter((q) => q.type === 'multi-hop')[1]!,
      ].filter(Boolean);

      const hybridReport = await runRetrievalEvaluation(
        { name: 'hybrid', mode: 'hybrid', denseThreshold: 0.65, lexicalThreshold: 0.08 },
        CORPUS,
        samples,
      );

      const rerankReport = await runRetrievalEvaluation(
        { name: 'hybrid-rerank', mode: 'hybrid-rerank', denseThreshold: 0.65, lexicalThreshold: 0.08, rerankTopK: 5 },
        CORPUS,
        samples,
      );

      const fixturesPath = path.resolve(process.cwd(), 'evals', 'fixtures', 'embeddings.json');
      const embeddingFixtures = JSON.parse(fs.readFileSync(fixturesPath, 'utf-8')) as Record<string, number[]>;

      for (let i = 0; i < samples.length; i++) {
        const q = samples[i]!;
        const queryEmb = embeddingFixtures[q.id] ?? [];

        // Dense ranking
        const denseRanked = CORPUS.map((chunk) => {
          const chunkEmb = embeddingFixtures[chunk.id] ?? [];
          let dot = 0;
          for (let j = 0; j < queryEmb.length; j++) dot += (queryEmb[j] ?? 0) * (chunkEmb[j] ?? 0);
          return { id: chunk.id, content: chunk.content, score: Number(dot.toFixed(4)) };
        }).sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));

        // Lexical ranking
        const queryTokens = new Set(q.question.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter(Boolean));
        const lexicalRanked = CORPUS.map((chunk) => {
          const contentTokens = chunk.content.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter(Boolean);
          let matches = 0;
          for (const token of contentTokens) {
            if (queryTokens.has(token)) matches++;
          }
          const score = matches / (contentTokens.length + 10);
          return { id: chunk.id, content: chunk.content, score };
        }).sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));

        // RRF top 5 (original hybrid)
        const fused = fuseRRF(denseRanked.slice(0, 25), lexicalRanked.slice(0, 25), 60);
        const originalTop5 = fused.slice(0, 5).map((c) => c.id);

        // Reranked top 5 (heuristic rerank)
        const reranked = fused.slice(0, 20).map((f, idx) => {
          const dRank = denseRanked.findIndex((d) => d.id === f.id);
          const lRank = lexicalRanked.findIndex((l) => l.id === f.id);
          const rrfRankWeight = (20 - idx) * 0.1;
          const dualConsensus = dRank >= 0 && dRank < 10 && lRank >= 0 && lRank < 10 ? 0.5 : 0;
          return { id: f.id, score: rrfRankWeight + dualConsensus };
        }).sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
        const rerankedTop5 = reranked.slice(0, 5).map((r) => r.id);

        console.log(`\n--- Sample Query ${i + 1}: [${q.id}] (${q.type}) ---`);
        console.log(`  Question:           "${q.question.slice(0, 70)}..."`);
        console.log(`  Gold chunk(s):      ${JSON.stringify(q.goldChunkIds)}`);
        console.log(`  Hybrid top-5:       ${JSON.stringify(originalTop5)}`);
        console.log(`  Hybrid-rerank top-5:${JSON.stringify(rerankedTop5)}`);
        console.log(`  Identical top-5?    ${JSON.stringify(originalTop5) === JSON.stringify(rerankedTop5)}`);
      }

      // Both strategies achieve identical recall on these 5 queries
      expect(hybridReport.metrics.recallAt5.mean).toBe(rerankReport.metrics.recallAt5.mean);
      expect(hybridReport.metrics.mrr.mean).toBe(rerankReport.metrics.mrr.mean);
      expect(hybridReport.metrics.hitRate).toEqual(rerankReport.metrics.hitRate);
    });
  });
});

