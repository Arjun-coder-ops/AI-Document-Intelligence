import { describe, it, expect } from 'vitest';
import { getAppConfig } from './index.js';

describe('Web App Scaffold', () => {
  it('returns valid app configuration', () => {
    const config = getAppConfig();
    expect(config.version).toBe('0.1.0');
    expect(typeof config.apiUrl).toBe('string');
  });
});
