import { describe, it, expect, vi } from 'vitest';
import { logAuditEvent } from './service.js';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type { schema } from '@docsage/db';

describe('apps/api: Audit Service', () => {
  it('inserts audit log entry with sanitized metadata', async () => {
    const mockValues = vi.fn().mockResolvedValue([]);
    const mockInsert = vi.fn().mockReturnValue({ values: mockValues });
    const mockDb = { insert: mockInsert } as unknown as NodePgDatabase<typeof schema>;

    await logAuditEvent(mockDb, {
      tenantId: '6ba7b810-9dad-11d1-80b4-00c04fd430c8',
      actorId: '550e8400-e29b-41d4-a716-446655440001',
      action: 'DOCUMENT_UPLOAD',
      entity: 'document',
      entityId: '550e8400-e29b-41d4-a716-446655440099',
      meta: { filename: 'report.pdf' },
    });

    expect(mockInsert).toHaveBeenCalledTimes(1);
    expect(mockValues).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: '6ba7b810-9dad-11d1-80b4-00c04fd430c8',
        action: 'DOCUMENT_UPLOAD',
        entity: 'document',
        entityId: '550e8400-e29b-41d4-a716-446655440099',
        meta: { filename: 'report.pdf' },
      }),
    );
  });
});
