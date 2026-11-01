import type { LLMProvider, StreamCallbacks } from './index.js';

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
                const err = new Error('LLM generation aborted by client');
                err.name = 'AbortError';
                reject(err);
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

export class GroqLLMProvider implements LLMProvider {
  constructor(
    public readonly modelName = process.env['GROQ_MODEL'] ?? 'llama-3.3-70b-versatile',
    private readonly apiKey = process.env['GROQ_API_KEY'] ?? '',
  ) {}

  async generateText(
    prompt: string,
    options?: { temperature?: number; maxTokens?: number },
  ): Promise<string> {
    if (!this.apiKey) {
      throw new Error('GROQ_API_KEY environment variable is not configured');
    }

    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.modelName,
        messages: [{ role: 'user', content: prompt }],
        temperature: options?.temperature ?? 0.1,
        max_tokens: options?.maxTokens ?? 1024,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Groq API error ${res.status}: ${err}`);
    }

    interface ChatCompletion {
      choices: Array<{ message: { content: string } }>;
    }
    const data = (await res.json()) as ChatCompletion;
    return data.choices[0]?.message.content ?? '';
  }

  async streamText(
    prompt: string,
    callbacks: StreamCallbacks,
    options?: { signal?: AbortSignal; temperature?: number; maxTokens?: number },
  ): Promise<void> {
    if (!this.apiKey) {
      throw new Error('GROQ_API_KEY environment variable is not configured');
    }

    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.modelName,
        messages: [{ role: 'user', content: prompt }],
        temperature: options?.temperature ?? 0.1,
        max_tokens: options?.maxTokens ?? 1024,
        stream: true,
      }),
      signal: options?.signal ?? null,
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Groq stream error ${res.status}: ${err}`);
    }

    callbacks.onMeta?.({ requestId: 'groq-stream', model: this.modelName });

    if (!res.body) {
      throw new Error('Groq response body is empty');
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (true) {
        if (options?.signal?.aborted) {
          await reader.cancel();
          const abortErr = new Error('LLM generation aborted by client');
          abortErr.name = 'AbortError';
          throw abortErr;
        }

        const chunkResult = (await reader.read()) as { done: boolean; value?: Uint8Array };
        if (chunkResult.done) break;

        if (chunkResult.value) {
          buffer += decoder.decode(chunkResult.value, { stream: true });
        }
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith('data: ')) continue;
          const jsonStr = trimmed.slice(6);
          if (jsonStr === '[DONE]') break;

          try {
            interface ChunkDelta {
              choices: Array<{ delta: { content?: string } }>;
            }
            const chunk = JSON.parse(jsonStr) as ChunkDelta;
            const content = chunk.choices[0]?.delta.content;
            if (content) {
              callbacks.onToken?.(content);
            }
          } catch {
            // Ignore partial SSE chunk parse error
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }
}
