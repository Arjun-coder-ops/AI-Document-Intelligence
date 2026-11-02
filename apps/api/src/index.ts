import express, { type Request, type Response, type NextFunction } from 'express';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import cors from 'cors';
import './config/env.js';
import { authRouter } from './auth/routes.js';
import { documentsRouter } from './documents/routes.js';
import { chatRouter } from './chat/routes.js';
import { healthRouter } from './reliability/health.js';
import { csrfProtection } from './security/csrf.js';
import { requestLogger } from './observability/logger.js';
import { register, getMetricsText } from './observability/metrics.js';
import { adminRouter } from './admin/routes.js';

export function createApp(): express.Express {
  const app = express();

  // 1. HTTP Security Headers via Helmet
  app.use(helmet());

  // 2. Strict CORS Allowlist
  const allowedOrigin = process.env['CORS_ORIGIN'] ?? 'http://localhost:5173';
  app.use(
    cors({
      origin: (origin, callback) => {
        if (!origin || origin === allowedOrigin) {
          callback(null, true);
        } else {
          // Omit Access-Control-Allow-Origin header for unauthorized origins
          callback(null, false);
        }
      },
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: [
        'Content-Type',
        'Authorization',
        'X-Requested-With',
        'X-CSRF-Token',
        'Idempotency-Key',
      ],
    }),
  );

  // 3. Request Body Size Limits
  app.use(express.json({ limit: '1mb' }));
  app.use(cookieParser());

  // 4. CSRF Protection for ambient cookie authentication
  app.use(csrfProtection);

  // 5. Structured Logging Middleware (Pino)
  app.use(requestLogger);

  // Prometheus /metrics endpoint
  app.get('/metrics', async (_req: Request, res: Response) => {
    res.setHeader('Content-Type', register.contentType);
    res.send(await getMetricsText());
  });

  // Health check endpoints (liveness & readiness)
  app.use('/health', healthRouter);

  // Auth routes
  app.use('/auth', authRouter);

  // Documents ingestion & management routes
  app.use('/documents', documentsRouter);

  // Streaming Chat routes
  app.use('/chat', chatRouter);

  // Admin Analytics & Feedback routes
  app.use('/admin', adminRouter);

  // Global error handler respecting error status codes
  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    let status = 500;
    let message = 'Internal Server Error';

    if (typeof err === 'object' && err !== null) {
      const errObj = err as {
        status?: number;
        statusCode?: number;
        type?: string;
        message?: string;
      };
      if (typeof errObj.status === 'number') {
        status = errObj.status;
      } else if (typeof errObj.statusCode === 'number') {
        status = errObj.statusCode;
      } else if (errObj.type === 'entity.too.large') {
        status = 413;
      }

      if (typeof errObj.message === 'string') {
        message = errObj.message;
      }
    }

    res.status(status).json({ error: message });
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
