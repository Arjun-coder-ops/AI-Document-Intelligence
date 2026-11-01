export interface EvalThresholds {
  recallAt1: number;
  recallAt3: number;
  recallAt5: number;
  mrr: number;
  ndcgAt5: number;
  faithfulness: number;
  answerRelevance: number;
  unanswerableAbstentionAccuracy: number;
}

export interface RetrievalMetrics {
  recallAt1: number;
  recallAt3: number;
  recallAt5: number;
  mrr: number;
  ndcgAt5: number;
}

export function checkThresholds(
  metrics: RetrievalMetrics,
  thresholds: EvalThresholds,
): { passed: boolean; failures: string[] } {
  const failures: string[] = [];

  if (metrics.recallAt5 < thresholds.recallAt5) {
    failures.push(`Recall@5 ${metrics.recallAt5.toFixed(3)} < threshold ${thresholds.recallAt5}`);
  }
  if (metrics.mrr < thresholds.mrr) {
    failures.push(`MRR ${metrics.mrr.toFixed(3)} < threshold ${thresholds.mrr}`);
  }

  return {
    passed: failures.length === 0,
    failures,
  };
}
