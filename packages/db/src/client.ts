import pg from 'pg';
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from './schema/index.js';

const { Pool } = pg;

const pooledUrl =
  process.env['DATABASE_URL'] ?? 'postgresql://postgres:postgres@localhost:5432/docsage';
const directUrl = process.env['DATABASE_URL_DIRECT'] ?? pooledUrl;

export const pool = new Pool({
  connectionString: pooledUrl,
  max: 20,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
});

export const directPool = new Pool({
  connectionString: directUrl,
  max: 5,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 10_000,
});

export const db: NodePgDatabase<typeof schema> = drizzle(pool, { schema });
export const directDb: NodePgDatabase<typeof schema> = drizzle(directPool, { schema });

/**
 * Executes a callback within a transaction isolated to a specific tenant.
 * Sets transaction-local config: SELECT set_config('app.tenant_id', $1, true)
 * Safe with Neon connection poolers (PgBouncer in transaction mode).
 */
export async function withTenant<T>(
  tenantId: string,
  fn: (tx: NodePgDatabase<typeof schema>) => Promise<T>,
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // Set transaction-local setting (is_local = true)
    await client.query("SELECT set_config('app.tenant_id', $1, true)", [tenantId]);
    const txDb = drizzle(client, { schema });
    const result = await fn(txDb);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
