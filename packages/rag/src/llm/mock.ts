import type { LLMProvider, StreamCallbacks } from '../types.js';

export class MockLLMProvider implements LLMProvider {
  constructor(
    public readonly modelName = 'mock-llm-v1',
    private readonly tokenDelayMs = 5,
    private readonly shouldFailMidStream = false,
  ) {}

  async generateText(prompt: string): Promise<string> {
    await Promise.resolve();
    return `Mock synthesis based on context: ${prompt.slice(0, 50)}... [1]`;
  }

  async streamText(
    _prompt: string,
    callbacks: StreamCallbacks,
    options?: { signal?: AbortSignal; temperature?: number; maxTokens?: number },
  ): Promise<void> {
    const tokens = [
      'Based ',
      'on ',
      'the ',
      'uploaded ',
      'documentation, ',
      'the ',
      'requested ',
      'information ',
      'is ',
      'confirmed ',
      '[1]. ',
      'Furthermore, ',
      'subsequent ',
      'evidence ',
      'supports ',
      'this ',
      'conclusion ',
      '[2].',
    ];

    callbacks.onMeta?.({ requestId: 'mock-req-id', model: this.modelName });

    for (let i = 0; i < tokens.length; i++) {
      if (options?.signal?.aborted) {
        const abortErr = new Error('LLM generation aborted by client');
        abortErr.name = 'AbortError';
        throw abortErr;
      }

      if (this.shouldFailMidStream && i === 5) {
        throw new Error('Simulated upstream LLM socket termination');
      }

      if (this.tokenDelayMs > 0) {
        await new Promise<void>((resolve, reject) => {
          const timeout = setTimeout(() => {
            resolve();
          }, this.tokenDelayMs);

          if (options?.signal) {
            options.signal.addEventListener(
              'abort',
              () => {
                clearTimeout(timeout);
                const abortErr = new Error('LLM generation aborted by client');
                abortErr.name = 'AbortError';
                reject(abortErr);
              },
              { once: true },
            );
          }
        });
      }

      const tok = tokens[i];
      if (tok) {
        callbacks.onToken?.(tok);
      }
    }
  }
}
