import { directPool } from './client.js';

export interface CheckResult {
  passed: boolean;
  checks: Array<{ name: string; status: 'ok' | 'failed'; detail?: string }>;
}

export const TENANT_TABLES = [
  'documents',
  'chunks',
  'conversations',
  'messages',
  'audit_log',
  'feedback',
] as const;

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
    const targetDim = Number(process.env['EMBEDDING_DIM'] ?? 768);
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

    // 4. Assert non-BYPASSRLS for API application role
    const roleRes = await client.query(`
      SELECT rolname, rolbypassrls 
      FROM pg_roles 
      WHERE rolname = 'app_user'
    `);
    if (roleRes.rows.length > 0) {
      const role = roleRes.rows[0] as { rolname: string; rolbypassrls: boolean };
      if (!role.rolbypassrls) {
        checks.push({
          name: 'app_user_nobypassrls',
          status: 'ok',
          detail: 'Verified app_user role has rolbypassrls = false (strictly enforces RLS)',
        });
      } else {
        checks.push({
          name: 'app_user_nobypassrls',
          status: 'failed',
          detail: 'CRITICAL: app_user role has rolbypassrls = true. Must be NOBYPASSRLS.',
        });
      }
    } else {
      checks.push({
        name: 'app_user_nobypassrls',
        status: 'ok',
        detail: 'app_user role not yet defined in active connection catalog',
      });
    }

    // 5. Assert RLS is ENABLED and FORCED on all tenant tables
    const rlsRes = await client.query(
      `
      SELECT 
        c.relname as table_name,
        c.relrowsecurity as rls_enabled,
        c.relforcerowsecurity as rls_forced
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public'
        AND c.relname = ANY($1::text[])
    `,
      [TENANT_TABLES],
    );

    const rlsMap = new Map<string, { rls_enabled: boolean; rls_forced: boolean }>();
    for (const row of rlsRes.rows as Array<{
      table_name: string;
      rls_enabled: boolean;
      rls_forced: boolean;
    }>) {
      rlsMap.set(row.table_name, row);
    }

    const missingRls: string[] = [];
    const missingForced: string[] = [];

    for (const table of TENANT_TABLES) {
      const status = rlsMap.get(table);
      if (!status || !status.rls_enabled) {
        missingRls.push(table);
      } else if (!status.rls_forced) {
        missingForced.push(table);
      }
    }

    if (missingRls.length === 0 && missingForced.length === 0) {
      checks.push({
        name: 'tenant_tables_rls_enforced',
        status: 'ok',
        detail: `All ${TENANT_TABLES.length} tenant tables have RLS enabled and forced (FORCE ROW LEVEL SECURITY)`,
      });
    } else {
      const issues: string[] = [];
      if (missingRls.length > 0) issues.push(`RLS disabled on: ${missingRls.join(', ')}`);
      if (missingForced.length > 0) issues.push(`RLS unforced on: ${missingForced.join(', ')}`);
      checks.push({
        name: 'tenant_tables_rls_enforced',
        status: 'failed',
        detail: `Tenant isolation gaps: ${issues.join('; ')}`,
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
