import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';
import express from 'express';
import { healthRouter } from './health.js';
import * as dbModule from '@docsage/db';

describe('apps/api: Health and Readiness Probes', () => {
  const app = express();
  app.use('/health', healthRouter);

  it('GET /health returns healthy status and metadata', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('status', 'healthy');
  });

  it('GET /health/live returns liveness status 200', async () => {
    const res = await request(app).get('/health/live');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('status', 'live');
  });

  it('GET /health/ready returns 200 when database executes successfully', async () => {
    vi.spyOn(dbModule.db, 'execute').mockResolvedValueOnce({
      rows: [],
      rowCount: 0,
      command: 'SELECT',
      oid: 0,
      fields: [],
    });
    const res = await request(app).get('/health/ready');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('status', 'ready');
    expect(res.body).toHaveProperty('database', 'connected');
  });

  it('GET /health/ready returns 503 when database execution fails', async () => {
    vi.spyOn(dbModule.db, 'execute').mockRejectedValueOnce(new Error('Connection timed out'));
    const res = await request(app).get('/health/ready');
    expect(res.status).toBe(503);
    expect(res.body).toHaveProperty('status', 'not_ready');
    expect(res.body).toHaveProperty('database', 'disconnected');
  });
});
