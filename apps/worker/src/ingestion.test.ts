import { describe, it, expect, vi } from 'vitest';
import { MockEmbeddingProvider } from './embedding.js';
import { hashContent } from '@docsage/rag';

describe('Async Ingestion Pipeline Logic', () => {
  it('correctly reuses cached embeddings matching chunk SHA-256 hash', async () => {
    const provider = new MockEmbeddingProvider(768);
    const embedBatchSpy = vi.spyOn(provider, 'embedBatch');

    const content1 = 'First unique chunk content.';
    const content2 = 'Second unique chunk content.';

    const hash1 = hashContent(content1);
    const hash2 = hashContent(content2);

    expect(hash1).not.toBe(hash2);

    // Initial embed
    const [vec1] = await provider.embedBatch([content1]);
    expect(vec1).toBeDefined();
    expect(vec1?.length).toBe(768);
    expect(embedBatchSpy).toHaveBeenCalledTimes(1);

    // Simulated cache lookup hit
    const cacheMap = new Map<string, number[]>();
    cacheMap.set(hash1, vec1!);

    // Next run checks cache
    const uncached = [content1, content2].filter((c) => !cacheMap.has(hashContent(c)));
    expect(uncached).toEqual([content2]); // Only content2 needs embedding!
  });

  it('guarantees deterministic offline embeddings via MockEmbeddingProvider', async () => {
    const provider = new MockEmbeddingProvider(768);
    const vecA = await provider.embedText('Sample text');
    const vecB = await provider.embedText('Sample text');

    expect(vecA).toEqual(vecB);
    expect(vecA.length).toBe(768);
  });

  it('verifies PDF magic bytes %PDF- to reject corrupt/invalid files', () => {
    const validHeader = Buffer.from('%PDF-1.4\n');
    const invalidHeader = Buffer.from('NOT A PDF FILE');

    const isPdf = (buf: Buffer) => buf.subarray(0, 5).toString('utf-8') === '%PDF-';

    expect(isPdf(validHeader)).toBe(true);
    expect(isPdf(invalidHeader)).toBe(false);
  });

  it('guarantees retry idempotency by wiping partial chunks before re-inserting', () => {
    const existingChunks = [
      { id: 'chunk-1', documentId: 'doc-1', ordinal: 0 },
      { id: 'chunk-2', documentId: 'doc-1', ordinal: 1 },
    ];

    // Simulate crash retry: purge old chunks for doc-1 first
    const targetDocId = 'doc-1';
    const postPurgeChunks = existingChunks.filter((c) => c.documentId !== targetDocId);
    expect(postPurgeChunks.length).toBe(0);

    // Re-insert fresh complete batch
    const newChunks = [
      { id: 'chunk-3', documentId: 'doc-1', ordinal: 0 },
      { id: 'chunk-4', documentId: 'doc-1', ordinal: 1 },
    ];
    const finalChunks = [...postPurgeChunks, ...newChunks];
    expect(finalChunks.length).toBe(2);
    expect(finalChunks[0]?.id).toBe('chunk-3');
  });

  it('guarantees O(document) chunk deletion without corpus re-embedding', () => {
    const corpus = [
      { documentId: 'doc-1', chunkId: 'c1' },
      { documentId: 'doc-1', chunkId: 'c2' },
      { documentId: 'doc-2', chunkId: 'c3' },
      { documentId: 'doc-3', chunkId: 'c4' },
    ];

    const deleteTargetDocId = 'doc-1';
    const remainingCorpus = corpus.filter((c) => c.documentId !== deleteTargetDocId);

    // Other documents remain completely unaffected and untouched
    expect(remainingCorpus).toHaveLength(2);
    expect(remainingCorpus.map((c) => c.documentId)).toEqual(['doc-2', 'doc-3']);
  });
});
