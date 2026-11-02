import { describe, it, expect, vi } from 'vitest';
import * as dbModule from '@docsage/db';
import { PostgresQueryExecutor } from './service.js';

describe('apps/api: PostgresQueryExecutor', () => {
  const executor = new PostgresQueryExecutor();

  it('executes dense vector queries with tenant isolation and ef_search configuration', async () => {
    vi.spyOn(dbModule, 'withTenant').mockImplementation(async (_tenantId, fn) => {
      const mockTx = {
        execute: vi.fn().mockImplementation((queryObj: { queryChunks?: unknown[] }) => {
          if (JSON.stringify(queryObj).includes('SET LOCAL')) {
            return Promise.resolve([]);
          }
          return Promise.resolve([
            {
              id: '550e8400-e29b-41d4-a716-446655440001',
              tenant_id: '6ba7b810-9dad-11d1-80b4-00c04fd430c8',
              document_id: '550e8400-e29b-41d4-a716-446655440010',
              document_title: 'Architecture Overview',
              ordinal: 0,
              content: 'PostgreSQL provides robust relational indexing and ACID guarantees.',
              token_count: 12,
              page: 1,
              section: 'Introduction',
              score: 0.945,
            },
          ]);
        }),
      };
      return fn(mockTx as unknown as Parameters<typeof fn>[0]);
    });

    const results = await executor.queryDense(
      '6ba7b810-9dad-11d1-80b4-00c04fd430c8',
      [0.1, 0.2, 0.3],
      5,
      40,
    );

    expect(results).toHaveLength(1);
    expect(results[0]?.id).toBe('550e8400-e29b-41d4-a716-446655440001');
    expect(results[0]?.source).toBe('dense');
    expect(results[0]?.documentTitle).toBe('Architecture Overview');
    expect(results[0]?.score).toBe(0.945);
  });

  it('executes lexical full-text queries with websearch_to_tsquery and ts_rank scoring', async () => {
    vi.spyOn(dbModule, 'withTenant').mockImplementation(async (_tenantId, fn) => {
      const mockTx = {
        execute: vi.fn().mockResolvedValue([
          {
            id: '550e8400-e29b-41d4-a716-446655440002',
            tenant_id: '6ba7b810-9dad-11d1-80b4-00c04fd430c8',
            document_id: '550e8400-e29b-41d4-a716-446655440010',
            document_title: 'Architecture Overview',
            ordinal: 1,
            content: 'Full text search uses GIN indexed tsvector columns.',
            token_count: 10,
            page: 2,
            section: null,
            score: 0.812,
          },
        ]),
      };
      return fn(mockTx as unknown as Parameters<typeof fn>[0]);
    });

    const results = await executor.queryLexical(
      '6ba7b810-9dad-11d1-80b4-00c04fd430c8',
      'GIN indexed tsvector',
      5,
    );

    expect(results).toHaveLength(1);
    expect(results[0]?.id).toBe('550e8400-e29b-41d4-a716-446655440002');
    expect(results[0]?.source).toBe('lexical');
    expect(results[0]?.section).toBeNull();
    expect(results[0]?.score).toBe(0.812);
  });
});
