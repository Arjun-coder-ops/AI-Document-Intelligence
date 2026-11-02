/**
 * Reciprocal Rank Fusion (RRF) Implementation
 *
 * Given ranking lists from distinct retrieval strategies (e.g., dense semantic embeddings
 * and BM25/PostgreSQL full-text lexical search), RRF computes:
 *
 *   RRFScore(d) = sum(1 / (k + rank_m(d)))
 *
 * Ranks are 1-indexed (rank 1 is the top match).
 * k is the smoothing constant (default: 60, empirically proven in information retrieval literature).
 */

export interface RankedItem {
  id: string;
}

export function computeRRFScore(denseRank: number | null, lexicalRank: number | null, k = 60): number {
  let score = 0;
  if (denseRank !== null && denseRank > 0) {
    score += 1 / (k + denseRank);
  }
  if (lexicalRank !== null && lexicalRank > 0) {
    score += 1 / (k + lexicalRank);
  }
  return score;
}

export function calculateRRF(
  denseRanks: Map<string, number>,
  lexicalRanks: Map<string, number>,
  k = 60,
): Map<string, number> {
  const scores = new Map<string, number>();

  for (const [id, rank] of denseRanks.entries()) {
    scores.set(id, (scores.get(id) ?? 0) + 1 / (k + rank));
  }

  for (const [id, rank] of lexicalRanks.entries()) {
    scores.set(id, (scores.get(id) ?? 0) + 1 / (k + rank));
  }

  return scores;
}

export function fuseRRF<T extends RankedItem>(
  denseList: T[],
  lexicalList: T[],
  k = 60,
): Array<T & { rrfScore: number; denseRank: number | null; lexicalRank: number | null }> {
  const itemMap = new Map<string, T>();
  const denseRankMap = new Map<string, number>();
  const lexicalRankMap = new Map<string, number>();

  denseList.forEach((item, index) => {
    itemMap.set(item.id, item);
    denseRankMap.set(item.id, index + 1); // 1-indexed
  });

  lexicalList.forEach((item, index) => {
    if (!itemMap.has(item.id)) {
      itemMap.set(item.id, item);
    }
    lexicalRankMap.set(item.id, index + 1); // 1-indexed
  });

  const fusedResults = Array.from(itemMap.entries()).map(([id, item]) => {
    const denseRank = denseRankMap.get(id) ?? null;
    const lexicalRank = lexicalRankMap.get(id) ?? null;
    const rrfScore = computeRRFScore(denseRank, lexicalRank, k);

    return {
      ...item,
      rrfScore,
      denseRank,
      lexicalRank,
    };
  });

  // Sort descending by RRF score, breaking ties by lowest min rank, then by ID
  return fusedResults.sort((a, b) => {
    if (Math.abs(b.rrfScore - a.rrfScore) > 1e-9) {
      return b.rrfScore - a.rrfScore;
    }
    const minRankA = Math.min(a.denseRank ?? Infinity, a.lexicalRank ?? Infinity);
    const minRankB = Math.min(b.denseRank ?? Infinity, b.lexicalRank ?? Infinity);
    if (minRankA !== minRankB) {
      return minRankA - minRankB;
    }
    return a.id.localeCompare(b.id);
  });
}
