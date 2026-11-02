import { PgBoss, type Job } from 'pg-boss';
import { processIngestion, processPurge, type IngestionJobData } from './ingestion.js';
import { getEmbeddingProvider } from './embedding.js';

export const QUEUE_INGESTION = 'document-ingestion';
export const QUEUE_PURGE = 'document-purge';

export class JobQueueService {
  private boss: PgBoss;
  private started = false;

  constructor(connectionString?: string) {
    const dbUrl =
      connectionString ??
      process.env['DATABASE_URL_DIRECT'] ??
      process.env['DATABASE_URL'] ??
      'postgresql://postgres:postgres@localhost:5432/docsage';

    this.boss = new PgBoss(dbUrl);
  }

  async start(): Promise<void> {
    if (this.started) return;

    await this.boss.start();
    this.started = true;

    const embeddingProvider = getEmbeddingProvider();

    // Register Ingestion Worker
    await this.boss.work<IngestionJobData>(
      QUEUE_INGESTION,
      async (jobs: Job<IngestionJobData>[]) => {
        const job = jobs[0];
        if (!job) return;
        await processIngestion(job.data, embeddingProvider);
      },
    );

    // Register Purge Worker
    await this.boss.work<{ documentId: string }>(
      QUEUE_PURGE,
      async (jobs: Job<{ documentId: string }>[]) => {
        const job = jobs[0];
        if (!job) return;
        await processPurge(job.data.documentId);
      },
    );

    console.info('✓ JobQueueService workers registered for ingestion and purge');
  }

  async stop(): Promise<void> {
    if (!this.started) return;
    await this.boss.stop();
    this.started = false;
  }

  async enqueueIngestion(data: IngestionJobData): Promise<string | null> {
    return await this.boss.send(QUEUE_INGESTION, data);
  }

  async enqueuePurge(documentId: string): Promise<string | null> {
    return await this.boss.send(QUEUE_PURGE, { documentId });
  }
}

export const jobQueue = new JobQueueService();
