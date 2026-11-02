import type { LLMProvider, StreamCallbacks, EmbeddingProvider } from '../types.js';
import { MODEL_CONFIG } from '../models.js';
import { consumeSSEStream } from './sse.js';

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

    await consumeSSEStream(
      res.body,
      (token) => callbacks.onToken?.(token),
      (parsed) => {
        interface GeminiChunk {
          candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
        }
        return (parsed as GeminiChunk)?.candidates?.[0]?.content?.parts?.[0]?.text;
      },
      options?.signal,
    );
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
