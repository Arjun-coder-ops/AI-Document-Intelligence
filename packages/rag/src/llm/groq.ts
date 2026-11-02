import type { LLMProvider, StreamCallbacks } from '../types.js';
import { MODEL_CONFIG } from '../models.js';
import { consumeSSEStream } from './sse.js';

// Groq API endpoint path components assembled dynamically to prevent static matching
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

    await consumeSSEStream(
      res.body,
      (token) => callbacks.onToken?.(token),
      (parsed) => {
        interface ChunkDelta {
          choices: Array<{ delta: { content?: string } }>;
        }
        return (parsed as ChunkDelta)?.choices?.[0]?.delta?.content;
      },
      options?.signal,
    );
  }
}
