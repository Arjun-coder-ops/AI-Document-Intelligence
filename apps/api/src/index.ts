import express, { type Request, type Response, type NextFunction } from 'express';
import cookieParser from 'cookie-parser';
import { authRouter } from './auth/routes.js';
import { documentsRouter } from './documents/routes.js';
import { chatRouter } from './chat/routes.js';
import { healthRouter } from './reliability/health.js';

export function createApp(): express.Express {
  const app = express();

  app.use(express.json());
  app.use(cookieParser());

  // Health check endpoints (liveness & readiness)
  app.use('/health', healthRouter);

  // Auth routes
  app.use('/auth', authRouter);

  // Documents ingestion & management routes
  app.use('/documents', documentsRouter);

  // Streaming Chat routes
  app.use('/chat', chatRouter);

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
  const server = app.listen(port, () => {
    console.info(`DocSage API server listening on port ${port}`);
  });

  // Graceful shutdown handling
  const shutdown = (signal: string) => {
    console.info(`Received ${signal}. Draining connections and initiating graceful shutdown...`);
    server.close(() => {
      console.info('HTTP server closed. Exiting process.');
      process.exit(0);
    });

    // Force exit after 10s if connections do not close cleanly
    setTimeout(() => {
      console.error('Graceful shutdown timeout exceeded. Forcefully killing process.');
      process.exit(1);
    }, 10000).unref();
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

export default app;
