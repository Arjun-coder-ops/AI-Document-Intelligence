import fs from 'fs/promises';
import pdfParse from 'pdf-parse';
import { db, documents, chunks, embeddingCache } from '@docsage/db';
import { eq, and, inArray } from 'drizzle-orm';
import { chunkDocument, type RawPageText, type EmbeddingProvider } from '@docsage/rag';

export interface IngestionJobData {
  documentId: string;
  tenantId: string;
  filePath: string;
  version?: number;
}

export async function processIngestion(
  data: IngestionJobData,
  embeddingProvider: EmbeddingProvider,
): Promise<{ chunksProcessed: number; reusedFromCache: number }> {
  const { documentId, tenantId, filePath } = data;
  const currentVersion = data.version ?? 1;
  const modelName = process.env['EMBEDDING_MODEL'] ?? 'all-MiniLM-L6-v2';

  // 1. Mark document as processing
  await db
    .update(documents)
    .set({ status: 'processing', error: null })
    .where(eq(documents.id, documentId));

  try {
    // 2. Read PDF file from disk
    const fileBuffer = await fs.readFile(filePath);

    // 3. Extract text page-by-page
    const parsedPdf = await pdfParse(fileBuffer);
    if (!parsedPdf.text.trim()) {
      throw new Error('PDF contains no extractable text (scanned document or empty)');
    }

    // Split text into approximate pages if page delimiter present, or single page
    const rawPages: RawPageText[] = [{ page: 1, text: parsedPdf.text }];

    // 4. Structure-aware chunking
    const generatedChunks = chunkDocument(rawPages, {
      targetTokens: Number(process.env['CHUNK_TARGET_TOKENS'] ?? 400),
      overlapTokens: Number(process.env['CHUNK_OVERLAP_TOKENS'] ?? 60),
    });

    if (generatedChunks.length === 0) {
      throw new Error('No chunks generated from document content');
    }

    // 5. Embedding cache lookup (avoid re-embedding identical text hashes)
    const chunkHashes = generatedChunks.map((c) => c.contentSha256);
    const cachedRecords = await db.query.embeddingCache.findMany({
      where: and(
        eq(embeddingCache.model, modelName),
        inArray(embeddingCache.contentSha256, chunkHashes),
      ),
    });

    const cacheMap = new Map<string, number[]>();
    for (const record of cachedRecords) {
      cacheMap.set(record.contentSha256, record.embedding);
    }

    // 6. Generate embeddings for uncached chunks
    const uncachedChunks = generatedChunks.filter((c) => !cacheMap.has(c.contentSha256));
    if (uncachedChunks.length > 0) {
      const textsToEmbed = uncachedChunks.map((c) => c.content);
      const newEmbeddings = await embeddingProvider.embedBatch(textsToEmbed);

      const cacheInserts = uncachedChunks.map((c, i) => ({
        contentSha256: c.contentSha256,
        model: modelName,
        embedding: newEmbeddings[i] ?? [],
      }));

      // Persist to embedding_cache (ignore conflicts if already cached concurrently)
      await db.insert(embeddingCache).values(cacheInserts).onConflictDoNothing();

      for (let i = 0; i < uncachedChunks.length; i++) {
        const chunk = uncachedChunks[i];
        const emb = newEmbeddings[i];
        if (chunk && emb) {
          cacheMap.set(chunk.contentSha256, emb);
        }
      }
    }

    // 7. Atomic DB Transaction: clear existing chunks for this doc and bulk insert
    await db.transaction(async (tx) => {
      // Idempotency: delete previous partial chunks for this document version
      await tx.delete(chunks).where(eq(chunks.documentId, documentId));

      const chunkInserts = generatedChunks.map((c) => ({
        tenantId,
        documentId,
        ordinal: c.ordinal,
        content: c.content,
        contentSha256: c.contentSha256,
        page: c.page,
        section: c.section,
        tokenCount: c.tokenCount,
        embedding: cacheMap.get(c.contentSha256) ?? [],
      }));

      await tx.insert(chunks).values(chunkInserts);

      // Mark document ready
      await tx
        .update(documents)
        .set({ status: 'ready', version: currentVersion, error: null })
        .where(eq(documents.id, documentId));
    });

    return {
      chunksProcessed: generatedChunks.length,
      reusedFromCache: generatedChunks.length - uncachedChunks.length,
    };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Unknown ingestion processing failure';
    await db
      .update(documents)
      .set({ status: 'failed', error: errorMsg })
      .where(eq(documents.id, documentId));
    throw err;
  }
}

export async function processPurge(documentId: string): Promise<void> {
  // Hard delete chunks associated with soft-deleted document
  await db.delete(chunks).where(eq(chunks.documentId, documentId));
}
