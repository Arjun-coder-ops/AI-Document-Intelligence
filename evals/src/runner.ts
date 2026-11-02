import fs from 'fs';
import path from 'path';
import { fuseRRF } from '@docsage/rag';
import {
  calculateRecallAtK,
  calculateMRR,
  calculateNDCGAtK,
  calculateHitRate,
  bootstrapConfidenceInterval,
} from './metrics.js';
import type { GoldenQuestion, CorpusChunk, RetrievalEvalReport } from './types.js';
import { CORPUS, GOLDEN_QUESTIONS, writeDatasets } from './generate-dataset.js';

export interface EvalConfig {
  name: string;
  mode: 'baseline-dense' | 'dense' | 'lexical' | 'lexical-only' | 'hybrid' | 'hybrid-rerank';
  k?: number;
  rerankTopK?: number;
  relevanceThreshold?: number;
  denseThreshold?: number;
  lexicalThreshold?: number;
}

export function splitDataset(questions: GoldenQuestion[] = GOLDEN_QUESTIONS): {
  heldOut: GoldenQuestion[];
  testSet: GoldenQuestion[];
} {
  const unanswerable = questions.filter((q) => q.type === 'unanswerable');
  const factual = questions.filter((q) => q.type === 'factual');
  const multiHop = questions.filter((q) => q.type === 'multi-hop');
  const keyword = questions.filter((q) => q.type === 'keyword-exact');
  const paraphrased = questions.filter((q) => q.type === 'paraphrased');

  // 20 held-out questions for threshold tuning (not in test set)
  const heldOut = [
    ...unanswerable.slice(0, 5),
    ...factual.slice(0, 5),
    ...multiHop.slice(0, 3),
    ...keyword.slice(0, 3),
    ...paraphrased.slice(0, 4),
  ];
  const heldOutIds = new Set(heldOut.map((q) => q.id));
  const testSet = questions.filter((q) => !heldOutIds.has(q.id));

  return { heldOut, testSet };
}

export function computeCosineSimilarity(a: number[], b: number[]): number {
  let dot = 0;
  for (let i = 0; i < a.length; i++) {
    dot += (a[i] ?? 0) * (b[i] ?? 0);
  }
  return Number(dot.toFixed(4));
}

export function computeLexicalScore(query: string, content: string): number {
  const stopwords = new Set([
    'what',
    'is',
    'the',
    'in',
    'for',
    'of',
    'to',
    'a',
    'an',
    'and',
    'or',
    'by',
    'on',
    'with',
    'at',
    'how',
    'does',
    'do',
    'are',
    'from',
    'as',
    'that',
    'this',
    'their',
    'when',
    'which',
    'where',
  ]);

  const queryTokens = new Set(
    query
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .split(/\s+/)
      .filter((t) => t.length > 2 && !stopwords.has(t)),
  );

  if (queryTokens.size === 0) return 0;

  const contentTokens = content
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .split(/\s+/)
    .filter(Boolean);

  let matches = 0;
  for (const token of contentTokens) {
    if (queryTokens.has(token)) matches++;
  }

  // Term frequency normalized by doc length
  return matches / (contentTokens.length + 10);
}

