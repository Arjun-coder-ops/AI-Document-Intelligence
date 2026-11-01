import { describe, it, expect, vi, afterEach } from 'vitest';
import { MockLLMProvider, GroqLLMProvider } from './llm.js';

describe('packages/rag: LLM Providers', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('generates text via MockLLMProvider', async () => {
    const provider = new MockLLMProvider('mock-test', 0);
    const text = await provider.generateText('What is consensus?');
    expect(text).toContain('Mock synthesis');
    expect(text).toContain('[1]');
  });

  it('streams tokens and fires callbacks cleanly', async () => {
    const provider = new MockLLMProvider('mock-test', 1);
    const receivedTokens: string[] = [];
    let metaReceived = false;

    await provider.streamText('query', {
      onToken: (tok) => receivedTokens.push(tok),
      onMeta: () => {
        metaReceived = true;
      },
    });

    expect(metaReceived).toBe(true);
    expect(receivedTokens.length).toBeGreaterThan(5);
    expect(receivedTokens.join('')).toContain('[1]');
  });

  it('aborts streaming immediately when AbortSignal is triggered', async () => {
    const provider = new MockLLMProvider('mock-test', 20);
    const controller = new AbortController();

    setTimeout(() => {
      controller.abort();
    }, 15);

    await expect(
      provider.streamText(
        'query',
        {},
        { signal: controller.signal },
      ),
    ).rejects.toThrow(/aborted/);
  });

  it('throws immediately if signal is already aborted before starting', async () => {
    const provider = new MockLLMProvider('mock-test', 0);
    const controller = new AbortController();
    controller.abort();

    await expect(
      provider.streamText('query', {}, { signal: controller.signal }),
    ).rejects.toThrow(/aborted/);
  });

  it('handles mid-stream provider failures', async () => {
    const provider = new MockLLMProvider('mock-test', 1, true); // shouldFailMidStream = true

    await expect(
      provider.streamText('query', {}),
    ).rejects.toThrow('Simulated upstream LLM socket termination');
  });

  describe('GroqLLMProvider', () => {
    it('throws error when apiKey is missing', async () => {
      const provider = new GroqLLMProvider('llama-3', '');
      await expect(provider.generateText('hello')).rejects.toThrow(/GROQ_API_KEY.*not configured/);
      await expect(provider.streamText('hello', {})).rejects.toThrow(/GROQ_API_KEY.*not configured/);
    });

    it('generates text successfully on 200 OK', async () => {
      const provider = new GroqLLMProvider('llama-3', 'test-key');
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => {
          await Promise.resolve();
          return {
            choices: [{ message: { content: 'Synthesized response [1]' } }],
          };
        },
      } as unknown as Response);

      const res = await provider.generateText('Test prompt');
      expect(res).toBe('Synthesized response [1]');
    });

    it('throws error on non-OK fetch response', async () => {
      const provider = new GroqLLMProvider('llama-3', 'test-key');
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: false,
        status: 429,
        text: async () => {
          await Promise.resolve();
          return 'Rate limit exceeded';
        },
      } as unknown as Response);

      await expect(provider.generateText('Test')).rejects.toThrow(/Groq API error 429/);
    });

    it('streams SSE tokens and notifies callbacks', async () => {
      const provider = new GroqLLMProvider('llama-3', 'test-key');
      const ssePayload = [
        'data: {"choices":[{"delta":{"content":"Hello"}}]}\n\n',
        'data: {"choices":[{"delta":{"content":" World"}}]}\n\n',
        'data: [DONE]\n\n',
      ].join('');

      const stream = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(new TextEncoder().encode(ssePayload));
          controller.close();
        },
      });

      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        body: stream,
      } as unknown as Response);

      const tokens: string[] = [];
      let metaTriggered = false;

      await provider.streamText('Test', {
        onMeta: () => {
          metaTriggered = true;
        },
        onToken: (t) => tokens.push(t),
      });

      expect(metaTriggered).toBe(true);
      expect(tokens).toEqual(['Hello', ' World']);
    });

    it('throws when streaming response returns non-OK status', async () => {
      const provider = new GroqLLMProvider('llama-3', 'test-key');
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: async () => {
          await Promise.resolve();
          return 'Internal Server Error';
        },
      } as unknown as Response);

      await expect(provider.streamText('Test', {})).rejects.toThrow(/Groq stream error 500/);
    });
  });
});
