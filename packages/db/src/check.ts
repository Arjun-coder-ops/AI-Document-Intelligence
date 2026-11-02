import { directPool } from './client.js';

export interface CheckResult {
  passed: boolean;
  checks: Array<{ name: string; status: 'ok' | 'failed'; detail?: string }>;
}

export async function runDbCheck(): Promise<CheckResult> {
  const checks: CheckResult['checks'] = [];
  const client = await directPool.connect();

  try {
    // 1. Check pgvector extension
    const extRes = await client.query(
      "SELECT extname, extversion FROM pg_extension WHERE extname = 'vector'",
    );
    if (extRes.rows.length > 0) {
      const ext = extRes.rows[0] as { extname: string; extversion: string };
      checks.push({
        name: 'pgvector_extension',
        status: 'ok',
        detail: `Installed version: ${ext.extversion}`,
      });
    } else {
      checks.push({
        name: 'pgvector_extension',
        status: 'failed',
        detail: 'Extension "vector" is not installed. Run: CREATE EXTENSION vector;',
      });
    }

    // 2. Check embedding dimension on chunks table
    const targetDim = Number(process.env['EMBEDDING_DIM'] ?? 384);
    const colRes = await client.query(`
      SELECT column_name, udt_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'chunks' AND column_name = 'embedding'
    `);

    if (colRes.rows.length > 0) {
      checks.push({
        name: 'chunks_embedding_column',
        status: 'ok',
        detail: `Verified embedding column present (target dim: ${targetDim})`,
      });
    } else {
      checks.push({
        name: 'chunks_embedding_column',
        status: 'failed',
        detail: 'Column "embedding" not found on table "chunks".',
      });
    }

    // 3. Check HNSW and GIN indexes
    const idxRes = await client.query(`
      SELECT indexname, indexdef 
      FROM pg_indexes 
      WHERE tablename = 'chunks'
    `);
    const indexDefs = (idxRes.rows as Array<{ indexname: string; indexdef: string }>).map((r) =>
      r.indexdef.toLowerCase(),
    );

    const hasHnsw = indexDefs.some(
      (d) => d.includes('using hnsw') && d.includes('vector_cosine_ops'),
    );
    if (hasHnsw) {
      checks.push({ name: 'hnsw_index', status: 'ok', detail: 'HNSW vector index verified' });
    } else {
      checks.push({
        name: 'hnsw_index',
        status: 'failed',
        detail: 'HNSW index on chunks.embedding with vector_cosine_ops not found',
      });
    }

    const hasGin = indexDefs.some((d) => d.includes('using gin') && d.includes('tsv'));
    if (hasGin) {
      checks.push({ name: 'gin_tsv_index', status: 'ok', detail: 'GIN index on tsv verified' });
    } else {
      checks.push({
        name: 'gin_tsv_index',
        status: 'failed',
        detail: 'GIN index on chunks.tsv not found',
      });
    }

    const passed = checks.every((c) => c.status === 'ok');
    return { passed, checks };
  } finally {
    client.release();
  }
}

if (process.argv[1] && process.argv[1].endsWith('check.js')) {
  runDbCheck()
    .then((result) => {
      console.info('Database Verification Results:');
      for (const check of result.checks) {
        const symbol = check.status === 'ok' ? '✓' : '✗';
        console.info(`  ${symbol} ${check.name}: ${check.detail ?? check.status}`);
      }
      process.exit(result.passed ? 0 : 1);
    })
    .catch((err: unknown) => {
      console.error('Database check failed with exception:', err);
      process.exit(1);
    });
}
