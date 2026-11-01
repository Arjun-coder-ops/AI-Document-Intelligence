import {
  pgTable,
  uuid,
  text,
  timestamp,
  pgEnum,
  integer,
  bigint,
  numeric,
  jsonb,
  uniqueIndex,
  index,
  primaryKey,
  customType,
} from 'drizzle-orm/pg-core';
import { sql, relations } from 'drizzle-orm';
import type { Citation } from '@docsage/shared';

// ─── Enums ───────────────────────────────────────────────────────────────────
export const userRoleEnum = pgEnum('user_role', ['admin', 'editor', 'viewer']);
export const documentStatusEnum = pgEnum('document_status', [
  'pending',
  'processing',
  'ready',
  'failed',
]);
export const messageRoleEnum = pgEnum('message_role', ['user', 'assistant', 'system']);
export const evalRunStatusEnum = pgEnum('eval_run_status', ['running', 'completed', 'failed']);

// ─── Custom Types (pgvector and tsvector) ────────────────────────────────────
const embeddingDim = Number(process.env['EMBEDDING_DIM'] ?? 384);

export function serializeVector(value: number[]): string {
  return `[${value.join(',')}]`;
}

export function deserializeVector(value: string): number[] {
  const clean = value.replace(/^\[|\]$/g, '').trim();
  return clean.length === 0 ? [] : clean.split(',').map((n) => Number(n.trim()));
}

export const vector = customType<{ data: number[]; driverData: string }>({
  dataType() {
    return `vector(${embeddingDim})`;
  },
  toDriver: serializeVector,
  fromDriver: deserializeVector,
});

export const tsvector = customType<{ data: string; driverData: string }>({
  dataType() {
    return 'tsvector';
  },
});

// ─── 1. Tenants ──────────────────────────────────────────────────────────────
export const tenants = pgTable('tenants', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// ─── 2. Users ────────────────────────────────────────────────────────────────
export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .references(() => tenants.id, { onDelete: 'cascade' })
      .notNull(),
    email: text('email').notNull().unique(),
    passwordHash: text('password_hash').notNull(),
    role: userRoleEnum('role').default('viewer').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index('idx_users_tenant_id').on(table.tenantId)],
);

// ─── 3. Documents ────────────────────────────────────────────────────────────
export const documents = pgTable(
  'documents',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .references(() => tenants.id, { onDelete: 'cascade' })
      .notNull(),
    ownerId: uuid('owner_id').references(() => users.id, { onDelete: 'set null' }),
    title: text('title').notNull(),
    filename: text('filename').notNull(),
    mime: text('mime').notNull(),
    sizeBytes: bigint('size_bytes', { mode: 'number' }).notNull(),
    contentSha256: text('content_sha256').notNull(),
    status: documentStatusEnum('status').default('pending').notNull(),
    error: text('error'),
    version: integer('version').default(1).notNull(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('idx_docs_tenant_content_sha_active')
      .on(table.tenantId, table.contentSha256)
      .where(sql`${table.deletedAt} IS NULL`),
    index('idx_docs_tenant_created').on(table.tenantId, table.createdAt),
  ],
);

// ─── 4. Document Chunks ──────────────────────────────────────────────────────
export const chunks = pgTable(
  'chunks',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .references(() => tenants.id, { onDelete: 'cascade' })
      .notNull(),
    documentId: uuid('document_id')
      .references(() => documents.id, { onDelete: 'cascade' })
      .notNull(),
    ordinal: integer('ordinal').notNull(),
    content: text('content').notNull(),
    contentSha256: text('content_sha256').notNull(),
    page: integer('page'),
    section: text('section'),
    tokenCount: integer('token_count').notNull(),
    embedding: vector('embedding'),
    tsv: tsvector('tsv').generatedAlwaysAs(sql`to_tsvector('english', ${sql.raw('"content"')})`),
  },
  (table) => [
    index('idx_chunks_tenant_doc').on(table.tenantId, table.documentId),
    index('idx_chunks_embedding_hnsw')
      .using('hnsw', sql`${table.embedding} vector_cosine_ops`)
      .with({ m: 16, ef_construction: 64 }),
    index('idx_chunks_tsv_gin').using('gin', table.tsv),
  ],
);

