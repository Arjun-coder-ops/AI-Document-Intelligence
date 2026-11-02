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
});
