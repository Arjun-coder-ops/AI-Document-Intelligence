DROP INDEX IF EXISTS "idx_chunks_embedding_hnsw";--> statement-breakpoint
ALTER TABLE "chunks" ALTER COLUMN "embedding" TYPE vector(768);--> statement-breakpoint
ALTER TABLE "embedding_cache" ALTER COLUMN "embedding" TYPE vector(768);--> statement-breakpoint
CREATE INDEX "idx_chunks_embedding_hnsw" ON "chunks" USING hnsw ("embedding" vector_cosine_ops) WITH (m=16,ef_construction=64);
