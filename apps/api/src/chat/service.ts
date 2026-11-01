import { sql } from 'drizzle-orm';
import { withTenant } from '@docsage/db';
import type { DatabaseQueryExecutor, RetrievedChunk } from '@docsage/rag';

export class PostgresQueryExecutor implements DatabaseQueryExecutor {
  async queryDense(
    tenantId: string,
    queryEmbedding: number[],
    limit: number,
    efSearch: number,
  ): Promise<RetrievedChunk[]> {
    return withTenant(tenantId, async (tx) => {
      await tx.execute(sql.raw(`SET LOCAL hnsw.ef_search = ${efSearch}`));
      const vectorStr = `[${queryEmbedding.join(',')}]`;

      const rows = await tx.execute(sql`
        SELECT 
          c.id,
          c.tenant_id,
          c.document_id,
          d.title as document_title,
          c.ordinal,
          c.content,
          c.token_count,
          c.page,
          c.section,
          1 - (c.embedding <=> ${vectorStr}::vector) as score
        FROM chunks c
        INNER JOIN documents d ON d.id = c.document_id
        WHERE c.tenant_id = ${tenantId}::uuid
          AND d.deleted_at IS NULL
          AND d.status = 'ready'
        ORDER BY c.embedding <=> ${vectorStr}::vector ASC
        LIMIT ${limit}
      `);

      return (rows as unknown as Array<Record<string, unknown>>).map((r) => ({
        id: String(r['id']),
        tenantId: String(r['tenant_id']),
        documentId: String(r['document_id']),
        documentTitle: String(r['document_title']),
        ordinal: Number(r['ordinal']),
        content: String(r['content']),
        tokenCount: Number(r['token_count']),
        page: r['page'] !== null ? Number(r['page']) : null,
        section: typeof r['section'] === 'string' ? r['section'] : null,
        score: Number(r['score']),
        source: 'dense' as const,
      }));
    });
  }

  async queryLexical(
    tenantId: string,
    queryText: string,
    limit: number,
  ): Promise<RetrievedChunk[]> {
    return withTenant(tenantId, async (tx) => {
      const rows = await tx.execute(sql`
        SELECT 
          c.id,
          c.tenant_id,
          c.document_id,
          d.title as document_title,
          c.ordinal,
          c.content,
          c.token_count,
          c.page,
          c.section,
          ts_rank(c.tsv, websearch_to_tsquery('english', ${queryText})) as score
        FROM chunks c
        INNER JOIN documents d ON d.id = c.document_id
        WHERE c.tenant_id = ${tenantId}::uuid
          AND d.deleted_at IS NULL
          AND d.status = 'ready'
          AND c.tsv @@ websearch_to_tsquery('english', ${queryText})
        ORDER BY score DESC
        LIMIT ${limit}
      `);

      return (rows as unknown as Array<Record<string, unknown>>).map((r) => ({
        id: String(r['id']),
        tenantId: String(r['tenant_id']),
        documentId: String(r['document_id']),
        documentTitle: String(r['document_title']),
        ordinal: Number(r['ordinal']),
        content: String(r['content']),
        tokenCount: Number(r['token_count']),
        page: r['page'] !== null ? Number(r['page']) : null,
        section: typeof r['section'] === 'string' ? r['section'] : null,
        score: Number(r['score']),
        source: 'lexical' as const,
      }));
    });
  }
}

export const postgresQueryExecutor = new PostgresQueryExecutor();