export async function runRetrievalEvaluation(
  config: EvalConfig,
  corpus: CorpusChunk[] = CORPUS,
  allQuestions: GoldenQuestion[] = GOLDEN_QUESTIONS,
  baseDir: string = path.resolve(process.cwd(), 'evals'),
): Promise<RetrievalEvalReport> {
  await Promise.resolve();
  const fixturesPath = path.join(baseDir, 'fixtures', 'embeddings.json');
  if (!fs.existsSync(fixturesPath)) {
    writeDatasets(baseDir);
  }

  const rawFixtures = fs.readFileSync(fixturesPath, 'utf-8');
  const embeddingFixtures = JSON.parse(rawFixtures) as Record<string, number[]>;

  // Separate held-out calibration split from test split
  const { heldOut, testSet } = splitDataset(allQuestions);
  const questions = testSet;

  const recall1Values: number[] = [];
  const recall3Values: number[] = [];
  const recall5Values: number[] = [];
  const mrrValues: number[] = [];
  const ndcg5Values: number[] = [];
  const hitRateValues: number[] = [];
  const abstentionValues: number[] = [];

  const perTypeRecall: Record<string, number[]> = {
    factual: [],
    'multi-hop': [],
    'keyword-exact': [],
    paraphrased: [],
  };

  let unanswerableAbstained = 0;
  let unanswerableTotal = 0;
  let answerableAbstained = 0;

  // Calibrated thresholds tuned on held-out split
  const denseThreshold = config.denseThreshold ?? 0.58;
  const lexicalThreshold = config.lexicalThreshold ?? 0.08;

  for (const question of questions) {
    const isUnanswerable = question.type === 'unanswerable';
    const queryEmb = embeddingFixtures[question.id] ?? [];

    // 1. Dense retrieval
    const denseRanked = corpus.map((chunk) => {
      const chunkEmb = embeddingFixtures[chunk.id] ?? [];
      const score = computeCosineSimilarity(queryEmb, chunkEmb);
      return { id: chunk.id, content: chunk.content, score };
    });
    denseRanked.sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));

    // 2. Lexical retrieval
    const lexicalRanked = corpus.map((chunk) => {
      const score = computeLexicalScore(question.question, chunk.content);
      return { id: chunk.id, content: chunk.content, score };
    });
    lexicalRanked.sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));

    const topDenseScore = denseRanked[0]?.score ?? 0;
    const topLexicalScore = lexicalRanked[0]?.score ?? 0;

    let candidateIds: string[] = [];

    if (config.mode === 'baseline-dense' || config.mode === 'dense') {
      if (topDenseScore >= denseThreshold) {
        candidateIds = denseRanked.slice(0, 5).map((c) => c.id);
      }
    } else if (config.mode === 'lexical-only' || config.mode === 'lexical') {
      if (topLexicalScore >= lexicalThreshold) {
        candidateIds = lexicalRanked.slice(0, 5).map((c) => c.id);
      }
    } else if (config.mode === 'hybrid') {
      // Relevance short-circuit: must meet either dense or lexical threshold
      if (topDenseScore >= denseThreshold || topLexicalScore >= lexicalThreshold) {
        const fused = fuseRRF(denseRanked.slice(0, 25), lexicalRanked.slice(0, 25), config.k ?? 60);
        candidateIds = fused.slice(0, 5).map((c) => c.id);
      }
    } else if (config.mode === 'hybrid-rerank') {
      // Hybrid RRF with cross-scoring reranker
      if (topDenseScore >= denseThreshold || topLexicalScore >= lexicalThreshold) {
        const fused = fuseRRF(denseRanked.slice(0, 25), lexicalRanked.slice(0, 25), config.k ?? 60);
        // Calibrated cross-scoring: dense semantic match + lexical alignment
        const reranked = fused
          .slice(0, 20)
          .map((f) => {
            const denseMatch = denseRanked.find((d) => d.id === f.id)?.score ?? 0;
            const lexMatch = lexicalRanked.find((l) => l.id === f.id)?.score ?? 0;
            const score = 0.7 * denseMatch + 0.3 * (lexMatch * 5);
            return { id: f.id, score };
          })
          .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));

        candidateIds = reranked.slice(0, config.rerankTopK ?? 5).map((r) => r.id);
      }
    }

    if (isUnanswerable) {
      unanswerableTotal++;
      const abstained = candidateIds.length === 0 ? 1.0 : 0.0;
      if (abstained === 1.0) unanswerableAbstained++;
      abstentionValues.push(abstained);
    } else {
      if (candidateIds.length === 0) answerableAbstained++;

      const r1 = calculateRecallAtK(question.goldChunkIds, candidateIds, 1);
      const r3 = calculateRecallAtK(question.goldChunkIds, candidateIds, 3);
      const r5 = calculateRecallAtK(question.goldChunkIds, candidateIds, 5);
      const m = calculateMRR(question.goldChunkIds, candidateIds);
      const n5 = calculateNDCGAtK(question.goldChunkIds, candidateIds, 5);
      const hit = calculateHitRate(question.goldChunkIds, candidateIds, 5);

      recall1Values.push(r1);
      recall3Values.push(r3);
      recall5Values.push(r5);
      mrrValues.push(m);
      ndcg5Values.push(n5);
      hitRateValues.push(hit);

      if (perTypeRecall[question.type]) {
        perTypeRecall[question.type]?.push(r5);
      }
    }
  }

  // Load and check thresholds
  const thresholdsPath = path.join(baseDir, 'thresholds.json');
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

  return {
    timestamp: new Date().toISOString(),
    configName: config.name,
    sampleCount: allQuestions.length,
    testSampleCount: questions.length,
    heldOutSampleCount: heldOut.length,
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
    passedThresholds: thresholdFailures.length === 0,
    thresholdFailures,
  };
}
