import { z } from 'zod';
import dotenv from 'dotenv';
import { MinimalEnvSchema } from '@docsage/shared';

dotenv.config();

export const EnvSchema = MinimalEnvSchema.extend({
  PORT: z.coerce.number().default(8000),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  CORS_ORIGIN: z.string().default('http://localhost:5173'),
  MAX_UPLOAD_SIZE_MB: z.coerce.number().default(50),
  UPLOAD_DIR: z.string().default('./uploads'),
  LLM_PROVIDER: z.enum(['mock', 'groq', 'gemini']).default('mock'),
  // Backward compatibility alias for legacy test fixtures
  JWT_SECRET: z.string().optional(),
});

export type Env = z.infer<typeof EnvSchema>;

export function validateEnv(): Env {
  // Map legacy JWT_SECRET if JWT_ACCESS_SECRET was omitted in legacy configurations
  if (!process.env['JWT_ACCESS_SECRET'] && process.env['JWT_SECRET']) {
    process.env['JWT_ACCESS_SECRET'] = process.env['JWT_SECRET'];
  }
  if (!process.env['JWT_REFRESH_SECRET'] && process.env['REFRESH_SECRET']) {
    process.env['JWT_REFRESH_SECRET'] = process.env['REFRESH_SECRET'];
  }

  // Provide deterministic defaults for offline test suites
  if (process.env['NODE_ENV'] === 'test') {
    process.env['DATABASE_URL'] =
      process.env['DATABASE_URL'] ?? 'postgresql://postgres:postgres@localhost:5432/docsage_test';
    process.env['JWT_ACCESS_SECRET'] =
      process.env['JWT_ACCESS_SECRET'] ?? 'docsage-test-access-token-secret-at-least-32-chars';
    process.env['JWT_REFRESH_SECRET'] =
      process.env['JWT_REFRESH_SECRET'] ?? 'docsage-test-refresh-token-secret-at-least-32-chars';
    process.env['GROQ_API_KEY'] = process.env['GROQ_API_KEY'] ?? 'gsk_test_mock_key';
    process.env['GEMINI_API_KEY'] = process.env['GEMINI_API_KEY'] ?? 'test_mock_gemini_key';
    process.env['REDIS_URL'] = process.env['REDIS_URL'] ?? 'redis://localhost:6379';
    process.env['EMBEDDING_DIM'] = process.env['EMBEDDING_DIM'] ?? '768';
  }

  const result = EnvSchema.safeParse(process.env);
  if (!result.success) {
    console.error('Invalid DocSage Environment Configuration (Fail-Fast Validation):');
    console.error(JSON.stringify(result.error.format(), null, 2));
    throw new Error('DocSage startup aborted due to invalid environment variables');
  }
  return result.data;
}

export const env = validateEnv();
