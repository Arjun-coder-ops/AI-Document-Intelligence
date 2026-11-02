import { eq, and, desc } from 'drizzle-orm';
import { conversations, messages, withTenant } from '@docsage/db';
import type { Citation } from '@docsage/shared';
import { estimateTokens } from '@docsage/rag';

export async function resolveOrCreateConversation(
  tenantId: string,
  userId: string,
  message: string,
  existingConvId?: string,
): Promise<string> {
  if (existingConvId) return existingConvId;

  let resolvedId: string | undefined;
  await withTenant(tenantId, async (tx) => {
    const [newConv] = await tx
      .insert(conversations)
      .values({
        tenantId,
        userId,
        title: message.slice(0, 40) + '...',
      })
      .returning();
    resolvedId = newConv?.id;
  });

  if (!resolvedId) throw new Error('Failed to resolve conversation context');
  return resolvedId;
}

export async function recordUserMessage(
  tenantId: string,
  conversationId: string,
  message: string,
): Promise<void> {
  await withTenant(tenantId, async (tx) => {
    await tx.insert(messages).values({
      tenantId,
      conversationId,
      role: 'user',
      content: message,
      promptTokens: estimateTokens(message),
    });
  });
}

export async function loadConversationHistory(
  tenantId: string,
  conversationId: string,
  limit: number,
) {
  const rows = await withTenant(tenantId, async (tx) => {
    return tx
      .select()
      .from(messages)
      .where(and(eq(messages.tenantId, tenantId), eq(messages.conversationId, conversationId)))
      .orderBy(desc(messages.createdAt))
      .limit(limit);
  });
  return rows.reverse();
}

export async function recordAssistantMessage(params: {
  tenantId: string;
  conversationId: string;
  content: string;
  citations: Citation[];
  totalDurationMs: number;
  ttftMs: number;
  promptTokens: number;
  completionTokens: number;
  estimatedCost: string;
}): Promise<void> {
  await withTenant(params.tenantId, async (tx) => {
    await tx.insert(messages).values({
      tenantId: params.tenantId,
      conversationId: params.conversationId,
      role: 'assistant',
      content: params.content,
      citations: params.citations,
      ttftMs: params.ttftMs,
      totalDurationMs: params.totalDurationMs,
      promptTokens: params.promptTokens,
      completionTokens: params.completionTokens,
      estimatedCost: params.estimatedCost,
    });
  });
}
