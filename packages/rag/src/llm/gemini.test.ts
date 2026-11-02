import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { GeminiLLMProvider, GeminiEmbeddingProvider } from './gemini.js';

describe('GeminiLLMProvider', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('throws an error if apiKey is empty', async () => {
    const provider = new GeminiLLMProvider('gemini-2.5-flash', '');
    await expect(provider.generateText('hello')).rejects.toThrow('GEMINI_API_KEY');
    await expect(provider.streamText('hello', {})).rejects.toThrow('GEMINI_API_KEY');
  });

  it('generates text successfully on valid API response', async () => {
    const mockResponse = {
      ok: true,
      json: vi.fn().mockResolvedValue({
        candidates: [{ content: { parts: [{ text: 'Generated answer' }] } }],
      }),
    };
    global.fetch = vi.fn().mockResolvedValue(mockResponse);

    const provider = new GeminiLLMProvider('gemini-2.5-flash', 'test-key');
    const result = await provider.generateText('test query');

    expect(result).toBe('Generated answer');
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('throws error when generateText receives non-ok response', async () => {
    const mockResponse = {
      ok: false,
      status: 403,
      text: vi.fn().mockResolvedValue('API key invalid'),
    };
    global.fetch = vi.fn().mockResolvedValue(mockResponse);

    const provider = new GeminiLLMProvider('gemini-2.5-flash', 'test-key');
    await expect(provider.generateText('test')).rejects.toThrow('Gemini API error 403');
  });

  it('streams text chunks using SSE', async () => {
    const ssePayload =
      'data: {"candidates":[{"content":{"parts":[{"text":"Hello"}]}}]}\n\n' +
      'data: {"candidates":[{"content":{"parts":[{"text":" world"}]}}]}\n\n';

    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode(ssePayload));
        controller.close();
      },
    });

    const mockResponse = {
      ok: true,
      body: stream,
    };
    global.fetch = vi.fn().mockResolvedValue(mockResponse);

    const provider = new GeminiLLMProvider('gemini-2.5-flash', 'test-key');
    const tokens: string[] = [];
    let metaCalled = false;

    await provider.streamText('stream query', {
      onToken: (t) => tokens.push(t),
      onMeta: () => {
        metaCalled = true;
      },
    });

    expect(metaCalled).toBe(true);
    expect(tokens.join('')).toBe('Hello world');
  });
});

describe('GeminiEmbeddingProvider', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('throws an error if apiKey is empty', async () => {
    const provider = new GeminiEmbeddingProvider('');
    await expect(provider.embedText('test')).rejects.toThrow('GEMINI_API_KEY');
  });

  it('embeds text and normalizes vector', async () => {
    const mockResponse = {
      ok: true,
      json: vi.fn().mockResolvedValue({
        embedding: {
          values: [3, 4],
        },
      }),
    };
    global.fetch = vi.fn().mockResolvedValue(mockResponse);

    const provider = new GeminiEmbeddingProvider('test-key');
    const embedding = await provider.embedText('document text');

    // Norm of [3, 4] is 5 -> [0.6, 0.8]
    expect(embedding).toEqual([0.6, 0.8]);
  });

  it('embeds multiple texts with embedBatch', async () => {
    const mockResponse = {
      ok: true,
      json: vi.fn().mockResolvedValue({
        embedding: {
          values: [0, 1],
        },
      }),
    };
    global.fetch = vi.fn().mockResolvedValue(mockResponse);

    const provider = new GeminiEmbeddingProvider('test-key');
    const embeddings = await provider.embedBatch(['text1', 'text2']);

    expect(embeddings).toHaveLength(2);
    expect(embeddings[0]).toEqual([0, 1]);
    expect(embeddings[1]).toEqual([0, 1]);
  });

  it('throws on non-ok response', async () => {
    const mockResponse = {
      ok: false,
      status: 500,
      text: vi.fn().mockResolvedValue('Internal error'),
    };
    global.fetch = vi.fn().mockResolvedValue(mockResponse);

    const provider = new GeminiEmbeddingProvider('test-key');
    await expect(provider.embedText('test')).rejects.toThrow('Gemini embed error 500');
  });
});
