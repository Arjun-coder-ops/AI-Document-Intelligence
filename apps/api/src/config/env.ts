import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

export const EnvSchema = z.object({
  PORT: z.coerce.number().default(8000),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  DATABASE_URL: z.string().default('postgresql://postgres:postgres@localhost:5432/docsage'),
  DATABASE_URL_DIRECT: z.string().optional(),
  JWT_SECRET: z.string().default('docsage-super-secret-development-jwt-key-32chars-minimum'),
  JWT_ACCESS_EXPIRY: z.string().default('15m'),
  JWT_REFRESH_EXPIRY_DAYS: z.coerce.number().default(7),
  CORS_ORIGIN: z.string().default('http://localhost:5173'),
  EMBEDDING_DIM: z.coerce.number().default(384),
  MAX_UPLOAD_SIZE_MB: z.coerce.number().default(50),
  UPLOAD_DIR: z.string().default('./uploads'),
  LLM_PROVIDER: z.enum(['mock', 'groq', 'gemini', 'openai']).default('mock'),
  GROQ_API_KEY: z.string().optional(),
  OPENAI_API_KEY: z.string().optional(),
  GEMINI_API_KEY: z.string().optional(),
});

export type Env = z.infer<typeof EnvSchema>;

export function validateEnv(): Env {
  const result = EnvSchema.safeParse(process.env);
  if (!result.success) {
    console.error('Invalid DocSage Environment Configuration:');
    console.error(JSON.stringify(result.error.format(), null, 2));
    throw new Error('DocSage startup aborted due to invalid environment variables');
  }
  return result.data;
}

export const env = validateEnv();
