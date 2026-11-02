import fs from 'fs';
import path from 'path';
import type { RetrievalEvalReport } from './types.js';
import { bootstrapConfidenceInterval } from './metrics.js';

export interface EvaluationCollector {
  recall1Values: number[];
  recall3Values: number[];
  recall5Values: number[];
  mrrValues: number[];
  ndcg5Values: number[];
  hitRateValues: number[];
  abstentionValues: number[];
  unanswerableAbstained: number;
  answerableAbstained: number;
  unanswerableTotal: number;
  perTypeRecall: Record<string, number[]>;
  latencies?: number[];
  estimatedCostPer1k?: number;
}

export function compileExperimentResult(
  collector: EvaluationCollector,
  baseDir: string,
  configName: string,
  allQuestionCount: number,
  testQuestionCount: number,
  heldOutCount: number,
  thresholdsFile: string = 'thresholds.json',
): RetrievalEvalReport {
  const {
    recall1Values,
    recall3Values,
    recall5Values,
    mrrValues,
    ndcg5Values,
    hitRateValues,
    abstentionValues,
    unanswerableAbstained,
    answerableAbstained,
    unanswerableTotal,
    perTypeRecall,
  } = collector;

  const thresholdsPath = path.join(baseDir, thresholdsFile);
  interface ThresholdsJson {
    recallAt1?: number;
    recallAt3?: number;
    recallAt5?: number;
    mrr?: number;
    ndcgAt5?: number;
    unanswerableAbstentionAccuracy?: number;
  }
  const thresholds = JSON.parse(fs.readFileSync(thresholdsPath, 'utf-8')) as ThresholdsJson;

  const r1CI = bootstrapConfidenceInterval(recall1Values);
  const r3CI = bootstrapConfidenceInterval(recall3Values);
  const r5CI = bootstrapConfidenceInterval(recall5Values);
  const mrrCI = bootstrapConfidenceInterval(mrrValues);
  const ndcg5CI = bootstrapConfidenceInterval(ndcg5Values);
  const hitCI = bootstrapConfidenceInterval(hitRateValues);
  const abstentionCI = bootstrapConfidenceInterval(abstentionValues);

  const abstentionPrecision =
    unanswerableAbstained + answerableAbstained > 0
      ? Number((unanswerableAbstained / (unanswerableAbstained + answerableAbstained)).toFixed(4))
      : 1.0;
  const abstentionRecall =
    unanswerableTotal > 0 ? Number((unanswerableAbstained / unanswerableTotal).toFixed(4)) : 1.0;

  const perTypeRecallAt5: Record<string, number> = {};
  for (const [t, vals] of Object.entries(perTypeRecall)) {
    perTypeRecallAt5[t] =
      vals.length > 0 ? Number((vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(4)) : 0;
  }

  const thresholdFailures: string[] = [];
  if (thresholds.recallAt5 && r5CI.mean < thresholds.recallAt5) {
    thresholdFailures.push(`Recall@5 (${r5CI.mean}) < required (${thresholds.recallAt5})`);
  }
  if (thresholds.mrr && mrrCI.mean < thresholds.mrr) {
    thresholdFailures.push(`MRR (${mrrCI.mean}) < required (${thresholds.mrr})`);
  }
  if (
    thresholds.unanswerableAbstentionAccuracy &&
    abstentionCI.mean < thresholds.unanswerableAbstentionAccuracy
  ) {
    thresholdFailures.push(
      `Abstention accuracy (${abstentionCI.mean}) < required (${thresholds.unanswerableAbstentionAccuracy})`,
    );
  }

  let latencyMs: { p50: number; p95: number; mean: number } | undefined;
  if (collector.latencies && collector.latencies.length > 0) {
    const sorted = [...collector.latencies].sort((a, b) => a - b);
    const p50 = sorted[Math.floor(sorted.length * 0.5)] ?? 0;
    const p95 = sorted[Math.floor(sorted.length * 0.95)] ?? 0;
    const mean = Number((sorted.reduce((a, b) => a + b, 0) / sorted.length).toFixed(2));
    latencyMs = { p50, p95, mean };
  }

  return {
    timestamp: new Date().toISOString(),
    configName,
    sampleCount: allQuestionCount,
    testSampleCount: testQuestionCount,
    heldOutSampleCount: heldOutCount,
    perTypeRecallAt5,
    metrics: {
      recallAt1: r1CI,
      recallAt3: r3CI,
      recallAt5: r5CI,
      mrr: mrrCI,
      ndcgAt5: ndcg5CI,
      hitRate: hitCI,
      unanswerableAbstentionAccuracy: abstentionCI,
      abstentionPrecision,
      abstentionRecall,
    },
    latencyMs,
    costPer1kQueries: collector.estimatedCostPer1k ?? 0,
    passedThresholds: thresholdFailures.length === 0,
    thresholdFailures,
  };
}
