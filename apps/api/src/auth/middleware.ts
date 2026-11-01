import type { Request, Response, NextFunction } from 'express';
import { verifyAccessToken } from './service.js';
import type { JwtPayload, UserRole } from '@docsage/shared';

export interface AuthenticatedRequest extends Request {
  user?: JwtPayload;
}

export function authenticate(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  let token: string | undefined;

  if (authHeader?.startsWith('Bearer ')) {
    token = authHeader.slice(7);
  } else if (req.cookies && typeof req.cookies === 'object') {
    const cookies = req.cookies as Record<string, string>;
    token = cookies['accessToken'];
  }

  if (!token) {
    res.status(401).json({ error: 'Authentication required: missing access token' });
    return;
  }

  try {
    const payload = verifyAccessToken(token);
    req.user = payload;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired access token' });
  }
}

const roleWeights: Record<UserRole, number> = {
  viewer: 1,
  editor: 2,
  admin: 3,
};

export function requireRole(minimumRole: UserRole) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const userWeight = roleWeights[req.user.role];
    const requiredWeight = roleWeights[minimumRole];

    if (userWeight < requiredWeight) {
      res.status(403).json({
        error: `Forbidden: role '${req.user.role}' lacks sufficient privileges (required: '${minimumRole}')`,
      });
      return;
    }

    next();
  };
}