// ─── 5. Conversations ────────────────────────────────────────────────────────
export const conversations = pgTable(
  'conversations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .references(() => tenants.id, { onDelete: 'cascade' })
      .notNull(),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
    title: text('title'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index('idx_conversations_tenant_user').on(table.tenantId, table.userId)],
);

// ─── 6. Messages ─────────────────────────────────────────────────────────────
export const messages = pgTable(
  'messages',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .references(() => tenants.id, { onDelete: 'cascade' })
      .notNull(),
    conversationId: uuid('conversation_id')
      .references(() => conversations.id, { onDelete: 'cascade' })
      .notNull(),
    role: messageRoleEnum('role').notNull(),
    content: text('content').notNull(),
    citations: jsonb('citations').$type<Citation[]>(),
    ttftMs: integer('ttft_ms'),
    totalDurationMs: integer('total_duration_ms'),
    promptTokens: integer('prompt_tokens'),
    completionTokens: integer('completion_tokens'),
    estimatedCost: numeric('estimated_cost', { precision: 10, scale: 6 }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('idx_messages_conversation').on(table.conversationId),
    index('idx_messages_tenant_created').on(table.tenantId, table.createdAt),
  ],
);

// ─── 7. Embedding Cache ──────────────────────────────────────────────────────
export const embeddingCache = pgTable(
  'embedding_cache',
  {
    contentSha256: text('content_sha256').notNull(),
    model: text('model').notNull(),
    embedding: vector('embedding').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [primaryKey({ columns: [table.contentSha256, table.model] })],
);

// ─── 8. Audit Log ────────────────────────────────────────────────────────────
export const auditLog = pgTable(
  'audit_log',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .references(() => tenants.id, { onDelete: 'cascade' })
      .notNull(),
    actorId: uuid('actor_id').references(() => users.id, { onDelete: 'set null' }),
    action: text('action').notNull(),
    entity: text('entity').notNull(),
    entityId: text('entity_id'),
    meta: jsonb('meta'),
    at: timestamp('at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index('idx_audit_tenant_at').on(table.tenantId, table.at)],
);

// ─── 9. Eval Runs ────────────────────────────────────────────────────────────
export const evalRuns = pgTable('eval_runs', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  config: jsonb('config').notNull(),
  metrics: jsonb('metrics').notNull(),
  status: evalRunStatusEnum('status').default('running').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// ─── 10. Eval Results ────────────────────────────────────────────────────────
export const evalResults = pgTable(
  'eval_results',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    runId: uuid('run_id')
      .references(() => evalRuns.id, { onDelete: 'cascade' })
      .notNull(),
    questionId: text('question_id').notNull(),
    question: text('question').notNull(),
    metrics: jsonb('metrics').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index('idx_eval_results_run_id').on(table.runId)],
);

// ─── 11. Feedback ────────────────────────────────────────────────────────────
export const feedback = pgTable(
  'feedback',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .references(() => tenants.id, { onDelete: 'cascade' })
      .notNull(),
    messageId: uuid('message_id')
      .references(() => messages.id, { onDelete: 'cascade' })
      .notNull(),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
    rating: integer('rating').notNull(), // 1 (thumbs up) or -1 (thumbs down)
    comment: text('comment'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index('idx_feedback_message_id').on(table.messageId)],
);

// ─── 12. Refresh Tokens ──────────────────────────────────────────────────────
export const refreshTokens = pgTable(
  'refresh_tokens',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    tokenHash: text('token_hash').notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('idx_refresh_tokens_user').on(table.userId),
    index('idx_refresh_tokens_hash').on(table.tokenHash),
  ],
);

// ─── Relations ───────────────────────────────────────────────────────────────
export const tenantsRelations = relations(tenants, ({ many }) => ({
  users: many(users),
  documents: many(documents),
  conversations: many(conversations),
  auditLogs: many(auditLog),
}));

export const documentsRelations = relations(documents, ({ one, many }) => ({
  tenant: one(tenants, { fields: [documents.tenantId], references: [tenants.id] }),
  owner: one(users, { fields: [documents.ownerId], references: [users.id] }),
  chunks: many(chunks),
}));

export const chunksRelations = relations(chunks, ({ one }) => ({
  document: one(documents, { fields: [chunks.documentId], references: [documents.id] }),
  tenant: one(tenants, { fields: [chunks.tenantId], references: [tenants.id] }),
}));
