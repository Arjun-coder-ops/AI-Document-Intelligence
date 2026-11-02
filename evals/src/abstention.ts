import fs from 'fs';
import path from 'path';
import type { GoldenQuestion, CorpusChunk } from './types.js';
import { computeCosineSimilarity, computeLexicalScore } from './runner.js';

export interface AbstentionSweepPoint {
  denseThreshold: number;
  lexicalThreshold: number;
  unanswerableTotal: number;
  unanswerableAbstained: number;
  trueAbstentionRate: number;
  answerableTotal: number;
  answerableAbstained: number;
  falseAbstentionRate: number;
  precision: number;
  recall: number;
  f1Score: number;
}

export interface AbstentionSweepReport {
  timestamp: string;
  heldOutCount: number;
  unanswerableCount: number;
  answerableCount: number;
  optimalThresholds: {
    denseThreshold: number;
    lexicalThreshold: number;
    trueAbstentionRate: number;
    falseAbstentionRate: number;
    f1Score: number;
  };
  sweepGrid: AbstentionSweepPoint[];
}

export function runAbstentionSweep(
  heldOutQuestions: GoldenQuestion[],
  corpus: CorpusChunk[],
  embeddingFixtures: Record<string, number[]>,
  resultsDir?: string,
): AbstentionSweepReport {
  // Precompute maximum scores for each held-out question across the corpus
  const precomputed = heldOutQuestions.map((q) => {
    const isUnanswerable = q.type === 'unanswerable';
    const qEmb = embeddingFixtures[q.id] ?? [];
    let maxDense = 0;
    let maxLexical = 0;

    for (const chunk of corpus) {
      const cEmb = embeddingFixtures[chunk.id] ?? [];
      const dense = computeCosineSimilarity(qEmb, cEmb);
      if (dense > maxDense) maxDense = dense;

      const lex = computeLexicalScore(q.question, chunk.content);
      if (lex > maxLexical) maxLexical = lex;
    }

    return {
      id: q.id,
      isUnanswerable,
      maxDense,
      maxLexical,
    };
  });

  const unanswerableTotal = precomputed.filter((p) => p.isUnanswerable).length;
  const answerableTotal = precomputed.filter((p) => !p.isUnanswerable).length;

  const denseGrid = [0.45, 0.48, 0.5, 0.52, 0.55, 0.58, 0.6, 0.62, 0.65, 0.7];
  const lexicalGrid = [0.02, 0.04, 0.06, 0.08, 0.1, 0.12, 0.15];

  const sweepGrid: AbstentionSweepPoint[] = [];

  for (const dt of denseGrid) {
    for (const lt of lexicalGrid) {
      let unanswerableAbstained = 0;
      let answerableAbstained = 0;

      for (const item of precomputed) {
        // Query abstains if neither dense nor lexical threshold is met
        const abstained = item.maxDense < dt && item.maxLexical < lt;
        if (item.isUnanswerable) {
          if (abstained) unanswerableAbstained++;
        } else {
          if (abstained) answerableAbstained++;
        }
      }

      const trueAbstentionRate =
        unanswerableTotal > 0
          ? Number((unanswerableAbstained / unanswerableTotal).toFixed(4))
          : 1.0;
      const falseAbstentionRate =
        answerableTotal > 0 ? Number((answerableAbstained / answerableTotal).toFixed(4)) : 0.0;

      const precision =
        unanswerableAbstained + answerableAbstained > 0
          ? Number(
              (unanswerableAbstained / (unanswerableAbstained + answerableAbstained)).toFixed(4),
            )
          : 1.0;
      const recall = trueAbstentionRate;
      const f1Score =
        precision + recall > 0
          ? Number(((2 * precision * recall) / (precision + recall)).toFixed(4))
          : 0.0;

      sweepGrid.push({
        denseThreshold: dt,
        lexicalThreshold: lt,
        unanswerableTotal,
        unanswerableAbstained,
        trueAbstentionRate,
        answerableTotal,
        answerableAbstained,
        falseAbstentionRate,
        precision,
        recall,
        f1Score,
      });
    }
  }

  // Find optimal point:
  // Preference: falseAbstentionRate <= 0.02 (0% ideal), then highest F1 score, then closest to balanced 0.58/0.08
  const feasible = sweepGrid.filter((pt) => pt.falseAbstentionRate <= 0.02);
  feasible.sort((a, b) => {
    if (b.f1Score !== a.f1Score) return b.f1Score - a.f1Score;
    if (b.trueAbstentionRate !== a.trueAbstentionRate)
      return b.trueAbstentionRate - a.trueAbstentionRate;
    const distA = Math.abs(a.denseThreshold - 0.58) + Math.abs(a.lexicalThreshold - 0.08);
    const distB = Math.abs(b.denseThreshold - 0.58) + Math.abs(b.lexicalThreshold - 0.08);
    return distA - distB;
  });

  const best = feasible[0] ?? sweepGrid[0]!;

  const report: AbstentionSweepReport = {
    timestamp: new Date().toISOString(),
    heldOutCount: heldOutQuestions.length,
    unanswerableCount: unanswerableTotal,
    answerableCount: answerableTotal,
    optimalThresholds: {
      denseThreshold: best.denseThreshold,
      lexicalThreshold: best.lexicalThreshold,
      trueAbstentionRate: best.trueAbstentionRate,
      falseAbstentionRate: best.falseAbstentionRate,
      f1Score: best.f1Score,
    },
    sweepGrid,
  };

  if (resultsDir) {
    if (!fs.existsSync(resultsDir)) {
      fs.mkdirSync(resultsDir, { recursive: true });
    }
    const targetFile = path.join(resultsDir, 'abstention-sweep.json');
    fs.writeFileSync(targetFile, JSON.stringify(report, null, 2) + '\n', 'utf-8');
  }

  return report;
}
