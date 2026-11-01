import { describe, it, expect } from 'vitest';
import { getAppConfig } from './index.js';
import { ApiClient } from './api/client.js';

describe('apps/web: Web App & Client', () => {
  it('returns valid app configuration', () => {
    const config = getAppConfig();
    expect(config.version).toBe('0.1.0');
    expect(typeof config.apiUrl).toBe('string');
  });

  it('ApiClient manages token state and attaches Authorization headers', () => {
    const client = new ApiClient();
    expect(client.getToken()).toBeNull();

    client.setToken('test-jwt-token-123');
    expect(client.getToken()).toBe('test-jwt-token-123');

    client.setToken(null);
    expect(client.getToken()).toBeNull();
  });
});
