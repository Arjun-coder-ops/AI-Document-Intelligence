import { describe, it, expect, vi } from 'vitest';
import type { Response, NextFunction } from 'express';
import {
  hashPassword,
  verifyPassword,
  createAccessToken,
  verifyAccessToken,
  generateRefreshToken,
  hashToken,
} from './service.js';
import { requireRole, type AuthenticatedRequest } from './middleware.js';

describe('Auth Service (Argon2id & JWT)', () => {
  it('hashes and verifies passwords accurately with argon2id', async () => {
    const raw = 'TestArgon2idSecretHash-2026';
    const hashed = await hashPassword(raw);

    expect(hashed).toContain('$argon2id$');
    const isValid = await verifyPassword(hashed, raw);
    expect(isValid).toBe(true);

    const isInvalid = await verifyPassword(hashed, 'WrongPassword!');
    expect(isInvalid).toBe(false);
  });

  it('signs and verifies JWT access tokens with valid claims', () => {
    const payload = {
      sub: '550e8400-e29b-41d4-a716-446655440000',
      tenantId: '6ba7b810-9dad-11d1-80b4-00c04fd430c8',
      email: 'lead.architect@faang.com',
      role: 'admin' as const,
    };

    const token = createAccessToken(payload);
    expect(typeof token).toBe('string');

    const decoded = verifyAccessToken(token);
    expect(decoded.sub).toBe(payload.sub);
    expect(decoded.tenantId).toBe(payload.tenantId);
    expect(decoded.email).toBe(payload.email);
    expect(decoded.role).toBe('admin');
  });

  it('rejects tampered or malformed JWT access tokens', () => {
    expect(() => verifyAccessToken('malformed.token.value')).toThrow();
  });

  it('generates cryptographically random refresh tokens and matching hashes', () => {
    const { token, tokenHash, expiresAt } = generateRefreshToken();

    expect(token).toHaveLength(80); // 40 bytes hex
    expect(tokenHash).toBe(hashToken(token));
    expect(expiresAt.getTime()).toBeGreaterThan(Date.now());
  });
});

describe('RBAC Middleware', () => {
  function createMockContext(role?: 'admin' | 'editor' | 'viewer') {
    const req = {
      user: role
        ? {
            sub: 'user-123',
            tenantId: 'tenant-123',
            email: 'test@example.com',
            role,
          }
        : undefined,
    } as AuthenticatedRequest;

    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    } as unknown as Response;

    const next = vi.fn() as NextFunction;

    return { req, res, next };
  }

  it('denies unauthenticated requests with 401', () => {
    const { req, res, next } = createMockContext();
    const middleware = requireRole('viewer');

    middleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('allows admin role to access admin, editor, and viewer resources', () => {
    const { req, res, next } = createMockContext('admin');

    requireRole('admin')(req, res, next);
    expect(next).toHaveBeenCalledTimes(1);

    requireRole('editor')(req, res, next);
    expect(next).toHaveBeenCalledTimes(2);

    requireRole('viewer')(req, res, next);
    expect(next).toHaveBeenCalledTimes(3);
  });

  it('allows editor role to access editor and viewer, but blocks admin with 403', () => {
    const { req, res, next } = createMockContext('editor');

    requireRole('admin')(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();

    requireRole('editor')(req, res, next);
    expect(next).toHaveBeenCalledTimes(1);

    requireRole('viewer')(req, res, next);
    expect(next).toHaveBeenCalledTimes(2);
  });

  it('blocks viewer role from editor and admin resources with 403', () => {
    const { req, res, next } = createMockContext('viewer');

    requireRole('admin')(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);

    requireRole('editor')(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();

    requireRole('viewer')(req, res, next);
    expect(next).toHaveBeenCalledTimes(1);
  });
});
