import { z } from 'zod';

export const UserRoleSchema = z.enum(['admin', 'editor', 'viewer'] as const);
export type UserRole = 'admin' | 'editor' | 'viewer';

export const DocumentStatusSchema = z.enum(['pending', 'processing', 'ready', 'failed'] as const);
export type DocumentStatus = 'pending' | 'processing' | 'ready' | 'failed';

export const HealthCheckResponseSchema = z.object({
  status: z.literal('healthy'),
  version: z.string(),
  timestamp: z.string().datetime(),
  database: z.enum(['connected', 'disconnected', 'unverified']),
  redis: z.enum(['connected', 'disconnected', 'unverified']),
});
export type HealthCheckResponse = z.infer<typeof HealthCheckResponseSchema>;

export const ChatMessageSchema = z.object({
  role: z.enum(['user', 'assistant', 'system']),
  content: z.string().min(1),
});
export type ChatMessage = z.infer<typeof ChatMessageSchema>;

export const ChatRequestSchema = z.object({
  conversationId: z.string().uuid().optional(),
  message: z.string().min(1).max(4000),
  historyLimit: z.number().int().min(0).max(20).optional(),
});
export type ChatRequest = z.infer<typeof ChatRequestSchema>;

export const SSEEventMetaSchema = z.object({
  requestId: z.string().uuid(),
  conversationId: z.string().uuid(),
  model: z.string(),
});
export type SSEEventMeta = z.infer<typeof SSEEventMetaSchema>;

export const SSEEventTokenSchema = z.object({
  token: z.string(),
});
export type SSEEventToken = z.infer<typeof SSEEventTokenSchema>;

export const CitationSchema = z.object({
  chunkId: z.string().uuid(),
  documentId: z.string().uuid(),
  documentTitle: z.string(),
  page: z.number().int().positive().nullable(),
  snippet: z.string(),
  relevanceScore: z.number().min(0).max(1),
});
export type Citation = z.infer<typeof CitationSchema>;

export const SSEEventCitationsSchema = z.object({
  citations: z.array(CitationSchema),
});
export type SSEEventCitations = z.infer<typeof SSEEventCitationsSchema>;

export const SSEEventErrorSchema = z.object({
  code: z.string(),
  message: z.string(),
});
export type SSEEventError = z.infer<typeof SSEEventErrorSchema>;

export const SSEEventDoneSchema = z.object({
  aborted: z.boolean(),
  error: z.boolean(),
  totalTokens: z.number().optional(),
  estimatedCost: z.number().optional(),
  latencyMs: z.number().optional(),
  ttftMs: z.number().optional(),
});
export type SSEEventDone = z.infer<typeof SSEEventDoneSchema>;

// ─── Auth Schemas ─────────────────────────────────────────────────────────────
export const RegisterRequestSchema = z.object({
  tenantName: z.string().min(2).max(100),
  email: z.string().email(),
  password: z.string().min(8).max(100),
});
export type RegisterRequest = z.infer<typeof RegisterRequestSchema>;

export const LoginRequestSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});
export type LoginRequest = z.infer<typeof LoginRequestSchema>;

export const UserSummarySchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  email: z.string().email(),
  role: UserRoleSchema,
});
export type UserSummary = z.infer<typeof UserSummarySchema>;

export const AuthResponseSchema = z.object({
  accessToken: z.string(),
  user: UserSummarySchema,
});
export type AuthResponse = z.infer<typeof AuthResponseSchema>;

export const JwtPayloadSchema = z.object({
  sub: z.string().uuid(),
  tenantId: z.string().uuid(),
  email: z.string().email(),
  role: UserRoleSchema,
  iat: z.number().optional(),
  exp: z.number().optional(),
});
export type JwtPayload = z.infer<typeof JwtPayloadSchema>;

// ─── Minimal Environment Specification (8 Variables) ─────────────────────────
export const MinimalEnvSchema = z.object({
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  DATABASE_URL_DIRECT: z.string().min(1).optional(),
  JWT_ACCESS_SECRET: z.string().min(32, 'JWT_ACCESS_SECRET must be at least 32 characters'),
  JWT_REFRESH_SECRET: z.string().min(32, 'JWT_REFRESH_SECRET must be at least 32 characters'),
  GROQ_API_KEY: z.string().min(1, 'GROQ_API_KEY is required'),
  GEMINI_API_KEY: z.string().min(1, 'GEMINI_API_KEY is required'),
  REDIS_URL: z.string().min(1, 'REDIS_URL is required'),
  EMBEDDING_DIM: z.coerce.number().int().default(768),
});
export type MinimalEnv = z.infer<typeof MinimalEnvSchema>;
