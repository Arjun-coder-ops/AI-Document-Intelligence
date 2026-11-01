import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { auditLog, type schema } from '@docsage/db';

export interface AuditEventParams {
  tenantId: string;
  actorId: string | null;
  action: string;
  entity: string;
  entityId?: string | null;
  meta?: Record<string, unknown> | null;
}

export async function logAuditEvent(
  db: NodePgDatabase<typeof schema>,
  event: AuditEventParams,
): Promise<void> {
  await db.insert(auditLog).values({
    tenantId: event.tenantId,
    actorId: event.actorId,
    action: event.action,
    entity: event.entity,
    entityId: event.entityId ?? null,
    meta: event.meta ?? null,
  });
}
