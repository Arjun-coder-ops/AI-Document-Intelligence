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

  it('ensures TryItWidget does not simulate live execution with setTimeout or claim real-time live inference', async () => {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const filePath = path.resolve(__dirname, 'components/landing/TryItWidget.tsx');
    const content = fs.readFileSync(filePath, 'utf8');

    expect(content).not.toContain('setTimeout');
    expect(content).toContain('Recorded Example');
    expect(content).not.toContain('in real time');
  });
});
