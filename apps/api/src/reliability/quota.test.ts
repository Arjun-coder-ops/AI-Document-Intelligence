import { describe, it, expect, vi } from 'vitest';
import * as dbModule from '@docsage/db';
import { checkTenantMonthlyQuota } from './quota.js';

describe('apps/api: Tenant Monthly Quota', () => {
  it('reports withinQuota = true when current spend is below limit', async () => {
    vi.spyOn(dbModule, 'withTenant').mockImplementation(async (_tenantId, fn) => {
      const mockTx = {
        execute: vi.fn().mockResolvedValue([{ total_cost: '24.50' }]),
      };
      return fn(mockTx as unknown as Parameters<typeof fn>[0]);
    });

    const status = await checkTenantMonthlyQuota('6ba7b810-9dad-11d1-80b4-00c04fd430c8', 100);
    expect(status.withinQuota).toBe(true);
    expect(status.currentCost).toBe(24.5);
    expect(status.monthlyLimit).toBe(100);
  });

  it('reports withinQuota = false when current spend exceeds limit', async () => {
    vi.spyOn(dbModule, 'withTenant').mockImplementation(async (_tenantId, fn) => {
      const mockTx = {
        execute: vi.fn().mockResolvedValue([{ total_cost: '105.25' }]),
      };
      return fn(mockTx as unknown as Parameters<typeof fn>[0]);
    });

    const status = await checkTenantMonthlyQuota('6ba7b810-9dad-11d1-80b4-00c04fd430c8', 100);
    expect(status.withinQuota).toBe(false);
    expect(status.currentCost).toBe(105.25);
  });
});
