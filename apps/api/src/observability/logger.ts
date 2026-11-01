import pino from 'pino';
import type { Request, Response, NextFunction } from 'express';
import type { AuthenticatedRequest } from '../auth/middleware.js';

export const logger = pino({
  level: process.env['LOG_LEVEL'] ?? 'info',
  formatters: {
    level: (label) => ({ level: label }),
  },
  timestamp: pino.stdTimeFunctions.isoTime,
  redact: {
    paths: ['req.headers.authorization', 'req.headers.cookie', 'password', 'token'],
    censor: '[REDACTED]',
  },
});

export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const startTime = Date.now();
  const requestId = (req.headers['x-request-id'] as string) || crypto.randomUUID();
  res.setHeader('X-Request-Id', requestId);

  res.on('finish', () => {
    const authReq = req as AuthenticatedRequest;
    const durationMs = Date.now() - startTime;

    // Production Structured Log Entry - Zero content logged
    logger.info({
      requestId,
      tenantId: authReq.user?.tenantId ?? 'anonymous',
      userId: authReq.user?.sub ?? 'anonymous',
      method: req.method,
      route: (req.route as { path?: string } | undefined)?.path ?? req.path,
      statusCode: res.statusCode,
      durationMs,
    });
  });

  next();
}
