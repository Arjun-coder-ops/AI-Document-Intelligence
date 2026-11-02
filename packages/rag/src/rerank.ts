import type { Reranker, LLMProvider } from './types.js';
import { GeminiLLMProvider } from './llm.js';

export class NoOpReranker implements Reranker {
  readonly name = 'noop';

  async rerank(
    _query: string,
    documents: Array<{ id: string; content: string }>,
    topK: number,
  ): Promise<Array<{ id: string; score: number }>> {
    await Promise.resolve();
    return documents.slice(0, topK).map((doc, idx) => ({
      id: doc.id,
      score: Number((1 / (1 + idx)).toFixed(4)),
    }));
  }
}

export const STOPWORDS = new Set([
  'what',
  'is',
  'the',
  'in',
  'for',
  'of',
  'to',
  'a',
  'an',
  'and',
  'or',
  'by',
  'on',
  'with',
  'at',
  'how',
  'does',
  'do',
  'are',
  'from',
  'as',
  'that',
  'this',
  'their',
  'when',
  'which',
  'where',
]);

export function extractQueryTokens(query: string): Set<string> {
  return new Set(
    query
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .split(/\s+/)
      .filter((tok) => tok.length > 2 && !STOPWORDS.has(tok)),
  );
}

export function extractDocumentTokens(content: string): string[] {
  return content
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .split(/\s+/)
    .filter(Boolean);
}

export class MockReranker implements Reranker {
  readonly name = 'mock-lexical';

  async rerank(
    query: string,
    documents: Array<{ id: string; content: string }>,
    topK: number,
  ): Promise<Array<{ id: string; score: number }>> {
    await Promise.resolve();
    const queryTokens = extractQueryTokens(query);

    const scored = documents.map((doc) => {
      const docTokens = extractDocumentTokens(doc.content);

      let matchCount = 0;
      for (const tok of docTokens) {
        if (queryTokens.has(tok)) matchCount++;
      }

      // Jaccard-like overlap
      const overlapScore =
        queryTokens.size > 0 ? matchCount / (queryTokens.size + docTokens.length * 0.1) : 0;

      return {
        id: doc.id,
        score: Math.min(1, Number(overlapScore.toFixed(4))),
      };
    });

    scored.sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
    return scored.slice(0, topK);
  }
}

export class GeminiListwiseReranker implements Reranker {
  readonly name = 'gemini-listwise';

  constructor(private readonly provider: LLMProvider = new GeminiLLMProvider()) {}

  async rerank(
    query: string,
    documents: Array<{ id: string; content: string }>,
    topK: number,
  ): Promise<Array<{ id: string; score: number }>> {
    if (documents.length === 0) return [];
    if (documents.length <= 1) {
      return documents.map((d) => ({ id: d.id, score: 1.0 }));
    }

    const docItems = documents
      .map((d, idx) => `[${idx + 1}] ${d.content.slice(0, 300).replace(/\s+/g, ' ')}`)
      .join('\n');

    const prompt = `You are a relevance ranking engine for document retrieval.
Given the query and candidate passages, rank the passage IDs from most relevant to least relevant.
Query: "${query}"

Candidate Passages:
${docItems}

Output strictly a JSON array of integers representing passage IDs in descending order of relevance, e.g. [2, 1, 3]. Do not include any explanations or conversational text.`;

    try {
      const response = await this.provider.generateText(prompt, { temperature: 0.0 });
      const match = response.match(/\[\s*([0-9\s,]+)\s*\]/);
      if (match && match[0]) {
        const parsedIndices = JSON.parse(match[0]) as number[];
        const ranked: Array<{ id: string; score: number }> = [];
        const seen = new Set<string>();

        parsedIndices.forEach((idx, rank) => {
          const doc = documents[idx - 1];
          if (doc && !seen.has(doc.id)) {
            seen.add(doc.id);
            ranked.push({
              id: doc.id,
              score: Number((1 / (1 + rank)).toFixed(4)),
            });
          }
        });

        // Add any omitted docs at the end
        for (const doc of documents) {
          if (!seen.has(doc.id)) {
            ranked.push({ id: doc.id, score: 0.001 });
          }
        }

        return ranked.slice(0, topK);
      }
    } catch {
      // Fallback on LLM parse failure
    }

    return documents.slice(0, topK).map((doc, idx) => ({
      id: doc.id,
      score: Number((1 / (1 + idx)).toFixed(4)),
    }));
  }
}
