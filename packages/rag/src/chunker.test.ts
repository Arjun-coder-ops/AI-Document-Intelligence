import { describe, it, expect } from 'vitest';
import { chunkDocument, estimateTokens, hashContent } from './chunker.js';

describe('Structure-Aware Document Chunker', () => {
  it('preserves section headers in chunk metadata', () => {
    const rawPages = [
      {
        page: 1,
        text: '# Executive Summary\nThis is a critical architectural summary of the platform.',
      },
      {
        page: 2,
        text: '## Security Architecture\nWe enforce PostgreSQL Row-Level Security for tenant isolation.',
      },
    ];

    const chunks = chunkDocument(rawPages, { targetTokens: 100, overlapTokens: 10 });

    expect(chunks.length).toBeGreaterThanOrEqual(2);
    expect(chunks[0]?.section).toBe('Executive Summary');
    expect(chunks[0]?.page).toBe(1);

    const secChunk = chunks.find((c) => c.content.includes('Row-Level Security'));
    expect(secChunk?.section).toBe('Security Architecture');
    expect(secChunk?.page).toBe(2);
  });

  it('keeps markdown tables intact without splitting mid-row', () => {
    const tableText = [
      '# Comparison Matrix',
      '| Feature | DocSage | Naive RAG |',
      '| --- | --- | --- |',
      '| Isolation | RLS (PostgreSQL) | None (Shared Index) |',
      '| Search | Hybrid + Rerank | Dense Only |',
      '| Queue | pg-boss (Postgres) | Synchronous / None |',
    ].join('\n');

    const chunks = chunkDocument([{ page: 1, text: tableText }], {
      targetTokens: 200,
      overlapTokens: 20,
    });

    // The whole table must be preserved in a single chunk
    const tableChunk = chunks.find((c) => c.content.includes('| Isolation |'));
    expect(tableChunk).toBeDefined();
    expect(tableChunk?.content).toContain('| Search |');
    expect(tableChunk?.content).toContain('| Queue |');
  });

  it('generates consistent SHA-256 hashes for deduplication', () => {
    const text1 = 'Identical chunk text for testing.';
    const text2 = 'Identical chunk text for testing.';
    expect(hashContent(text1)).toBe(hashContent(text2));
    expect(estimateTokens(text1)).toBeGreaterThan(0);
  });
});
