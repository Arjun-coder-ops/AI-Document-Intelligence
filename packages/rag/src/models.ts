/**
 * Centralized typed model configuration module with sensible production defaults.
 * Model names and provider defaults live here in code, not in .env.
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
    modelName: 'gemini-1.5-flash',
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
    modelName: 'gemini-1.5-flash',
  },
} as const;

export type ModelConfig = typeof MODEL_CONFIG;
