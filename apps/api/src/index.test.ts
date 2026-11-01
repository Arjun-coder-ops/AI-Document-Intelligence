import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { HealthCheckResponseSchema } from '@docsage/shared';
import { createApp } from './index.js';

describe('API Server Scaffold', () => {
  it('GET /health returns 200 with healthy status', async () => {
    const app = createApp();
    const res = await request(app).get('/health');

    expect(res.status).toBe(200);
    const parsed = HealthCheckResponseSchema.parse(res.body);
    expect(parsed.status).toBe('healthy');
    expect(parsed.version).toBe('0.1.0');
    expect(typeof parsed.timestamp).toBe('string');
  });
});
