import { describe, it, expect, vi } from 'vitest';
import { withTenant, pool } from './client.js';

describe('Tenant Isolation (RLS Foundation)', () => {
  it('encapsulates queries inside transactions setting transaction-local app.tenant_id', async () => {
    const fakeClient = {
      query: vi.fn().mockImplementation((queryText: string) => {
        if (queryText === 'BEGIN' || queryText === 'COMMIT' || queryText === 'ROLLBACK') {
          return Promise.resolve({ rows: [] });
        }
        if (queryText.includes('set_config')) {
          return Promise.resolve({ rows: [{ set_config: 'tenant-a-uuid' }] });
        }
        return Promise.resolve({ rows: [] });
      }),
      release: vi.fn(),
    };

    vi.spyOn(pool, 'connect').mockResolvedValueOnce(fakeClient as never);

    const testTenantId = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';
    const executed = await withTenant(testTenantId, async () => {
      return await Promise.resolve('tenant_operation_success');
    });

    expect(executed).toBe('tenant_operation_success');
    expect(fakeClient.query).toHaveBeenCalledWith('BEGIN');
    expect(fakeClient.query).toHaveBeenCalledWith("SELECT set_config('app.tenant_id', $1, true)", [
      testTenantId,
    ]);
    expect(fakeClient.query).toHaveBeenCalledWith('COMMIT');
    expect(fakeClient.release).toHaveBeenCalledTimes(1);
  });

  it('rolls back transaction and releases client on unexpected failure', async () => {
    const fakeClient = {
      query: vi.fn().mockImplementation((queryText: string) => {
        if (queryText === 'BEGIN' || queryText === 'ROLLBACK') {
          return Promise.resolve({ rows: [] });
        }
        if (queryText.includes('set_config')) {
          return Promise.resolve({ rows: [] });
        }
        return Promise.resolve({ rows: [] });
      }),
      release: vi.fn(),
    };

    vi.spyOn(pool, 'connect').mockResolvedValueOnce(fakeClient as never);

    await expect(
      withTenant('tenant-failing-uuid', async () => {
        await Promise.resolve();
        throw new Error('Database query failed mid-transaction');
      }),
    ).rejects.toThrow('Database query failed mid-transaction');

    expect(fakeClient.query).toHaveBeenCalledWith('BEGIN');
    expect(fakeClient.query).toHaveBeenCalledWith('ROLLBACK');
    expect(fakeClient.release).toHaveBeenCalledTimes(1);
  });
});
