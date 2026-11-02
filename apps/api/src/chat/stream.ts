import crypto from 'crypto';
import type { Response } from 'express';
import { type SSEEventMeta, type SSEEventError } from '@docsage/shared';
import {
  executeHybridRetrieval,
  buildRAGPrompt,
  verifyAndExtractCitations,
  filterModelOutput,
  estimateTokens,
  type LLMProvider,
} from '@docsage/rag';
import { postgresQueryExecutor } from './service.js';
import { queryCache } from '../reliability/cache.js';
import {
  stageLatencyHistogram,
  tokensCounter,
  costCounter,
  streamAbortsCounter,
  retrievalTop1Histogram,
} from '../observability/metrics.js';
import {
  resolveOrCreateConversation,
  recordUserMessage,
  loadConversationHistory,
  recordAssistantMessage,
} from './db.js';

export interface StreamPipelineOptions {
  user: { userId?: string | undefined; sub?: string | undefined; tenantId: string; role: string };
  message: string;
  conversationId?: string | undefined;
  historyLimit?: number | undefined;
  res: Response;
  llmProvider: LLMProvider;
  getQueryEmbedding: (query: string) => Promise<number[]>;
}

export async function executeChatStream(options: StreamPipelineOptions): Promise<void> {
  const { user, message, res, llmProvider, getQueryEmbedding, historyLimit = 6 } = options;

  const requestId = crypto.randomUUID();
  const startTime = Date.now();
  let ttftRecorded: number | null = null;

  // 1. Setup SSE Response Headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  const abortController = new AbortController();
  let isClientClosed = false;

  const onClose = (): void => {
    isClientClosed = true;
    abortController.abort();
    streamAbortsCounter.inc({ tenant_id: user.tenantId });
  };
  res.on('close', onClose);

  const cleanup = (): void => {
    res.removeListener('close', onClose);
  };

  const sendSSE = (event: string, data: unknown): void => {
    if (isClientClosed || res.writableEnded) return;
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  try {
    // 2. Resolve Conversation & Emit Meta
    const userId = user.userId ?? user.sub ?? 'anonymous';
    const conversationId = await resolveOrCreateConversation(
      user.tenantId,
      userId,
      message,
      options.conversationId,
    );

    const metaPayload: SSEEventMeta = {
      conversationId,
      requestId,
      model: llmProvider.modelName,
    };
    sendSSE('meta', metaPayload);

    // 3. Record User Message
    await recordUserMessage(user.tenantId, conversationId, message);

    // 4. Query Embedding & Semantic Cache Check
    const queryEmbedding = await getQueryEmbedding(message);
    const cachedHit = queryCache.get(user.tenantId, message, queryEmbedding);

    if (cachedHit) {
      sendSSE('token', { token: cachedHit.text });
      sendSSE('citations', { citations: cachedHit.citations });
      sendSSE('done', {
        aborted: false,
        error: false,
        totalTokens: cachedHit.totalTokens,
        estimatedCost: 0,
        latencyMs: Date.now() - startTime,
        ttftMs: Date.now() - startTime,
      });
      cleanup();
      res.end();
      return;
    }

    // 5. Load History & Execute Hybrid Retrieval
    await loadConversationHistory(user.tenantId, conversationId, historyLimit);

    const retrievalStart = Date.now();
    const retrievalResult = await executeHybridRetrieval(
      user.tenantId,
      message,
      queryEmbedding,
      postgresQueryExecutor,
      undefined,
      { hybrid: true, fusionK: 60, relevanceThreshold: 0.05 },
    );
    const retrievalLatency = Date.now() - retrievalStart;
    stageLatencyHistogram.observe({ stage: 'retrieval' }, retrievalLatency / 1000);

    if (retrievalResult.chunks[0]) {
      retrievalTop1Histogram.observe({ hybrid: 'true' }, retrievalResult.chunks[0].score);
    }

    // 6. Handle Relevance Threshold Short-Circuit
    if (retrievalResult.shortCircuited) {
      const notFoundText =
        retrievalResult.fallbackMessage ??
        'I could not find relevant information in your uploaded documents to answer this question.';

      sendSSE('token', { token: notFoundText });
      sendSSE('citations', { citations: [] });

      const totalDuration = Date.now() - startTime;
      await recordAssistantMessage({
        tenantId: user.tenantId,
        conversationId,
        content: notFoundText,
        citations: [],
        totalDurationMs: totalDuration,
        ttftMs: totalDuration,
        promptTokens: estimateTokens(message),
        completionTokens: estimateTokens(notFoundText),
        estimatedCost: '0.000000',
      });

      sendSSE('done', {
        aborted: false,
        error: false,
        totalTokens: estimateTokens(message) + estimateTokens(notFoundText),
        latencyMs: totalDuration,
        ttftMs: totalDuration,
      });

      cleanup();
      res.end();
      return;
    }

    // 7. Grounded Synthesis & Streaming Text
    const formattedPrompt = buildRAGPrompt(message, retrievalResult.chunks);
    let accumulatedResponse = '';

    await llmProvider.streamText(
      `${formattedPrompt.systemPrompt}\n\n${formattedPrompt.userPrompt}`,
      {
        onToken: (tok: string) => {
          if (!ttftRecorded) ttftRecorded = Date.now() - startTime;
          accumulatedResponse += tok;
          void sendSSE('token', { token: tok });
        },
      },
      { signal: abortController.signal },
    );

    // 8. Output Filtering & Citations
    const filtered = filterModelOutput(accumulatedResponse);
    accumulatedResponse = filtered.filteredOutput;
    const citationResult = verifyAndExtractCitations(
      accumulatedResponse,
      formattedPrompt.contextChunks,
    );

    sendSSE('citations', { citations: citationResult.verifiedCitations });

    // 9. Metrics & Persistence
    const promptTokens = estimateTokens(formattedPrompt.userPrompt);
    const completionTokens = estimateTokens(accumulatedResponse);
    const totalTokens = promptTokens + completionTokens;
    const totalDuration = Date.now() - startTime;
    const costEstimateNumber = (promptTokens * 0.05 + completionTokens * 0.1) / 1_000_000;
    const costEstimateStr = costEstimateNumber.toFixed(6);

    await recordAssistantMessage({
      tenantId: user.tenantId,
      conversationId,
      content: citationResult.cleanedText,
      citations: citationResult.verifiedCitations,
      ttftMs: ttftRecorded ?? totalDuration,
      totalDurationMs: totalDuration,
      promptTokens,
      completionTokens,
      estimatedCost: costEstimateStr,
    });

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

    if (ttftRecorded) stageLatencyHistogram.observe({ stage: 'llm_ttft' }, ttftRecorded / 1000);
    stageLatencyHistogram.observe({ stage: 'llm_total' }, totalDuration / 1000);
    tokensCounter.inc(
      { tenant_id: user.tenantId, model: llmProvider.modelName, token_type: 'prompt' },
      promptTokens,
    );
    tokensCounter.inc(
      { tenant_id: user.tenantId, model: llmProvider.modelName, token_type: 'completion' },
      completionTokens,
    );
    costCounter.inc({ tenant_id: user.tenantId, model: llmProvider.modelName }, costEstimateNumber);

    sendSSE('done', {
      aborted: false,
      error: false,
      totalTokens,
      estimatedCost: costEstimateNumber,
      latencyMs: totalDuration,
      ttftMs: ttftRecorded ?? totalDuration,
    });

    cleanup();
    res.end();
  } catch (err: unknown) {
    cleanup();

    if (isClientClosed || (err instanceof Error && err.name === 'AbortError')) {
      if (!res.writableEnded) res.end();
      return;
    }

    const errorMsg = err instanceof Error ? err.message : 'Internal streaming chat error';
    const errorPayload: SSEEventError = { code: 'STREAM_PROCESSING_ERROR', message: errorMsg };

    try {
      sendSSE('error', errorPayload);
      sendSSE('done', { aborted: false, error: true });
    } catch {
      // Ignore socket write failures if client terminated abruptly
    }

    if (!res.writableEnded) res.end();
  }
}
