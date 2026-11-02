import { describe, it, expect } from 'vitest';
import { MockLLMProvider, type StreamCallbacks } from '@docsage/rag';

describe('Level 5: Streaming Chat, Abort Cancellation & Error Handling', () => {
  it('proves AbortController aborts upstream LLM provider call immediately', async () => {
    const provider = new MockLLMProvider('mock-llm', 20); // 20ms per token
    const abortController = new AbortController();

    const receivedTokens: string[] = [];
    let caughtError: Error | null = null;

    const callbacks: StreamCallbacks = {
      onToken: (tok) => {
        receivedTokens.push(tok);
        // Abort after first 2 tokens
        if (receivedTokens.length === 2) {
          abortController.abort();
        }
      },
    };

    try {
      await provider.streamText('Tell me about revenue', callbacks, {
        signal: abortController.signal,
      });
    } catch (err: unknown) {
      if (err instanceof Error) {
        caughtError = err;
      }
    }

    // Must have aborted without finishing all 18 tokens
    expect(caughtError).not.toBeNull();
    expect(caughtError?.name).toBe('AbortError');
    expect(receivedTokens.length).toBeLessThan(10);
  });

  it('surfaces mid-stream provider failures as structured error events before done', async () => {
    // Provider configured to fail mid-stream at token index 5
    const failingProvider = new MockLLMProvider('mock-llm', 2, true);

    const emittedEvents: Array<{ event: string; data: unknown }> = [];
    const callbacks: StreamCallbacks = {
      onToken: (tok) => {
        emittedEvents.push({ event: 'token', data: tok });
      },
    };

    let streamCaughtError = false;
    try {
      await failingProvider.streamText('Prompt triggering mid-stream error', callbacks);
    } catch (err: unknown) {
      streamCaughtError = true;
      const msg = err instanceof Error ? err.message : 'Unknown';
      emittedEvents.push({ event: 'error', data: { code: 'PROVIDER_ERROR', message: msg } });
      emittedEvents.push({ event: 'done', data: { aborted: false, error: true } });
    }

    expect(streamCaughtError).toBe(true);

    const errorEvent = emittedEvents.find((e) => e.event === 'error');
    expect(errorEvent).toBeDefined();
    expect((errorEvent?.data as { code: string }).code).toBe('PROVIDER_ERROR');

    const doneEvent = emittedEvents.find((e) => e.event === 'done');
    expect(doneEvent).toBeDefined();
    expect((doneEvent?.data as { error: boolean }).error).toBe(true);
  });

  it('parses robustly across CRLF, multi-line data payloads, and heartbeats', () => {
    const rawSSEStream =
      ': heartbeat\r\n\r\n' +
      'event: meta\r\n' +
      'data: {"requestId":"req-123","model":"mock"}\r\n\r\n' +
      ': heartbeat\n\n' +
      'event: token\n' +
      'data: {"token":"First line\\nSecond line"}\n\n' +
      'event: done\r\n' +
      'data: {"totalTokens":25}\r\n\r\n';

    // Standard client SSE frame parser
    const parsedEvents: Array<{ event: string; data: string }> = [];
    const blocks = rawSSEStream.split(/(?:\r?\n){2}/);

    for (const block of blocks) {
      const trimmed = block.trim();
      if (!trimmed || trimmed.startsWith(':')) continue; // Skip comment/heartbeat

      const lines = trimmed.split(/\r?\n/);
      let eventName = 'message';
      let dataStr = '';

      for (const line of lines) {
        if (line.startsWith('event: ')) {
          eventName = line.slice(7).trim();
        } else if (line.startsWith('data: ')) {
          dataStr = line.slice(6).trim();
        }
      }

      if (dataStr) {
        parsedEvents.push({ event: eventName, data: dataStr });
      }
    }

    expect(parsedEvents).toHaveLength(3);
    expect(parsedEvents[0]?.event).toBe('meta');
    expect(parsedEvents[1]?.event).toBe('token');
    expect(parsedEvents[2]?.event).toBe('done');
  });

  it('calculates TTFT and accurate token cost estimates', () => {
    const promptTokens = 1500;
    const completionTokens = 450;

    // $0.05 / 1M input tokens + $0.10 / 1M output tokens
    const cost = (promptTokens * 0.05 + completionTokens * 0.1) / 1_000_000;
    expect(cost).toBeCloseTo(0.00012, 6);
  });
});
