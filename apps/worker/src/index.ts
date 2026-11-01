export interface WorkerStatus {
  id: string;
  status: 'idle' | 'processing' | 'stopped';
  processedJobs: number;
}

export class IngestionWorker {
  private status: WorkerStatus['status'] = 'idle';
  private processed = 0;

  constructor(public readonly id = 'default-worker') {}

  getStatus(): WorkerStatus {
    return {
      id: this.id,
      status: this.status,
      processedJobs: this.processed,
    };
  }

  start(): void {
    this.status = 'idle';
  }

  stop(): void {
    this.status = 'stopped';
  }
}
