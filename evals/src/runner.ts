import fs from 'fs';
import path from 'path';
import { fuseRRF, MockReranker, evaluateRelevanceThreshold } from '@docsage/rag';
import {
  calculateRecallAtK,
  calculateMRR,
  calculateNDCGAtK,
  calculateHitRate,
  bootstrapConfidenceInterval,
} from './metrics.js';
import type {
  GoldenQuestion,
  CorpusChunk,
  RetrievalEvalReport,
} from './types.js';
import { CORPUS, GOLDEN_QUESTIONS, writeDatasets } from './generate-dataset.js';

export interface EvalConfig {
  name: string;
  mode: 'dense' | 'lexical' | 'hybrid' | 'hybrid-rerank';
  k?: number;
  rerankTopK?: number;
  relevanceThreshold?: number;
}

export function computeCosineSimilarity(a: number[], b: number[]): number {
  let dot = 0;
  for (let i = 0; i < a.length; i++) {
    dot += (a[i] ?? 0) * (b[i] ?? 0);
  }
  return Number(dot.toFixed(4));
}

export function computeLexicalScore(query: string, content: string): number {
  const queryTokens = new Set(
    query
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .split(/\s+/)
      .filter((t) => t.length > 2),
  );

  if (queryTokens.size === 0) return 0;

  const contentTokens = content
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .split(/\s+/);

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
  questions: GoldenQuestion[] = GOLDEN_QUESTIONS,
  baseDir: string = path.resolve(process.cwd(), 'evals'),
): Promise<RetrievalEvalReport> {
  // Ensure datasets and fixtures are written
  const fixturesPath = path.join(baseDir, 'fixtures', 'embeddings.json');
  if (!fs.existsSync(fixturesPath)) {
    writeDatasets(baseDir);
  }

  const rawFixtures = fs.readFileSync(fixturesPath, 'utf-8');
  const embeddingFixtures = JSON.parse(rawFixtures) as Record<string, number[]>;

  const reranker = new MockReranker();

  const recall1Values: number[] = [];
  const recall3Values: number[] = [];
  const recall5Values: number[] = [];
  const mrrValues: number[] = [];
  const ndcg5Values: number[] = [];
  const hitRateValues: number[] = [];
  const abstentionValues: number[] = [];

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

    let candidateIds: string[] = [];
    let topScore = 0;

    if (config.mode === 'dense') {
      candidateIds = denseRanked.slice(0, 25).map((c) => c.id);
      topScore = denseRanked[0]?.score ?? 0;
    } else if (config.mode === 'lexical') {
      candidateIds = lexicalRanked.slice(0, 25).map((c) => c.id);
      topScore = lexicalRanked[0]?.score ?? 0;
    } else if (config.mode === 'hybrid') {
      const fused = fuseRRF(denseRanked.slice(0, 25), lexicalRanked.slice(0, 25), config.k ?? 60);
      candidateIds = fused.map((c) => c.id);
      topScore = fused[0]?.rrfScore ?? 0;
    } else if (config.mode === 'hybrid-rerank') {
      const fused = fuseRRF(denseRanked.slice(0, 25), lexicalRanked.slice(0, 25), config.k ?? 60);
      const candidatesToRerank = fused.slice(0, 20).map((f) => {
        const found = corpus.find((c) => c.id === f.id);
        return { id: f.id, content: found?.content ?? '' };
      });
      const reranked = await reranker.rerank(
        question.question,
        candidatesToRerank,
        config.rerankTopK ?? 5,
      );
      candidateIds = reranked.map((r) => r.id);
      topScore = reranked[0]?.score ?? 0;
    }

    // Relevance threshold check
    const threshold = config.relevanceThreshold ?? 0.01;
    const thresholdEval = evaluateRelevanceThreshold([topScore], threshold);

    if (!thresholdEval.passesThreshold) {
      candidateIds = [];
    }

    if (isUnanswerable) {
      // For unanswerable questions, abstaining (retrieving 0 chunks) is the correct outcome
      const abstained = candidateIds.length === 0 ? 1.0 : 0.0;
      abstentionValues.push(abstained);
    } else {
      recall1Values.push(calculateRecallAtK(question.goldChunkIds, candidateIds, 1));
      recall3Values.push(calculateRecallAtK(question.goldChunkIds, candidateIds, 3));
      recall5Values.push(calculateRecallAtK(question.goldChunkIds, candidateIds, 5));
      mrrValues.push(calculateMRR(question.goldChunkIds, candidateIds));
      ndcg5Values.push(calculateNDCGAtK(question.goldChunkIds, candidateIds, 5));
      hitRateValues.push(calculateHitRate(question.goldChunkIds, candidateIds, 5));
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
    sampleCount: questions.length,
    metrics: {
      recallAt1: r1CI,
      recallAt3: r3CI,
      recallAt5: r5CI,
      mrr: mrrCI,
      ndcgAt5: ndcg5CI,
      hitRate: hitCI,
      unanswerableAbstentionAccuracy: abstentionCI,
    },
    passedThresholds: thresholdFailures.length === 0,
    thresholdFailures,
  };
}
