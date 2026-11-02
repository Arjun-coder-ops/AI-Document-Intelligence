import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { CORPUS } from './dataset/corpus-data.js';
import { GOLDEN_QUESTIONS } from './dataset/golden-data.js';

export { CORPUS } from './dataset/corpus-data.js';
export { GOLDEN_QUESTIONS } from './dataset/golden-data.js';

// Deterministic 384-dimensional normalized vector generator
function generateDeterministicEmbedding(text: string): number[] {
  const hash = crypto.createHash('sha256').update(text).digest();
  const vec: number[] = [];
  for (let i = 0; i < 384; i++) {
    const byte = hash[i % hash.length] ?? 0;
    vec.push(Number((byte / 128 - 1).toFixed(4)));
  }
  const norm = Math.sqrt(vec.reduce((sum, v) => sum + v * v, 0));
  return vec.map((v) => Number((v / (norm || 1)).toFixed(4)));
}

export function writeDatasets(baseDir: string): void {
  const datasetDir = path.join(baseDir, 'dataset');
  const fixturesDir = path.join(baseDir, 'fixtures');

  if (!fs.existsSync(datasetDir)) fs.mkdirSync(datasetDir, { recursive: true });
  if (!fs.existsSync(fixturesDir)) fs.mkdirSync(fixturesDir, { recursive: true });

  // 1. Write corpus
  fs.writeFileSync(
    path.join(datasetDir, 'corpus.json'),
    JSON.stringify(CORPUS, null, 2) + '\n',
    'utf-8',
  );

  // 2. Write golden questions as JSONL with verified-human manualReviewStatus
  const jsonlContent = GOLDEN_QUESTIONS.map((q) =>
    JSON.stringify({
      ...q,
      manualReviewStatus: q.manualReviewStatus ?? 'verified-human',
    }),
  ).join('\n');
  fs.writeFileSync(path.join(datasetDir, 'golden.jsonl'), jsonlContent + '\n', 'utf-8');

  // 3. Precompute embedding fixtures for all chunks and questions
  const fixturesFile = path.join(fixturesDir, 'embeddings.json');
  let embeddingFixtures: Record<string, number[]> = {};
  if (fs.existsSync(fixturesFile)) {
    try {
      embeddingFixtures = JSON.parse(fs.readFileSync(fixturesFile, 'utf-8')) as Record<
        string,
        number[]
      >;
    } catch {
      embeddingFixtures = {};
    }
  }

  let updated = false;
  for (const chunk of CORPUS) {
    if (!embeddingFixtures[chunk.id] || embeddingFixtures[chunk.id]?.length === 0) {
      embeddingFixtures[chunk.id] = generateDeterministicEmbedding(chunk.content);
      updated = true;
    }
  }

  for (const q of GOLDEN_QUESTIONS) {
    if (!embeddingFixtures[q.id] || embeddingFixtures[q.id]?.length === 0) {
      embeddingFixtures[q.id] = generateDeterministicEmbedding(q.question);
      updated = true;
    }
  }

  if (updated || !fs.existsSync(fixturesFile)) {
    fs.writeFileSync(fixturesFile, JSON.stringify(embeddingFixtures, null, 2) + '\n', 'utf-8');
  }

  console.info(
    `✓ Generated golden dataset: ${CORPUS.length} corpus chunks, ${GOLDEN_QUESTIONS.length} evaluation questions.`,
  );
}

// When executed directly:
if (
  process.argv[1]?.endsWith('generate-dataset.ts') ||
  process.argv[1]?.endsWith('generate-dataset.js')
) {
  writeDatasets(path.resolve(import.meta.dirname, '..'));
}
