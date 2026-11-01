import { Router, type Response } from 'express';
import { RegisterRequestSchema, LoginRequestSchema, type AuthResponse } from '@docsage/shared';
import { db, tenants, users, refreshTokens, withTenant } from '@docsage/db';
import { eq, and, isNull, gt } from 'drizzle-orm';
import {
  hashPassword,
  verifyPassword,
  createAccessToken,
  generateRefreshToken,
  hashToken,
} from './service.js';
import { logAuditEvent } from '../audit/service.js';
import type { AuthenticatedRequest } from './middleware.js';

export const authRouter: Router = Router();

// Cookie configuration
const isProd = process.env['NODE_ENV'] === 'production';
const refreshCookieOptions = {
  httpOnly: true,
  secure: isProd,
  sameSite: 'lax' as const,
  path: '/auth/refresh',
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
};

// ─── POST /auth/register ──────────────────────────────────────────────────────
authRouter.post('/register', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const parseResult = RegisterRequestSchema.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({ error: 'Validation failed', details: parseResult.error.format() });
    return;
  }

  const { tenantName, email, password } = parseResult.data;

  // Check if user already exists
  const existingUser = await db.query.users.findFirst({
    where: eq(users.email, email.toLowerCase()),
  });

  if (existingUser) {
    res.status(409).json({ error: 'A user with this email address already exists' });
    return;
  }

  const passwordHashed = await hashPassword(password);

  // Create tenant and first admin user in transaction
  const newTenant = await db.transaction(async (tx) => {
    const [t] = await tx.insert(tenants).values({ name: tenantName }).returning({ id: tenants.id });

    if (!t) throw new Error('Failed to create workspace');

    const [u] = await tx
      .insert(users)
      .values({
        tenantId: t.id,
        email: email.toLowerCase(),
        passwordHash: passwordHashed,
        role: 'admin',
      })
      .returning({
        id: users.id,
        tenantId: users.tenantId,
        email: users.email,
        role: users.role,
      });

    if (!u) throw new Error('Failed to create initial user');

    await logAuditEvent(tx, {
      tenantId: t.id,
      actorId: u.id,
      action: 'register',
      entity: 'tenant',
      entityId: t.id,
      meta: { email: u.email },
    });

    return { tenant: t, user: u };
  });

  const { user } = newTenant;

  // Generate tokens
  const accessToken = createAccessToken({
    sub: user.id,
    tenantId: user.tenantId,
    email: user.email,
    role: user.role,
  });

  const { token: rawRefreshToken, tokenHash, expiresAt } = generateRefreshToken();

  await db.insert(refreshTokens).values({
    userId: user.id,
    tokenHash,
    expiresAt,
  });

  res.cookie('refreshToken', rawRefreshToken, refreshCookieOptions);

  const response: AuthResponse = {
    accessToken,
    user: {
      id: user.id,
      tenantId: user.tenantId,
      email: user.email,
      role: user.role,
    },
  };

  res.status(201).json(response);
});

// ─── POST /auth/login ─────────────────────────────────────────────────────────
authRouter.post('/login', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const parseResult = LoginRequestSchema.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({ error: 'Validation failed', details: parseResult.error.format() });
    return;
  }

  const { email, password } = parseResult.data;

  const user = await db.query.users.findFirst({
    where: eq(users.email, email.toLowerCase()),
  });

  if (!user) {
    res.status(401).json({ error: 'Invalid email or password' });
    return;
  }

  const validPassword = await verifyPassword(user.passwordHash, password);
  if (!validPassword) {
    res.status(401).json({ error: 'Invalid email or password' });
    return;
  }

  // Record audit log within tenant context
  await withTenant(user.tenantId, async (tx) => {
    await logAuditEvent(tx, {
      tenantId: user.tenantId,
      actorId: user.id,
      action: 'login',
      entity: 'user',
      entityId: user.id,
    });
  });

  const accessToken = createAccessToken({
    sub: user.id,
    tenantId: user.tenantId,
    email: user.email,
    role: user.role,
  });

  const { token: rawRefreshToken, tokenHash, expiresAt } = generateRefreshToken();

  await db.insert(refreshTokens).values({
    userId: user.id,
    tokenHash,
    expiresAt,
  });

  res.cookie('refreshToken', rawRefreshToken, refreshCookieOptions);

  const response: AuthResponse = {
    accessToken,
    user: {
      id: user.id,
      tenantId: user.tenantId,
      email: user.email,
      role: user.role,
    },
  };

  res.status(200).json(response);
});

// ─── POST /auth/refresh ───────────────────────────────────────────────────────
authRouter.post('/refresh', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const cookies = req.cookies as Record<string, string> | undefined;
  const rawToken =
    cookies?.['refreshToken'] ?? (req.body as { refreshToken?: string })?.refreshToken;

  if (!rawToken) {
    res.status(401).json({ error: 'Refresh token required' });
    return;
  }

  const tokenHash = hashToken(rawToken);

  const tokenRecord = await db.query.refreshTokens.findFirst({
    where: and(
      eq(refreshTokens.tokenHash, tokenHash),
      isNull(refreshTokens.revokedAt),
      gt(refreshTokens.expiresAt, new Date()),
    ),
  });

  if (!tokenRecord) {
    res.status(401).json({ error: 'Invalid, expired, or revoked refresh token' });
    return;
  }

  const user = await db.query.users.findFirst({
    where: eq(users.id, tokenRecord.userId),
  });

  if (!user) {
    res.status(401).json({ error: 'User no longer exists' });
    return;
  }

  // Rotate refresh token (revoke previous, issue new)
  await db
    .update(refreshTokens)
    .set({ revokedAt: new Date() })
    .where(eq(refreshTokens.id, tokenRecord.id));

  const { token: newRawRefreshToken, tokenHash: newTokenHash, expiresAt } = generateRefreshToken();

  await db.insert(refreshTokens).values({
    userId: user.id,
    tokenHash: newTokenHash,
    expiresAt,
  });

  const newAccessToken = createAccessToken({
    sub: user.id,
    tenantId: user.tenantId,
    email: user.email,
    role: user.role,
  });

  res.cookie('refreshToken', newRawRefreshToken, refreshCookieOptions);

  res.status(200).json({ accessToken: newAccessToken });
});

// ─── POST /auth/logout ────────────────────────────────────────────────────────
authRouter.post('/logout', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const cookies = req.cookies as Record<string, string> | undefined;
  const rawToken =
    cookies?.['refreshToken'] ?? (req.body as { refreshToken?: string })?.refreshToken;

  if (rawToken) {
    const tokenHash = hashToken(rawToken);
    await db
      .update(refreshTokens)
      .set({ revokedAt: new Date() })
      .where(eq(refreshTokens.tokenHash, tokenHash));
  }

  res.clearCookie('refreshToken', { path: '/auth/refresh' });
  res.status(200).json({ success: true, message: 'Logged out successfully' });
});
