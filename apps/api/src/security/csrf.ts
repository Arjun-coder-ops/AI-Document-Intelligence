import type { Request, Response, NextFunction } from 'express';

/**
 * CSRF Protection Middleware for Cookie-based Auth Flows
 *
 * Verifies that requests relying on ambient credentials (httpOnly cookies)
 * contain a custom header (e.g. X-Requested-With or X-CSRF-Token) or match
 * the allowed Origin, preventing simple cross-origin POST attacks.
 */
export function csrfProtection(req: Request, res: Response, next: NextFunction): void {
  // Safe HTTP methods do not mutate state
  if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') {
    next();
    return;
  }

  // If request contains a refresh token in cookies, verify anti-CSRF measures
  const cookies = req.cookies as Record<string, string> | undefined;
  if (cookies && cookies['refresh_token']) {
    const hasCustomHeader =
      Boolean(req.headers['x-requested-with']) || Boolean(req.headers['x-csrf-token']);

    const origin = req.headers['origin'];
    const allowedOrigin = process.env['CORS_ORIGIN'] ?? 'http://localhost:5173';
    const isOriginAllowed = !origin || origin === allowedOrigin;

    if (!hasCustomHeader && !isOriginAllowed) {
      res.status(403).json({
        error: 'CSRF validation failed: Missing anti-CSRF custom header or invalid Origin',
      });
      return;
    }
  }

  next();
}
