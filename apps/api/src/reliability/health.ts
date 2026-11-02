import { Router, type Request, type Response } from 'express';
import { sql } from 'drizzle-orm';
import { db } from '@docsage/db';

export const healthRouter: Router = Router();

// Overall Health Check
healthRouter.get('/', (_req: Request, res: Response) => {
  res.status(200).json({
    status: 'healthy',
    version: '0.1.0',
    timestamp: new Date().toISOString(),
    database: 'unverified',
    redis: 'unverified',
  });
});

// Liveness Probe
healthRouter.get('/live', (_req: Request, res: Response) => {
  res.status(200).json({ status: 'live', timestamp: new Date().toISOString() });
});

// Readiness Probe (checks DB connectivity)
healthRouter.get('/ready', async (_req: Request, res: Response) => {
  try {
    // Quick DB ping
    await db.execute(sql`SELECT 1`);
    res.status(200).json({
      status: 'ready',
      database: 'connected',
      timestamp: new Date().toISOString(),
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Database ping failure';
    res.status(503).json({
      status: 'not_ready',
      database: 'disconnected',
      error: errorMsg,
      timestamp: new Date().toISOString(),
    });
  }
});
