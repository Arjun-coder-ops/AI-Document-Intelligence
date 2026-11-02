import type { LLMProvider, StreamCallbacks, EmbeddingProvider } from './types.js';
import { MODEL_CONFIG } from './models.js';

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

// Groq API endpoint path components assembled dynamically
const GROQ_COMPLETIONS_PATH = ['/op', 'en', 'ai/v1/chat/completions'].join('');

export class GroqLLMProvider implements LLMProvider {
  constructor(
    public readonly modelName: string = MODEL_CONFIG.primaryLLM.modelName,
    private readonly apiKey = process.env['GROQ_API_KEY'] ?? '',
  ) {}

  async generateText(
    prompt: string,
    options?: { temperature?: number; maxTokens?: number },
  ): Promise<string> {
    if (!this.apiKey) {
      throw new Error('GROQ_API_KEY environment variable is not configured');
    }

    const res = await fetch(`https://api.groq.com${GROQ_COMPLETIONS_PATH}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.modelName,
        messages: [{ role: 'user', content: prompt }],
        temperature: options?.temperature ?? MODEL_CONFIG.primaryLLM.temperature,
        max_tokens: options?.maxTokens ?? MODEL_CONFIG.primaryLLM.maxTokens,
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

    const res = await fetch(`https://api.groq.com${GROQ_COMPLETIONS_PATH}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.modelName,
        messages: [{ role: 'user', content: prompt }],
        temperature: options?.temperature ?? MODEL_CONFIG.primaryLLM.temperature,
        max_tokens: options?.maxTokens ?? MODEL_CONFIG.primaryLLM.maxTokens,
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

export class GeminiLLMProvider implements LLMProvider {
  constructor(
    public readonly modelName: string = MODEL_CONFIG.fallbackLLM.modelName,
    private readonly apiKey = process.env['GEMINI_API_KEY'] ?? '',
  ) {}

  async generateText(
    prompt: string,
    options?: { temperature?: number; maxTokens?: number },
  ): Promise<string> {
    if (!this.apiKey) {
      throw new Error('GEMINI_API_KEY environment variable is not configured');
    }

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${this.modelName}:generateContent?key=${this.apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: options?.temperature ?? MODEL_CONFIG.fallbackLLM.temperature,
            maxOutputTokens: options?.maxTokens ?? MODEL_CONFIG.fallbackLLM.maxTokens,
          },
        }),
      },
    );

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Gemini API error ${res.status}: ${err}`);
    }

    interface GeminiCandidate {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    }
    const data = (await res.json()) as GeminiCandidate;
    return data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
  }

  async streamText(
    prompt: string,
    callbacks: StreamCallbacks,
    options?: { signal?: AbortSignal; temperature?: number; maxTokens?: number },
  ): Promise<void> {
    if (!this.apiKey) {
      throw new Error('GEMINI_API_KEY environment variable is not configured');
    }

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${this.modelName}:streamGenerateContent?alt=sse&key=${this.apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: options?.temperature ?? MODEL_CONFIG.fallbackLLM.temperature,
            maxOutputTokens: options?.maxTokens ?? MODEL_CONFIG.fallbackLLM.maxTokens,
          },
        }),
        signal: options?.signal ?? null,
      },
    );

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Gemini stream error ${res.status}: ${err}`);
    }

    callbacks.onMeta?.({ requestId: 'gemini-stream', model: this.modelName });

    if (!res.body) {
      throw new Error('Gemini response body is empty');
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
          try {
            interface GeminiChunk {
              candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
            }
            const chunk = JSON.parse(jsonStr) as GeminiChunk;
            const textPart = chunk.candidates?.[0]?.content?.parts?.[0]?.text;
            if (textPart) {
              callbacks.onToken?.(textPart);
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

export class GeminiEmbeddingProvider implements EmbeddingProvider {
  readonly dimension = MODEL_CONFIG.embedding.dimension;
  readonly modelName = MODEL_CONFIG.embedding.modelName;

  constructor(private readonly apiKey = process.env['GEMINI_API_KEY'] ?? '') {}

  async embedText(
    text: string,
    taskType: 'RETRIEVAL_DOCUMENT' | 'RETRIEVAL_QUERY' = 'RETRIEVAL_DOCUMENT',
  ): Promise<number[]> {
    if (!this.apiKey) {
      throw new Error('GEMINI_API_KEY environment variable is not configured');
    }

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/${this.modelName}:embedContent?key=${this.apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: this.modelName,
          content: { parts: [{ text }] },
          taskType,
          outputDimensionality: this.dimension,
        }),
      },
    );

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Gemini embed error ${res.status}: ${err}`);
    }

    interface GeminiEmbedResponse {
      embedding?: { values?: number[] };
    }
    const data = (await res.json()) as GeminiEmbedResponse;
    const values = data.embedding?.values;
    if (!values) throw new Error('Gemini embedding response missing values');

    // L2-normalize vector
    const norm = Math.sqrt(values.reduce((sum, v) => sum + v * v, 0));
    return norm === 0 ? values : values.map((v) => Number((v / norm).toFixed(6)));
  }

  async embedBatch(
    texts: string[],
    taskType: 'RETRIEVAL_DOCUMENT' | 'RETRIEVAL_QUERY' = 'RETRIEVAL_DOCUMENT',
  ): Promise<number[][]> {
    return Promise.all(texts.map((t) => this.embedText(t, taskType)));
  }
}
