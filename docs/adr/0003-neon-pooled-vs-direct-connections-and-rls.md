# ADR 0003: Neon Pooled vs Direct Connections and Transaction-Local RLS

## Context

Neon provides serverless PostgreSQL with two connection modes:

1. **Direct Connection (`DATABASE_URL_DIRECT`):** Direct TCP connection to the Postgres compute node. Supports all DDL commands, session parameters, and advisory locks, but connection count is limited by compute size.
2. **Pooled Connection (`DATABASE_URL`):** Connects through Neon's PgBouncer proxy layer in **Transaction Pooling** mode. Handles thousands of concurrent client connections efficiently.

In a multi-tenant application, we enforce PostgreSQL **Row-Level Security (RLS)** via session variables:
`current_setting('app.tenant_id')::uuid`.

However, using session-level parameters (`SET app.tenant_id = '...'`) across pooled connections causes severe cross-tenant contamination: when a transaction finishes, PgBouncer reassigns the physical connection to another client, leaking the previous tenant setting if not cleaned up.

## Options Considered

### Option 1: Direct Connections Everywhere

- _Pros:_ Session settings and advisory locks work without special transaction constraints.
- _Cons:_ Fails under web scale; serverless Lambdas and auto-scaling Express instances exhaust PostgreSQL max connections (`FATAL: remaining connection slots are reserved`).

### Option 2: Session-Level `SET` with Connection Reset in Pooler

- _Pros:_ Simple syntax.
- _Cons:_ Extremely error-prone; requires `DISCARD ALL` on every connection return; risk of cross-tenant data leakage if an exception bypasses connection cleanup.

### Option 3: Two Connection Strings + Transaction-Local `set_config(..., true)`

- _Mechanism:_
  - Use `DATABASE_URL_DIRECT` exclusively for migrations (`drizzle-kit migrate`), schema alterations, and administrative index verification scripts.
  - Use `DATABASE_URL` (pooled) for application runtime (`apps/api` and `apps/worker`).
  - Enforce tenant isolation inside explicit transactions using `SELECT set_config('app.tenant_id', $1, true)`.
  - The third parameter `true` sets `is_local = true`, scoping the configuration variable strictly to the current transaction. When the transaction commits or rolls back, PostgreSQL automatically clears the variable, guaranteeing zero connection state leakage in PgBouncer.

## Decision

Adopt **Option 3**:

- Application runtime connects through the pooled URL.
- Migrations run through the direct URL.
- All tenant-scoped operations must use the `withTenant(tenantId, fn)` helper:

```ts
export async function withTenant<T>(tenantId: string, fn: (tx) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query("SELECT set_config('app.tenant_id', $1, true)", [tenantId]);
    const result = await fn(drizzle(client, { schema }));
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
```

## Consequences & Trade-offs

- **Positive:** Mathematically eliminates cross-tenant data leaks in PgBouncer; allows application to scale to thousands of concurrent requests.
- **Negative:** Direct queries without transactions cannot access RLS-protected tables; developers must use `withTenant` for all tenant data operations.
