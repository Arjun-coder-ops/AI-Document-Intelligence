import type { Reranker } from './types.js';

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

export class MockReranker implements Reranker {
  readonly name = 'mock-lexical';

  async rerank(
    query: string,
    documents: Array<{ id: string; content: string }>,
    topK: number,
  ): Promise<Array<{ id: string; score: number }>> {
    await Promise.resolve();
    const stopwords = new Set([
      'what', 'is', 'the', 'in', 'for', 'of', 'to', 'a', 'an', 'and', 'or', 'by', 'on', 'with', 'at',
      'how', 'does', 'do', 'are', 'from', 'as', 'that', 'this', 'their', 'when', 'which', 'where',
    ]);

    const queryTokens = new Set(
      query
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, '')
        .split(/\s+/)
        .filter((tok) => tok.length > 2 && !stopwords.has(tok)),
    );

    const scored = documents.map((doc) => {
      const docTokens = doc.content
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, '')
        .split(/\s+/)
        .filter(Boolean);

      let matchCount = 0;
      for (const tok of docTokens) {
        if (queryTokens.has(tok)) matchCount++;
      }

      // Jaccard-like overlap
      const overlapScore = queryTokens.size > 0 ? matchCount / (queryTokens.size + docTokens.length * 0.1) : 0;

      return {
        id: doc.id,
        score: Math.min(1, Number(overlapScore.toFixed(4))),
      };
    });

    scored.sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
    return scored.slice(0, topK);
  }
}

export class ListwiseLLMReranker implements Reranker {
  readonly name = 'listwise-llm';

  constructor(
    private readonly llmCall: (prompt: string) => Promise<string>,
  ) {}

  async rerank(
    query: string,
    documents: Array<{ id: string; content: string }>,
    topK: number,
  ): Promise<Array<{ id: string; score: number }>> {
    if (documents.length === 0) return [];
    if (documents.length <= topK) {
      return documents.map((d, i) => ({ id: d.id, score: Number((1 / (i + 1)).toFixed(4)) }));
    }

    const docItems = documents
      .map((d, idx) => `[${idx + 1}] ${d.content.slice(0, 200).replace(/\s+/g, ' ')}`)
      .join('\n');

    const prompt = `You are a relevance ranking engine.
Given the search query and the list of candidate passages, order the passage IDs from most relevant to least relevant to answering the query.
Query: "${query}"

Passages:
${docItems}

Output strictly a JSON array of passage numbers in descending order of relevance, e.g. [3, 1, 5, 2, 4]. Do not include explanations.`;

    try {
      const response = await this.llmCall(prompt);
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

export class CohereReranker implements Reranker {
  readonly name = 'cohere';

  constructor(
    private readonly apiKey = process.env['COHERE_API_KEY'] ?? '',
    private readonly model = 'rerank-v3.5',
  ) {}

  async rerank(
    query: string,
    documents: Array<{ id: string; content: string }>,
    topK: number,
  ): Promise<Array<{ id: string; score: number }>> {
    if (!this.apiKey) {
      throw new Error('COHERE_API_KEY environment variable is not configured');
    }

    const res = await fetch('https://api.cohere.com/v1/rerank', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        query,
        documents: documents.map((d) => d.content),
        top_n: topK,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Cohere rerank failed with status ${res.status}: ${errText}`);
    }

    interface CohereResponse {
      results: Array<{ index: number; relevance_score: number }>;
    }

    const data = (await res.json()) as CohereResponse;
    return data.results.map((r) => {
      const doc = documents[r.index];
      return {
        id: doc ? doc.id : `doc-${r.index}`,
        score: Number(r.relevance_score.toFixed(4)),
      };
    });
  }
}
