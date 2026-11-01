import { describe, it, expect } from 'vitest';
import { IngestionWorker } from './index.js';

describe('IngestionWorker Scaffold', () => {
  it('initializes with idle status and zero processed jobs', () => {
    const worker = new IngestionWorker('test-worker');
    const status = worker.getStatus();

    expect(status.id).toBe('test-worker');
    expect(status.status).toBe('idle');
    expect(status.processedJobs).toBe(0);
  });

  it('updates status on stop', () => {
    const worker = new IngestionWorker('test-worker');
    worker.stop();
    expect(worker.getStatus().status).toBe('stopped');
  });
});
