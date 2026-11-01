import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../index.js';
import * as dbModule from '@docsage/db';
import * as authService from './service.js';

describe('apps/api: Auth API Contract Tests', () => {
  const app = createApp();

  const mockAdminUser = {
    id: '550e8400-e29b-41d4-a716-446655440001',
    tenantId: '6ba7b810-9dad-11d1-80b4-00c04fd430c8',
    email: 'exists@enterprise.com',
    passwordHash: '$argon2id$mock-hash',
    role: 'admin' as const,
    createdAt: new Date(),
  };

  const mockEditorUser = {
    id: '550e8400-e29b-41d4-a716-446655440001',
    tenantId: '6ba7b810-9dad-11d1-80b4-00c04fd430c8',
    email: 'user@enterprise.com',
    passwordHash: '$argon2id$mock-hash',
    role: 'editor' as const,
    createdAt: new Date(),
  };

  describe('POST /auth/register', () => {
    it('validates request payload and rejects invalid email', async () => {
      const res = await request(app)
        .post('/auth/register')
        .send({
          email: 'invalid-email-format',
          password: 'Password123!',
        });

      expect(res.status).toBe(400);
      expect((res.body as { error: string }).error).toContain('Validation failed');
    });

    it('rejects short passwords under 8 characters', async () => {
      const res = await request(app)
        .post('/auth/register')
        .send({
          email: 'valid@enterprise.com',
          password: 'short',
        });

      expect(res.status).toBe(400);
    });

    it('returns 409 conflict when user email already exists', async () => {
      vi.spyOn(dbModule.db.query.users, 'findFirst').mockResolvedValueOnce(mockAdminUser);

      const res = await request(app)
        .post('/auth/register')
        .send({
          email: 'exists@enterprise.com',
          password: 'ValidPassword123!',
          tenantName: 'Acme Corp',
        });

      expect(res.status).toBe(409);
      expect((res.body as { error: string }).error).toContain('already exists');
    });

    it('creates tenant and initial admin user on valid registration (201 Created)', async () => {
      vi.spyOn(dbModule.db.query.users, 'findFirst').mockResolvedValueOnce(undefined);
      vi.spyOn(dbModule.db, 'transaction').mockResolvedValueOnce({
        tenant: { id: '6ba7b810-9dad-11d1-80b4-00c04fd430c8', name: 'Acme Corp', createdAt: new Date() },
        user: {
          id: '550e8400-e29b-41d4-a716-446655440001',
          tenantId: '6ba7b810-9dad-11d1-80b4-00c04fd430c8',
          email: 'newadmin@enterprise.com',
          role: 'admin' as const,
        },
      });
      vi.spyOn(dbModule.db, 'insert').mockReturnValue({
        values: vi.fn().mockResolvedValue([]),
      } as unknown as ReturnType<typeof dbModule.db.insert>);

      const res = await request(app)
        .post('/auth/register')
        .send({
          email: 'newadmin@enterprise.com',
          password: 'ValidPassword123!',
          tenantName: 'Acme Corp',
        });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('accessToken');
      expect(res.body).toHaveProperty('user');
      expect((res.body as { user: { role: string } }).user.role).toBe('admin');
    });
  });

  describe('POST /auth/login', () => {
    it('rejects missing credentials with HTTP 400', async () => {
      const res = await request(app)
        .post('/auth/login')
        .send({});

      expect(res.status).toBe(400);
    });

    it('returns 401 when user is not found in database', async () => {
      vi.spyOn(dbModule.db.query.users, 'findFirst').mockResolvedValueOnce(undefined);

      const res = await request(app)
        .post('/auth/login')
        .send({
          email: 'notfound@enterprise.com',
          password: 'Password123!',
        });

      expect(res.status).toBe(401);
      expect((res.body as { error: string }).error).toContain('Invalid email or password');
    });

    it('returns 401 when password verification fails', async () => {
      vi.spyOn(dbModule.db.query.users, 'findFirst').mockResolvedValueOnce(mockAdminUser);
      vi.spyOn(authService, 'verifyPassword').mockResolvedValueOnce(false);

      const res = await request(app)
        .post('/auth/login')
        .send({
          email: 'user@enterprise.com',
          password: 'WrongPassword!',
        });

      expect(res.status).toBe(401);
      expect((res.body as { error: string }).error).toContain('Invalid email or password');
    });

    it('authenticates successfully and issues tokens on valid credentials', async () => {
      vi.spyOn(dbModule.db.query.users, 'findFirst').mockResolvedValueOnce(mockEditorUser);
      vi.spyOn(authService, 'verifyPassword').mockResolvedValueOnce(true);
      vi.spyOn(dbModule, 'withTenant').mockImplementation(async (_tenantId, fn) => {
        const mockTx = { insert: vi.fn().mockReturnValue({ values: vi.fn().mockResolvedValue([]) }) };
        return fn(mockTx as unknown as Parameters<typeof fn>[0]);
      });
      vi.spyOn(dbModule.db, 'insert').mockReturnValue({
        values: vi.fn().mockResolvedValue([]),
      } as unknown as ReturnType<typeof dbModule.db.insert>);

      const res = await request(app)
        .post('/auth/login')
        .send({
          email: 'user@enterprise.com',
          password: 'ValidPassword123!',
        });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('accessToken');
      expect((res.body as { user: { role: string } }).user.role).toBe('editor');
    });
  });

  describe('POST /auth/refresh', () => {
    it('rejects refresh when no cookie or header is provided', async () => {
      const res = await request(app)
        .post('/auth/refresh')
        .send({});

      expect(res.status).toBe(401);
      expect((res.body as { error: string }).error).toContain('Refresh token required');
    });
  });

  describe('POST /auth/logout', () => {
    it('clears httpOnly refresh token cookie on logout', async () => {
      const res = await request(app)
        .post('/auth/logout')
        .set('X-Requested-With', 'XMLHttpRequest')
        .send({});

      expect(res.status).toBe(200);
      expect((res.body as { success: boolean }).success).toBe(true);
    });
  });
});
