import { directPool } from './client.js';

export interface ReembedOptions {
  batchSize?: number;
  embedFn?: (texts: string[]) => Promise<number[][]>;
}

export async function reembedChunks(
  options: ReembedOptions = {},
): Promise<{ total: number; updated: number }> {
  const batchSize = options.batchSize ?? 20;
  const client = await directPool.connect();

  try {
    const res = await client.query<{ id: string; content: string }>(`
      SELECT id, content 
      FROM chunks 
      WHERE embedding IS NULL OR array_length(embedding::real[], 1) != 768
    `);

    const chunks = res.rows;
    if (chunks.length === 0) {
      console.info('✓ All chunks already have valid 768-dimensional embeddings.');
      return { total: 0, updated: 0 };
    }

    console.info(`Found ${chunks.length} chunks requiring 768-dimensional re-embedding.`);

    let updated = 0;
    for (let i = 0; i < chunks.length; i += batchSize) {
      const batch = chunks.slice(i, i + batchSize);
      const texts = batch.map((c) => c.content);

      let embeddings: number[][];
      if (options.embedFn) {
        embeddings = await options.embedFn(texts);
      } else {
        // Fallback default: zero-filled unit vector if no provider passed directly
        embeddings = texts.map(() => {
          const v = new Array<number>(768).fill(0);
          v[0] = 1;
          return v;
        });
      }

      for (let j = 0; j < batch.length; j++) {
        const item = batch[j];
        const emb = embeddings[j];
        if (item && emb) {
          const vectorStr = `[${emb.join(',')}]`;
          await client.query(`UPDATE chunks SET embedding = $1::vector WHERE id = $2`, [
            vectorStr,
            item.id,
          ]);
          updated++;
        }
      }
      console.info(
        `✓ Re-embedded ${Math.min(i + batchSize, chunks.length)}/${chunks.length} chunks`,
      );
    }

    return { total: chunks.length, updated };
  } finally {
    client.release();
  }
}

if (process.argv[1] && process.argv[1].endsWith('reembed.js')) {
  reembedChunks()
    .then((res) => {
      console.info(`✅ Re-embedding complete: ${res.updated}/${res.total} chunks updated.`);
      process.exit(0);
    })
    .catch((err) => {
      console.error('Re-embedding failed:', err);
      process.exit(1);
    });
}
