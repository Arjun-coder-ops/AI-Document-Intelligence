import { describe, it, expect } from 'vitest';
import { checkThresholds, type RetrievalMetrics, type EvalThresholds } from './index.js';

describe('Evaluation Harness Scaffold', () => {
  const thresholds: EvalThresholds = {
    recallAt1: 0.55,
    recallAt3: 0.75,
    recallAt5: 0.85,
    mrr: 0.7,
    ndcgAt5: 0.75,
    faithfulness: 0.9,
    answerRelevance: 0.85,
    unanswerableAbstentionAccuracy: 0.95,
  };

  it('passes when metrics meet thresholds', () => {
    const metrics: RetrievalMetrics = {
      recallAt1: 0.6,
      recallAt3: 0.8,
      recallAt5: 0.9,
      mrr: 0.75,
      ndcgAt5: 0.8,
    };
    const result = checkThresholds(metrics, thresholds);
    expect(result.passed).toBe(true);
    expect(result.failures).toHaveLength(0);
  });

  it('fails when metrics fall below thresholds', () => {
    const metrics: RetrievalMetrics = {
      recallAt1: 0.4,
      recallAt3: 0.6,
      recallAt5: 0.7,
      mrr: 0.5,
      ndcgAt5: 0.6,
    };
    const result = checkThresholds(metrics, thresholds);
    expect(result.passed).toBe(false);
    expect(result.failures.length).toBeGreaterThan(0);
  });
});
