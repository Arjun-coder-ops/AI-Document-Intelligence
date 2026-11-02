import { describe, it, expect } from 'vitest';
import { UserRoleSchema, HealthCheckResponseSchema } from './index.js';

describe('Shared Schemas', () => {
  it('validates user roles correctly', () => {
    expect(UserRoleSchema.parse('admin')).toBe('admin');
    expect(UserRoleSchema.parse('editor')).toBe('editor');
    expect(UserRoleSchema.parse('viewer')).toBe('viewer');
    expect(() => UserRoleSchema.parse('superuser')).toThrow();
  });

  it('validates health check payload', () => {
    const payload = {
      status: 'healthy' as const,
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      database: 'connected' as const,
      redis: 'connected' as const,
    };
    expect(HealthCheckResponseSchema.parse(payload)).toEqual(payload);
  });

  describe('MinimalEnvSchema', () => {
    it('accepts exactly the 8 production environment variables', async () => {
      const { MinimalEnvSchema } = await import('./index.js');
      const validEnv = {
        DATABASE_URL: 'postgresql://app_user:secret@localhost:5432/docsage',
        DATABASE_URL_DIRECT: 'postgresql://postgres:secret@localhost:5432/docsage',
        JWT_ACCESS_SECRET: 'a_very_long_cryptographically_secure_jwt_access_secret_32_chars',
        JWT_REFRESH_SECRET: 'a_very_long_cryptographically_secure_jwt_refresh_secret_32_chars',
        GROQ_API_KEY: 'gsk_test_api_key_for_groq',
        GEMINI_API_KEY: 'AIza_test_api_key_for_gemini',
        REDIS_URL: 'redis://localhost:6379',
        EMBEDDING_DIM: 768,
      };

      const parsed = MinimalEnvSchema.parse(validEnv);
      expect(parsed.EMBEDDING_DIM).toBe(768);
      expect(parsed.GROQ_API_KEY).toBe(validEnv.GROQ_API_KEY);
      expect(parsed.GEMINI_API_KEY).toBe(validEnv.GEMINI_API_KEY);
    });

    it('rejects short JWT secrets (< 32 chars) for fail-fast security', async () => {
      const { MinimalEnvSchema } = await import('./index.js');
      const invalidEnv = {
        DATABASE_URL: 'postgresql://app_user:secret@localhost:5432/docsage',
        JWT_ACCESS_SECRET: 'too_short_secret',
        JWT_REFRESH_SECRET: 'also_too_short',
        GROQ_API_KEY: 'gsk_key',
        GEMINI_API_KEY: 'AIza_key',
        REDIS_URL: 'redis://localhost:6379',
      };

      expect(() => MinimalEnvSchema.parse(invalidEnv)).toThrow(/at least 32 characters/);
    });
  });
});
