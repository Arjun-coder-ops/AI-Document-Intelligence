import express, { type Request, type Response, type NextFunction } from 'express';
import cookieParser from 'cookie-parser';
import type { HealthCheckResponse } from '@docsage/shared';
import { authRouter } from './auth/routes.js';

export function createApp(): express.Express {
  const app = express();

  app.use(express.json());
  app.use(cookieParser());

  // Health check endpoint
  app.get('/health', (_req: Request, res: Response) => {
    const response: HealthCheckResponse = {
      status: 'healthy',
      version: '0.1.0',
      timestamp: new Date().toISOString(),
      database: 'unverified',
      redis: 'unverified',
    };
    res.status(200).json(response);
  });

  // Auth routes
  app.use('/auth', authRouter);

  // Global error handler
  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    const message = err instanceof Error ? err.message : 'Internal Server Error';
    res.status(500).json({ error: message });
  });

  return app;
}

const app = createApp();

if (process.env['NODE_ENV'] !== 'test') {
  const port = process.env['PORT'] ?? 8000;
  app.listen(port, () => {
    console.info(`DocSage API server listening on port ${port}`);
  });
}

export default app;
