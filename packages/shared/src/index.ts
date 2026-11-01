import { z } from 'zod';

export const UserRoleSchema = z.enum(['admin', 'editor', 'viewer']);
export type UserRole = z.infer<typeof UserRoleSchema>;

export const DocumentStatusSchema = z.enum(['pending', 'processing', 'ready', 'failed']);
export type DocumentStatus = z.infer<typeof DocumentStatusSchema>;

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

export const CitationSchema = z.object({
  chunkId: z.string().uuid(),
  documentId: z.string().uuid(),
  documentTitle: z.string(),
  page: z.number().int().positive().nullable(),
  snippet: z.string(),
  relevanceScore: z.number().min(0).max(1),
});
export type Citation = z.infer<typeof CitationSchema>;

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
