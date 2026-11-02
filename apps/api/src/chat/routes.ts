import { Router, type Response } from 'express';
import crypto from 'crypto';
import { ChatRequestSchema } from '@docsage/shared';
import { type LLMProvider, MockLLMProvider, GroqLLMProvider } from '@docsage/rag';
import { authenticate, requireRole, type AuthenticatedRequest } from '../auth/middleware.js';
import { createRateLimiterMiddleware } from '../reliability/rate-limiter.js';
import { checkTenantMonthlyQuota } from '../reliability/quota.js';
import { executeChatStream } from './stream.js';

export const chatRouter: Router = Router();

const chatRateLimiter = createRateLimiterMiddleware({
  userCapacity: 20,
  tenantCapacity: 100,
  refillPerMinute: 60,
});

// LLM Provider Factory
function getLLMProvider(): LLMProvider {
  const providerType = process.env['LLM_PROVIDER'] ?? 'mock';
  if (providerType === 'groq' && process.env['GROQ_API_KEY']) {
    return new GroqLLMProvider();
  }
  return new MockLLMProvider('mock-llama-3.3');
}

// Deterministic 384-dim embedding mock for fast vector lookup
async function getQueryEmbedding(query: string): Promise<number[]> {
  await Promise.resolve();
  const hash = crypto.createHash('sha256').update(query).digest();
  const vec: number[] = [];
  for (let i = 0; i < 384; i++) {
    const byte = hash[i % hash.length] ?? 0;
    vec.push(Number((byte / 128 - 1).toFixed(4)));
  }
  const norm = Math.sqrt(vec.reduce((sum, val) => sum + val * val, 0));
  return vec.map((val) => Number((val / (norm || 1)).toFixed(4)));
}

chatRouter.post(
  '/',
  authenticate,
  requireRole('viewer'),
  chatRateLimiter,
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const user = req.user;
    if (!user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const quota = await checkTenantMonthlyQuota(user.tenantId);
    if (!quota.withinQuota) {
      res.status(402).json({
        error: `Monthly quota exceeded ($${quota.currentCost} / $${quota.monthlyLimit}). Upgrade tenant tier to continue.`,
      });
      return;
    }

    const parseResult = ChatRequestSchema.safeParse(req.body);
    if (!parseResult.success) {
      res.status(400).json({ error: 'Invalid chat request', details: parseResult.error.flatten() });
      return;
    }

    const { conversationId, message, historyLimit } = parseResult.data;

    await executeChatStream({
      user,
      message,
      conversationId,
      historyLimit,
      res,
      llmProvider: getLLMProvider(),
      getQueryEmbedding,
    });
  },
);
