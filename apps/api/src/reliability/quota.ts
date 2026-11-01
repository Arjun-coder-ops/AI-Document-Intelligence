import { sql } from 'drizzle-orm';
import { withTenant } from '@docsage/db';

export interface TenantQuotaStatus {
  withinQuota: boolean;
  currentCost: number;
  monthlyLimit: number;
}

export async function checkTenantMonthlyQuota(
  tenantId: string,
  monthlyCostLimit = 100.0, // $100 default budget
): Promise<TenantQuotaStatus> {
  const currentCost = await withTenant(tenantId, async (tx) => {
    const result = await tx.execute(sql`
      SELECT COALESCE(SUM(estimated_cost), 0) as total_cost
      FROM messages
      WHERE tenant_id = ${tenantId}::uuid
        AND created_at >= date_trunc('month', NOW())
    `);

    const row = (result as unknown as Array<{ total_cost: string | number }>)[0];
    return Number(row?.total_cost ?? 0);
  });

  return {
    withinQuota: currentCost < monthlyCostLimit,
    currentCost: Number(currentCost.toFixed(4)),
    monthlyLimit: monthlyCostLimit,
  };
}
