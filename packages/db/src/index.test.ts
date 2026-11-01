import { describe, it, expect } from 'vitest';
import { tenants, documents, chunks, serializeVector, deserializeVector } from './schema/index.js';

describe('Database Schema & Type Definitions', () => {
  it('defines required tables with expected column definitions', () => {
    expect(tenants.id).toBeDefined();
    expect(tenants.name).toBeDefined();
    expect(tenants.createdAt).toBeDefined();

    expect(documents.tenantId).toBeDefined();
    expect(documents.contentSha256).toBeDefined();
    expect(documents.version).toBeDefined();

    expect(chunks.documentId).toBeDefined();
    expect(chunks.embedding).toBeDefined();
    expect(chunks.tsv).toBeDefined();
    expect(chunks.ordinal).toBeDefined();
  });

  it('serializes and deserializes vector embeddings accurately', () => {
    const rawVector = [0.1234, -0.5678, 0.9999];
    const driverString = serializeVector(rawVector);
    expect(driverString).toBe('[0.1234,-0.5678,0.9999]');

    const reconstructed = deserializeVector(driverString);
    expect(reconstructed).toEqual(rawVector);
  });

  it('handles empty vector string edge case', () => {
    expect(deserializeVector('[]')).toEqual([]);
  });
});
