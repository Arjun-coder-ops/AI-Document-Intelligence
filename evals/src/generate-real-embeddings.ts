import fs from 'fs';
import path from 'path';
import { CORPUS, GOLDEN_QUESTIONS } from './generate-dataset.js';

interface BatchEmbedResponse {
  embeddings?: Array<{ values: number[] }>;
  error?: {
    code: number;
    message: string;
    status: string;
  };
}

export function l2Normalize(vec: number[]): number[] {
  const norm = Math.sqrt(vec.reduce((sum, v) => sum + v * v, 0));
  if (norm === 0) return vec;
  return vec.map((v) => Number((v / norm).toFixed(6)));
}

function getApiKey(baseDir: string = process.cwd()): string {
  const envKey = process.env['GEMINI_API_KEY'];
  if (envKey && !envKey.includes('placeholder')) return envKey.trim();

  const envPath = path.resolve(baseDir, '.env');
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, 'utf-8').split('\n');
    for (const line of lines) {
      if (line.startsWith('GEMINI_API_KEY=')) {
        const val = line.split('=')[1]?.trim().replace(/^["']|["']$/g, '');
        if (val && !val.includes('placeholder')) return val;
      }
    }
  }
  return '';
}

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function embedBatchWithRetry(
  items: Array<{ id: string; text: string; taskType: 'RETRIEVAL_DOCUMENT' | 'RETRIEVAL_QUERY' }>,
  apiKey: string,
  model = 'models/gemini-embedding-2',
  maxRetries = 5,
): Promise<Array<{ id: string; embedding: number[] }> | null> {
  const url = `https://generativelanguage.googleapis.com/v1beta/${model}:batchEmbedContents?key=${apiKey}`;

  const requests = items.map((item) => ({
    model,
    content: { parts: [{ text: item.text }] },
    taskType: item.taskType,
    outputDimensionality: 768,
  }));

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requests }),
      });

      if (res.status === 429) {
        const text = await res.text();
        if (text.includes('RESOURCE_EXHAUSTED') || text.includes('requests per day')) {
          console.warn(`[Gemini API] Daily quota limit reached for ${model}: ${text.slice(0, 150)}...`);
          return null; // Gracefully stop when daily quota is exhausted
        }
        const delay = 15000 + Math.random() * 5000;
        console.warn(`[Gemini API 429] Rate limit hit. Cooling down for ${(delay / 1000).toFixed(1)}s (retry ${attempt}/${maxRetries})...`);
        await sleep(delay);
        continue;
      }

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Gemini embed error ${res.status}: ${errText}`);
      }

      const data = (await res.json()) as BatchEmbedResponse;
      if (!data.embeddings || data.embeddings.length !== items.length) {
        throw new Error(`Mismatched batch response: expected ${items.length}, got ${data.embeddings?.length}`);
      }

      return items.map((item, idx) => ({
        id: item.id,
        embedding: l2Normalize(data.embeddings![idx]!.values),
      }));
    } catch (err: unknown) {
      if (attempt === maxRetries) throw err;
      const delay = 3000 * attempt;
      console.warn(`[Network error] Retrying in ${delay / 1000}s...`, err);
      await sleep(delay);
    }
  }

  return null;
}

export async function generateTier2RealEmbeddings(baseDir: string = process.cwd()): Promise<void> {
  const apiKey = getApiKey(baseDir);
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured in environment or .env');
  }

  const realFixturesDir = path.resolve(baseDir, 'evals', 'fixtures', 'real');
  if (!fs.existsSync(realFixturesDir)) {
    fs.mkdirSync(realFixturesDir, { recursive: true });
  }

  const fixturesPath = path.join(realFixturesDir, 'embeddings.json');
  let realEmbeddings: Record<string, number[]> = {};

  if (fs.existsSync(fixturesPath)) {
    try {
      realEmbeddings = JSON.parse(fs.readFileSync(fixturesPath, 'utf-8')) as Record<string, number[]>;
      console.info(`Found existing Tier 2 cache: ${Object.keys(realEmbeddings).length} embeddings loaded.`);
    } catch {
      realEmbeddings = {};
    }
  }

  // Prioritize: Questions first, then baseline gold chunks, then distractors, then extended chunks
  const priorityTasks: Array<{ id: string; text: string; taskType: 'RETRIEVAL_DOCUMENT' | 'RETRIEVAL_QUERY' }> = [];

  // 1. All 122 Golden Questions (RETRIEVAL_QUERY)
  for (const q of GOLDEN_QUESTIONS) {
    if (!realEmbeddings[q.id] || realEmbeddings[q.id]?.length !== 768) {
      priorityTasks.push({ id: q.id, text: q.question, taskType: 'RETRIEVAL_QUERY' });
    }
  }

  // 2. All 25 Baseline Chunks (gold chunks for all questions, RETRIEVAL_DOCUMENT)
  const baselineChunks = CORPUS.slice(0, 25);
  for (const chunk of baselineChunks) {
    if (!realEmbeddings[chunk.id] || realEmbeddings[chunk.id]?.length !== 768) {
      priorityTasks.push({ id: chunk.id, text: chunk.content, taskType: 'RETRIEVAL_DOCUMENT' });
    }
  }

  // 3. All 320 Distractors (RETRIEVAL_DOCUMENT)
  const distractors = CORPUS.filter((c) => c.id.includes('distractor'));
  for (const chunk of distractors) {
    if (!realEmbeddings[chunk.id] || realEmbeddings[chunk.id]?.length !== 768) {
      priorityTasks.push({ id: chunk.id, text: chunk.content, taskType: 'RETRIEVAL_DOCUMENT' });
    }
  }

  // 4. Extended chunks up to remaining capacity (RETRIEVAL_DOCUMENT)
  const remainingChunks = CORPUS.filter((c) => !baselineChunks.some((b) => b.id === c.id) && !c.id.includes('distractor'));
  for (const chunk of remainingChunks) {
    if (!realEmbeddings[chunk.id] || realEmbeddings[chunk.id]?.length !== 768) {
      priorityTasks.push({ id: chunk.id, text: chunk.content, taskType: 'RETRIEVAL_DOCUMENT' });
    }
  }

  console.info(`Tier 2 Embedding Queue: ${priorityTasks.length} items to embed.`);
  if (priorityTasks.length === 0) {
    console.info(`✅ Tier 2 cache is fully populated with ${Object.keys(realEmbeddings).length} real embeddings.`);
    return;
  }

  const BATCH_SIZE = 15;
  let completed = 0;

  for (let i = 0; i < priorityTasks.length; i += BATCH_SIZE) {
    const batch = priorityTasks.slice(i, i + BATCH_SIZE);
    const results = await embedBatchWithRetry(batch, apiKey, 'models/gemini-embedding-2');

    if (!results) {
      console.warn(`⚠️ Stopping embedding run gracefully (daily quota limit reached).`);
      break;
    }

    for (const r of results) {
      realEmbeddings[r.id] = r.embedding;
    }

    completed += batch.length;
    console.info(`✓ Embedded: ${completed}/${priorityTasks.length} (${((completed / priorityTasks.length) * 100).toFixed(1)}%). Total cached: ${Object.keys(realEmbeddings).length}.`);

    // Checkpoint to disk
    fs.writeFileSync(fixturesPath, JSON.stringify(realEmbeddings, null, 2) + '\n', 'utf-8');

    // Safe delay to stay well under rate limits
    await sleep(2500);
  }

  console.info(`✅ Saved ${Object.keys(realEmbeddings).length} real Gemini embeddings to ${fixturesPath}`);
}

if (
  process.argv[1]?.endsWith('generate-real-embeddings.ts') ||
  process.argv[1]?.endsWith('generate-real-embeddings.js')
) {
  generateTier2RealEmbeddings().catch((err: unknown) => {
    console.error('Fatal embedding generation error:', err);
    process.exit(1);
  });
}
