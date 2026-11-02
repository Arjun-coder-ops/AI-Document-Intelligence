import fs from 'fs';
import path from 'path';
import { CORPUS, GOLDEN_QUESTIONS } from './generate-dataset.js';

interface EmbedResponse {
  embedding?: {
    values: number[];
  };
  error?: {
    code: number;
    message: string;
  };
}

export function l2Normalize(vec: number[]): number[] {
  const norm = Math.sqrt(vec.reduce((sum, v) => sum + v * v, 0));
  if (norm === 0) return vec;
  return vec.map((v) => Number((v / norm).toFixed(6)));
}

function loadEnvKey(baseDir: string): string | null {
  const envPath = path.resolve(baseDir, '.env');
  if (!fs.existsSync(envPath)) return null;

  const content = fs.readFileSync(envPath, 'utf-8');
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const match = trimmed.match(/^GEMINI_API_KEY=["']?([^"'\r\n]+)["']?$/);
    if (match && match[1] && !match[1].includes('placeholder')) {
      return match[1].trim();
    }
  }
  return null;
}

export async function fetchSingleGeminiEmbedding(
  text: string,
  taskType: 'RETRIEVAL_DOCUMENT' | 'RETRIEVAL_QUERY',
  apiKey: string,
  dimension = 768,
  model = 'models/gemini-embedding-001',
): Promise<number[]> {
  const url = `https://generativelanguage.googleapis.com/v1beta/${model}:embedContent?key=${apiKey}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      content: { parts: [{ text }] },
      taskType,
      outputDimensionality: dimension,
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Gemini embed error ${res.status}: ${errText}`);
  }

  const data = (await res.json()) as EmbedResponse;
  if (!data.embedding?.values) {
    throw new Error(`Gemini embed failed: ${JSON.stringify(data.error ?? 'missing values')}`);
  }

  return l2Normalize(data.embedding.values);
}

export async function generateAndSaveGeminiEmbeddings(
  baseDir: string = process.cwd(),
): Promise<void> {
  const apiKey = process.env['GEMINI_API_KEY'] || loadEnvKey(baseDir);

  if (!apiKey || apiKey.includes('placeholder')) {
    console.error('❌ GEMINI_API_KEY is not configured in .env or environment.');
    console.error('Please populate GEMINI_API_KEY in .env before running this script.');
    process.exit(1);
  }

  console.info(
    `Connecting to Gemini API (model: models/gemini-embedding-001, dimension: 768, L2-normalized)...`,
  );

  const itemsToEmbed: Array<{
    id: string;
    text: string;
    taskType: 'RETRIEVAL_DOCUMENT' | 'RETRIEVAL_QUERY';
  }> = [];

  for (const chunk of CORPUS) {
    itemsToEmbed.push({
      id: chunk.id,
      text: chunk.content,
      taskType: 'RETRIEVAL_DOCUMENT',
    });
  }

  for (const q of GOLDEN_QUESTIONS) {
    itemsToEmbed.push({
      id: q.id,
      text: q.question,
      taskType: 'RETRIEVAL_QUERY',
    });
  }

  const results: Record<string, number[]> = {};
  const CONCURRENCY = 5;

  for (let i = 0; i < itemsToEmbed.length; i += CONCURRENCY) {
    const chunk = itemsToEmbed.slice(i, i + CONCURRENCY);
    await Promise.all(
      chunk.map(async (item) => {
        const emb = await fetchSingleGeminiEmbedding(item.text, item.taskType, apiKey, 768);
        results[item.id] = emb;
      }),
    );
    console.info(
      `✓ Progress: ${Math.min(i + CONCURRENCY, itemsToEmbed.length)}/${itemsToEmbed.length} embedded`,
    );
    // Brief pause to respect Gemini rate limits
    await new Promise((r) => setTimeout(r, 100));
  }

  const fixturesDir = path.resolve(baseDir, 'evals', 'fixtures');
  if (!fs.existsSync(fixturesDir)) {
    fs.mkdirSync(fixturesDir, { recursive: true });
  }

  const outputPath = path.join(fixturesDir, 'embeddings.json');
  fs.writeFileSync(outputPath, JSON.stringify(results, null, 2), 'utf-8');

  console.info(
    `✅ Successfully generated and wrote ${Object.keys(results).length} real 768-d Gemini embeddings to ${outputPath}`,
  );
}

if (
  process.argv[1]?.endsWith('generate-gemini-embeddings.ts') ||
  process.argv[1]?.endsWith('generate-gemini-embeddings.js')
) {
  generateAndSaveGeminiEmbeddings().catch((err: unknown) => {
    console.error('Fatal embedding generation error:', err);
    process.exit(1);
  });
}
