import fs from 'fs';
import path from 'path';
import { runRetrievalEvaluation, type EvalConfig } from './runner.js';
import { writeDatasets } from './generate-dataset.js';
import type { RetrievalEvalReport } from './types.js';

export * from './types.js';
export * from './metrics.js';
export * from './runner.js';

export async function runCLI(): Promise<void> {
  const evalsDir = path.resolve(import.meta.dirname, '..');
  const resultsDir = path.resolve(evalsDir, '..', 'docs', 'results');
  if (!fs.existsSync(resultsDir)) {
    fs.mkdirSync(resultsDir, { recursive: true });
  }

  // Ensure datasets and fixtures exist
  writeDatasets(evalsDir);

  console.info('===============================================================');
  console.info('      DocSage RAG Evaluation Harness & Experiment Matrix       ');
  console.info('===============================================================');

  const configs: EvalConfig[] = [
    { name: 'baseline-dense', mode: 'baseline-dense', denseThreshold: 0.58 },
    { name: 'lexical-only', mode: 'lexical-only', lexicalThreshold: 0.08 },
    { name: 'hybrid', mode: 'hybrid', k: 60, denseThreshold: 0.58, lexicalThreshold: 0.08 },
    {
      name: 'hybrid-rerank',
      mode: 'hybrid-rerank',
      k: 60,
      rerankTopK: 5,
      denseThreshold: 0.58,
      lexicalThreshold: 0.08,
    },
  ];

  const results: Record<string, RetrievalEvalReport> = {};

  for (const cfg of configs) {
    process.stdout.write(`Running experiment: ${cfg.name.padEnd(16)} ... `);
    const report = await runRetrievalEvaluation(cfg, undefined, undefined, evalsDir);
    results[cfg.name] = report;

    // Save individual experiment JSON
    fs.writeFileSync(
      path.join(resultsDir, `${cfg.name}.json`),
      JSON.stringify(report, null, 2),
      'utf-8',
    );
    console.info(
      `✓ Recall@5: ${report.metrics.recallAt5.mean.toFixed(3)} | MRR: ${report.metrics.mrr.mean.toFixed(3)}`,
    );
  }

  // Save comparison summary JSON
  fs.writeFileSync(
    path.join(resultsDir, 'retrieval-comparison.json'),
    JSON.stringify(results, null, 2),
    'utf-8',
  );

  // Print Markdown Comparison Table
  console.info('\n### Retrieval Experiment Results Matrix (95% Bootstrap Confidence Intervals)');
  console.info(
    '| Strategy | Recall@1 | Recall@3 | Recall@5 | MRR | nDCG@5 | Hit Rate | Abstention |',
  );
  console.info('| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |');

  for (const [name, r] of Object.entries(results)) {
    const m = r.metrics;
    const r1 = `${m.recallAt1.mean} [${m.recallAt1.ciLower}, ${m.recallAt1.ciUpper}]`;
    const r3 = `${m.recallAt3.mean} [${m.recallAt3.ciLower}, ${m.recallAt3.ciUpper}]`;
    const r5 = `${m.recallAt5.mean} [${m.recallAt5.ciLower}, ${m.recallAt5.ciUpper}]`;
    const mrr = `${m.mrr.mean} [${m.mrr.ciLower}, ${m.mrr.ciUpper}]`;
    const ndcg = `${m.ndcgAt5.mean} [${m.ndcgAt5.ciLower}, ${m.ndcgAt5.ciUpper}]`;
    const hit = `${m.hitRate.mean}`;
    const abs = `${m.unanswerableAbstentionAccuracy.mean}`;
    console.info(`| **${name}** | ${r1} | ${r3} | ${r5} | ${mrr} | ${ndcg} | ${hit} | ${abs} |`);
  }

  // Verification Gate against Thresholds for hybrid-rerank
  const primaryReport = results['hybrid-rerank'];
  if (!primaryReport) {
    console.error('Error: hybrid-rerank experiment missing from results');
    process.exit(1);
  }

  if (!primaryReport.passedThresholds) {
    console.error('\n❌ CI REGRESSION GATE FAILED: Retrieval metrics fell below thresholds:');
    for (const fail of primaryReport.thresholdFailures) {
      console.error(`  - ${fail}`);
    }
    process.exit(1);
  }

  console.info(
    '\n✅ CI REGRESSION GATE PASSED: All retrieval metrics meet or exceed production thresholds.',
  );
}

// When run via CLI
if (process.argv[1]?.endsWith('index.ts') || process.argv[1]?.endsWith('index.js')) {
  runCLI().catch((err) => {
    console.error('Eval harness fatal error:', err);
    process.exit(1);
  });
}
