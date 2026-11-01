import { test, expect } from '@playwright/test';

test.describe('DocSage E2E Flow: Health and Authentication Contract', () => {
  test('API liveness probe returns HTTP 200 live status', async ({ request }) => {
    const response = await request.get('/health/live');
    expect(response.status()).toBe(200);
    const body = await response.json() as { status: string };
    expect(body.status).toBe('live');
  });

  test('Rejects unauthenticated chat streaming with HTTP 401', async ({ request }) => {
    const response = await request.post('/chat', {
      data: { message: 'Can you summarize the architecture?' },
    });
    expect(response.status()).toBe(401);
  });
});
