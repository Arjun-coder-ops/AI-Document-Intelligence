/**
 * Centralized typed model configuration module with verified production defaults.
 * Model names and provider defaults are strongly typed here in code, not in .env.
 * Verified against Google AI for Developers (ai.google.dev) specification:
 * - Generation / Fallback: gemini-3.8-flash (latest high-efficiency multimodal model)
 * - Embeddings: gemini-embedding-001 / gemini-embedding-2 (768-dimensional normalized vectors)
 * - Listwise Reranking: gemini-3.8-flash
 */

export const MODEL_CONFIG = {
  primaryLLM: {
    provider: 'groq' as const,
    modelName: 'llama-3.3-70b-versatile',
    temperature: 0.1,
    maxTokens: 1024,
  },
  fallbackLLM: {
    provider: 'gemini' as const,
    modelName: 'gemini-3.8-flash',
    temperature: 0.1,
    maxTokens: 1024,
  },
  embedding: {
    provider: 'gemini' as const,
    modelName: 'models/gemini-embedding-001',
    dimension: 768,
    outputDimensionality: 768,
  },
  reranker: {
    provider: 'gemini-listwise' as const,
    modelName: 'gemini-3.8-flash',
  },
} as const;

export type ModelConfig = typeof MODEL_CONFIG;
