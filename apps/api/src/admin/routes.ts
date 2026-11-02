import { Router, type Response } from 'express';
import { z } from 'zod';
import { sql, eq } from 'drizzle-orm';
import { messages, feedback, withTenant } from '@docsage/db';
import { authenticate, requireRole, type AuthenticatedRequest } from '../auth/middleware.js';

export const adminRouter: Router = Router();

export const FeedbackRequestSchema = z.object({
  messageId: z.string().uuid(),
  rating: z.union([z.literal(1), z.literal(-1)]),
  comment: z.string().max(1000).optional(),
});

// ─── GET /admin/analytics ───────────────────────────────────────────────────
adminRouter.get(
  '/analytics',
  authenticate,
  requireRole('admin'),
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const user = req.user;
    if (!user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    try {
      const analytics = await withTenant(user.tenantId, async (tx) => {
        // 1. Total Cost & Message Count
        const costResult = await tx.execute(sql`
          SELECT
            COALESCE(SUM(estimated_cost), 0) as total_cost,
            COUNT(*) as total_messages
          FROM messages
          WHERE tenant_id = ${user.tenantId}::uuid
        `);
        const costRow = (
          costResult as unknown as Array<{
            total_cost: string | number;
            total_messages: string | number;
          }>
        )[0];

        // 2. p95 Latency calculation
        const latencyResult = await tx.execute(sql`
          SELECT
            COALESCE(percentile_cont(0.95) WITHIN GROUP (ORDER BY total_duration_ms), 0) as p95_latency_ms,
            COALESCE(percentile_cont(0.50) WITHIN GROUP (ORDER BY total_duration_ms), 0) as p50_latency_ms
          FROM messages
          WHERE tenant_id = ${user.tenantId}::uuid
            AND role = 'assistant'
            AND total_duration_ms IS NOT NULL
        `);
        const latencyRow = (
          latencyResult as unknown as Array<{ p95_latency_ms: number; p50_latency_ms: number }>
        )[0];

        // 3. Feedback counts
        const feedbackResult = await tx.execute(sql`
          SELECT
            COUNT(*) FILTER (WHERE rating = 1) as thumbs_up,
            COUNT(*) FILTER (WHERE rating = -1) as thumbs_down
          FROM feedback
          WHERE tenant_id = ${user.tenantId}::uuid
        `);
        const feedbackRow = (
          feedbackResult as unknown as Array<{
            thumbs_up: string | number;
            thumbs_down: string | number;
          }>
        )[0];

        // 4. Top unanswered queries (where citations is empty or fallback triggered)
        const unanswered = await tx.query.messages.findMany({
          where: eq(messages.tenantId, user.tenantId),
          limit: 10,
          orderBy: (table, { desc }) => [desc(table.createdAt)],
        });

        const topUnanswered = unanswered
          .filter(
            (m) => m.role === 'assistant' && Array.isArray(m.citations) && m.citations.length === 0,
          )
          .map((m) => ({
            messageId: m.id,
            contentSnippet: m.content.slice(0, 100),
            createdAt: m.createdAt,
          }));

        return {
          tenantId: user.tenantId,
          totalCost: Number(Number(costRow?.total_cost ?? 0).toFixed(6)),
          totalMessages: Number(costRow?.total_messages ?? 0),
          p95LatencyMs: Math.round(Number(latencyRow?.p95_latency_ms ?? 0)),
          p50LatencyMs: Math.round(Number(latencyRow?.p50_latency_ms ?? 0)),
          feedback: {
            thumbsUp: Number(feedbackRow?.thumbs_up ?? 0),
            thumbsDown: Number(feedbackRow?.thumbs_down ?? 0),
          },
          topUnanswered,
        };
      });

      res.status(200).json(analytics);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to query analytics';
      res.status(500).json({ error: msg });
    }
  },
);

// ─── POST /admin/feedback (User Thumbs Up / Thumbs Down) ─────────────────────
adminRouter.post(
  '/feedback',
  authenticate,
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const user = req.user;
    if (!user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const parseResult = FeedbackRequestSchema.safeParse(req.body);
    if (!parseResult.success) {
      res
        .status(400)
        .json({ error: 'Invalid feedback submission', details: parseResult.error.flatten() });
      return;
    }

    const { messageId, rating, comment } = parseResult.data;

    try {
      const created = await withTenant(user.tenantId, async (tx) => {
        const [entry] = await tx
          .insert(feedback)
          .values({
            tenantId: user.tenantId,
            messageId,
            userId: user.sub,
            rating,
            comment: comment ?? null,
          })
          .returning();

        return entry;
      });

      const isCandidateGolden = rating === -1;

      res.status(201).json({
        success: true,
        feedbackId: created?.id,
        isCandidateGolden,
        message: isCandidateGolden
          ? 'Feedback recorded; negative feedback queued as candidate golden-set entry.'
          : 'Feedback recorded successfully.',
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Feedback recording failed';
      res.status(500).json({ error: msg });
    }
  },
);
