import { Router, type Response } from 'express';
import crypto from 'crypto';
import { eq, and, desc } from 'drizzle-orm';
import { conversations, messages, withTenant } from '@docsage/db';
import {
  ChatRequestSchema,
  type SSEEventMeta,
  type SSEEventToken,
  type SSEEventCitations,
  type SSEEventError,
  type SSEEventDone,
} from '@docsage/shared';
import {
  executeHybridRetrieval,
  buildRAGPrompt,
  verifyAndExtractCitations,
  filterModelOutput,
  estimateTokens,
  type LLMProvider,
  MockLLMProvider,
  GroqLLMProvider,
} from '@docsage/rag';
import { authenticate, requireRole, type AuthenticatedRequest } from '../auth/middleware.js';
import { postgresQueryExecutor } from './service.js';
import { createRateLimiterMiddleware } from '../reliability/rate-limiter.js';
import { checkTenantMonthlyQuota } from '../reliability/quota.js';
import { queryCache } from '../reliability/cache.js';
import {
  stageLatencyHistogram,
  tokensCounter,
  costCounter,
  streamAbortsCounter,
  retrievalTop1Histogram,
} from '../observability/metrics.js';

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
    vec.push(Number(((byte / 128) - 1).toFixed(4)));
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

    const { conversationId: reqConversationId, message, historyLimit = 6 } = parseResult.data;
    const requestId = crypto.randomUUID();
    const startTime = Date.now();
    let ttftRecorded: number | null = null;

    // 1. Setup SSE Response Headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    // 2. Wire AbortController end-to-end
    const abortController = new AbortController();
    let isClientClosed = false;

    req.on('close', () => {
      if (!res.writableEnded) {
        isClientClosed = true;
        streamAbortsCounter.inc({ tenant_id: user.tenantId });
        abortController.abort();
      }
    });

    // 3. Heartbeat comments every 15s to keep connection alive through proxies
    const heartbeatTimer = setInterval(() => {
      if (!res.writableEnded && !isClientClosed) {
        res.write(': heartbeat\n\n');
      }
    }, 15000);

    const cleanup = () => {
      clearInterval(heartbeatTimer);
    };

    // 4. Backpressure-aware SSE writer
    const sendSSE = async (event: string, data: unknown): Promise<void> => {
      if (res.writableEnded || isClientClosed) return;
      const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
      const canWrite = res.write(payload);
      if (!canWrite) {
        await new Promise<void>((resolve) => {
          res.once('drain', resolve);
        });
      }
    };

    try {
      // 5. Ensure or Create Conversation
      let conversationId = reqConversationId;
      if (!conversationId) {
        const titleSnippet = message.slice(0, 50).trim();
        const [createdConv] = await withTenant(user.tenantId, async (tx) => {
          return tx
            .insert(conversations)
            .values({
              tenantId: user.tenantId,
              userId: user.sub,
              title: titleSnippet || 'New Conversation',
            })
            .returning({ id: conversations.id });
        });
        if (createdConv) {
          conversationId = createdConv.id;
        } else {
          throw new Error('Failed to create conversation');
        }
      }

      // Persist User Message
      await withTenant(user.tenantId, async (tx) => {
        await tx.insert(messages).values({
          tenantId: user.tenantId,
          conversationId,
          role: 'user',
          content: message,
        });
      });

      // Emit Meta Event
      const llmProvider = getLLMProvider();
      const metaPayload: SSEEventMeta = {
        requestId,
        conversationId,
        model: llmProvider.modelName,
      };
      await sendSSE('meta', metaPayload);

      // 6. Fetch Conversation History Window
      const _history = await withTenant(user.tenantId, async (tx) => {
        return tx.query.messages.findMany({
          where: and(
            eq(messages.tenantId, user.tenantId),
            eq(messages.conversationId, conversationId),
          ),
          orderBy: [desc(messages.createdAt)],
          limit: historyLimit,
        });
      });
      _history.reverse();

      // 7. Embed Query & Check Multi-Tier Cache
      const embedStart = Date.now();
      const queryEmbedding = await getQueryEmbedding(message);
      stageLatencyHistogram.observe({ stage: 'embed' }, (Date.now() - embedStart) / 1000);

      const cached = queryCache.get(user.tenantId, message, queryEmbedding);
      if (cached) {
        const tokenPayload: SSEEventToken = { token: cached.text };
        await sendSSE('token', tokenPayload);

        const citationsPayload: SSEEventCitations = { citations: cached.citations };
        await sendSSE('citations', citationsPayload);

        const totalDuration = Date.now() - startTime;
        await withTenant(user.tenantId, async (tx) => {
          await tx.insert(messages).values({
            tenantId: user.tenantId,
            conversationId,
            role: 'assistant',
            content: cached.text,
            citations: cached.citations,
            ttftMs: totalDuration,
            totalDurationMs: totalDuration,
            promptTokens: estimateTokens(message),
            completionTokens: cached.totalTokens,
            estimatedCost: '0.000000',
          });
        });

        const donePayload: SSEEventDone = {
          aborted: false,
          error: false,
          totalTokens: cached.totalTokens,
          estimatedCost: 0,
          latencyMs: totalDuration,
          ttftMs: totalDuration,
        };
        await sendSSE('done', donePayload);

        cleanup();
        res.end();
        return;
      }

      const retStart = Date.now();
      const retrievalResult = await executeHybridRetrieval(
        user.tenantId,
        message,
        queryEmbedding,
        postgresQueryExecutor,
      );
      stageLatencyHistogram.observe({ stage: 'retrieval' }, (Date.now() - retStart) / 1000);
      const topScore = retrievalResult.chunks[0]?.score;
      if (typeof topScore === 'number') {
        retrievalTop1Histogram.observe(topScore);
      }

      // 8. Handle Relevance Threshold Short-Circuit
      if (retrievalResult.shortCircuited) {
        const notFoundText =
          retrievalResult.fallbackMessage ??
          'I could not find relevant information in your uploaded documents to answer this question.';

        const tokenPayload: SSEEventToken = { token: notFoundText };
        await sendSSE('token', tokenPayload);

        const emptyCitations: SSEEventCitations = { citations: [] };
        await sendSSE('citations', emptyCitations);

        const totalDuration = Date.now() - startTime;

        // Persist Assistant Message
        await withTenant(user.tenantId, async (tx) => {
          await tx.insert(messages).values({
            tenantId: user.tenantId,
            conversationId,
            role: 'assistant',
            content: notFoundText,
            citations: [],
            totalDurationMs: totalDuration,
            ttftMs: totalDuration,
            promptTokens: estimateTokens(message),
            completionTokens: estimateTokens(notFoundText),
            estimatedCost: '0.000000',
          });
        });

        const donePayload: SSEEventDone = {
          aborted: false,
          error: false,
          totalTokens: estimateTokens(message) + estimateTokens(notFoundText),
          latencyMs: totalDuration,
          ttftMs: totalDuration,
        };
        await sendSSE('done', donePayload);

        cleanup();
        res.end();
        return;
      }

      // 9. Build Grounded Prompt with Sandboxed Context
      const formattedPrompt = buildRAGPrompt(message, retrievalResult.chunks);
      let accumulatedResponse = '';

      // 10. Stream Text from Provider with Cancellation Signal
      await llmProvider.streamText(
        `${formattedPrompt.systemPrompt}\n\n${formattedPrompt.userPrompt}`,
        {
          onToken: (tok: string) => {
            if (!ttftRecorded) {
              ttftRecorded = Date.now() - startTime;
            }
            accumulatedResponse += tok;
            void sendSSE('token', { token: tok });
          },
        },
        {
          signal: abortController.signal,
        },
      );

      // 11. Apply Output Filtering (detect prompt leak or canary reflection)
      const filtered = filterModelOutput(accumulatedResponse);
      accumulatedResponse = filtered.filteredOutput;

      // 12. Parse and Verify Citations
      const citationResult = verifyAndExtractCitations(
        accumulatedResponse,
        formattedPrompt.contextChunks,
      );

      const citationsPayload: SSEEventCitations = {
        citations: citationResult.verifiedCitations,
      };
      await sendSSE('citations', citationsPayload);

      // 12. Calculate Token Usage, Stage Latencies, and Cost Estimates
      const promptTokens = estimateTokens(formattedPrompt.userPrompt);
      const completionTokens = estimateTokens(accumulatedResponse);
      const totalTokens = promptTokens + completionTokens;
      const totalDuration = Date.now() - startTime;

      // $0.05 / 1M input tokens + $0.10 / 1M output tokens
      const costEstimateNumber = (promptTokens * 0.05 + completionTokens * 0.1) / 1_000_000;
      const costEstimateStr = costEstimateNumber.toFixed(6);

      // 13. Persist Grounded Assistant Message with Citations & Metrics
      await withTenant(user.tenantId, async (tx) => {
        await tx.insert(messages).values({
          tenantId: user.tenantId,
          conversationId,
          role: 'assistant',
          content: citationResult.cleanedText,
          citations: citationResult.verifiedCitations,
          ttftMs: ttftRecorded ?? totalDuration,
          totalDurationMs: totalDuration,
          promptTokens,
          completionTokens,
          estimatedCost: costEstimateStr,
        });
      });

      // Populate Query Cache
      queryCache.set(
        user.tenantId,
        message,
        {
          text: citationResult.cleanedText,
          citations: citationResult.verifiedCitations,
          totalTokens,
        },
        queryEmbedding,
      );

      // Record Prometheus Stage Latency, Token Usage, and Cost Metrics
      if (ttftRecorded) {
        stageLatencyHistogram.observe({ stage: 'llm_ttft' }, ttftRecorded / 1000);
      }
      stageLatencyHistogram.observe({ stage: 'llm_total' }, totalDuration / 1000);
      tokensCounter.inc({ tenant_id: user.tenantId, model: llmProvider.modelName, token_type: 'prompt' }, promptTokens);
      tokensCounter.inc({ tenant_id: user.tenantId, model: llmProvider.modelName, token_type: 'completion' }, completionTokens);
      costCounter.inc({ tenant_id: user.tenantId, model: llmProvider.modelName }, costEstimateNumber);

      // 14. Emit Done Event
      const donePayload: SSEEventDone = {
        aborted: false,
        error: false,
        totalTokens,
        estimatedCost: costEstimateNumber,
        latencyMs: totalDuration,
        ttftMs: ttftRecorded ?? totalDuration,
      };
      await sendSSE('done', donePayload);

      cleanup();
      res.end();
    } catch (err: unknown) {
      cleanup();

      if (isClientClosed || (err instanceof Error && err.name === 'AbortError')) {
        // Client intentionally aborted stream - end cleanly without error frame
        if (!res.writableEnded) {
          res.end();
        }
        return;
      }

      // Mid-stream Failure: emit structured error event followed by done
      const errorMsg = err instanceof Error ? err.message : 'Internal streaming chat error';
      const errorPayload: SSEEventError = {
        code: 'STREAM_PROCESSING_ERROR',
        message: errorMsg,
      };

      try {
        await sendSSE('error', errorPayload);
        const doneErrorPayload: SSEEventDone = {
          aborted: false,
          error: true,
        };
        await sendSSE('done', doneErrorPayload);
      } catch {
        // Ignore socket write failures if client terminated abruptly
      }

      if (!res.writableEnded) {
        res.end();
      }
    }
  },
);
