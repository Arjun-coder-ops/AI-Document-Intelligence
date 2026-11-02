export type QuestionType =
  'factual' | 'multi-hop' | 'keyword-exact' | 'unanswerable' | 'paraphrased';

export interface GoldenQuestion {
  id: string;
  question: string;
  expectedAnswer: string;
  goldChunkIds: string[];
  type: QuestionType;
  manualReviewStatus?: 'verified-human' | 'pending' | 'unverified';
}

export interface CorpusChunk {
  id: string;
  documentTitle: string;
  section: string;
  page: number;
  content: string;
  tokens: number;
}

export interface MetricConfidenceInterval {
  mean: number;
  ciLower: number;
  ciUpper: number;
}

export interface RetrievalEvalReport {
  timestamp: string;
  configName: string;
  sampleCount: number;
  testSampleCount?: number;
  heldOutSampleCount?: number;
  perTypeRecallAt5?: Record<string, number>;
  metrics: {
    recallAt1: MetricConfidenceInterval;
    recallAt3: MetricConfidenceInterval;
    recallAt5: MetricConfidenceInterval;
    mrr: MetricConfidenceInterval;
    ndcgAt5: MetricConfidenceInterval;
    hitRate: MetricConfidenceInterval;
    unanswerableAbstentionAccuracy: MetricConfidenceInterval;
    abstentionPrecision?: number;
    abstentionRecall?: number;
  };
  passedThresholds: boolean;
  thresholdFailures: string[];
}

export interface GenerationEvalMetrics {
  faithfulness: number;
  answerRelevance: number;
  citationCorrectness: number;
  unanswerableAbstentionAccuracy: number;
}

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
