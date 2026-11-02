import fs from 'fs';
import path from 'path';
import { fuseRRF, extractQueryTokens, extractDocumentTokens } from '@docsage/rag';
import { calculateRecallAtK, calculateMRR, calculateNDCGAtK, calculateHitRate } from './metrics.js';
import type { GoldenQuestion, CorpusChunk, RetrievalEvalReport } from './types.js';
import { CORPUS, GOLDEN_QUESTIONS, writeDatasets } from './generate-dataset.js';
import { compileExperimentResult } from './report.js';

export interface EvalConfig {
  name: string;
  mode: 'baseline-dense' | 'dense' | 'lexical' | 'lexical-only' | 'hybrid' | 'hybrid-rerank';
  k?: number;
  rerankTopK?: number;
  relevanceThreshold?: number;
  denseThreshold?: number;
  lexicalThreshold?: number;
}

export { runAbstentionSweep } from './abstention.js';

export function splitDataset(questions: GoldenQuestion[] = GOLDEN_QUESTIONS): {
  heldOut: GoldenQuestion[];
  testSet: GoldenQuestion[];
} {
  const unanswerable = questions.filter((q) => q.type === 'unanswerable');
  const factual = questions.filter((q) => q.type === 'factual');
  const multiHop = questions.filter((q) => q.type === 'multi-hop');
  const keyword = questions.filter((q) => q.type === 'keyword-exact');
  const paraphrased = questions.filter((q) => q.type === 'paraphrased');

  // 45 held-out questions for threshold tuning (>= 40 required by C3)
  const heldOut = [
    ...unanswerable.slice(0, 15),
    ...factual.slice(0, 10),
    ...multiHop.slice(0, 10),
    ...keyword.slice(0, 4),
    ...paraphrased.slice(0, 6),
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
  const queryTokens = extractQueryTokens(query);
  if (queryTokens.size === 0) return 0;

  const contentTokens = extractDocumentTokens(content);
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
  const latencies: number[] = [];

  const costMap: Record<string, number> = {
    'lexical-only': 0.0,
    lexical: 0.0,
    'baseline-dense': 0.02,
    dense: 0.02,
    hybrid: 0.02,
    'hybrid-rerank': 0.13,
  };
  const estimatedCostPer1k = costMap[config.mode] ?? 0.02;

  // Calibrated thresholds tuned on held-out split
  const denseThreshold = config.denseThreshold ?? 0.58;
  const lexicalThreshold = config.lexicalThreshold ?? 0.08;

  for (const question of questions) {
    const startTime = performance.now();
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
      // Hybrid RRF with listwise consensus reranker
      if (topDenseScore >= denseThreshold || topLexicalScore >= lexicalThreshold) {
        const fused = fuseRRF(denseRanked.slice(0, 25), lexicalRanked.slice(0, 25), config.k ?? 60);
        // Listwise consensus scoring: preserves RRF ranking and rewards dual-retrieval consensus
        const reranked = fused
          .slice(0, 20)
          .map((f, idx) => {
            const dRank = denseRanked.findIndex((d) => d.id === f.id);
            const lRank = lexicalRanked.findIndex((l) => l.id === f.id);
            const rrfRankWeight = (20 - idx) * 0.1;
            const dualConsensus = dRank >= 0 && dRank < 10 && lRank >= 0 && lRank < 10 ? 0.5 : 0;
            const score = rrfRankWeight + dualConsensus;
            return { id: f.id, score };
          })
          .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));

        candidateIds = reranked.slice(0, config.rerankTopK ?? 5).map((r) => r.id);
      }
    }

    const elapsed = performance.now() - startTime;
    latencies.push(Number(elapsed.toFixed(2)));

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

  return compileExperimentResult(
    {
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
      latencies,
      estimatedCostPer1k,
    },
    baseDir,
    config.name,
    allQuestions.length,
    questions.length,
    heldOut.length,
  );
}
