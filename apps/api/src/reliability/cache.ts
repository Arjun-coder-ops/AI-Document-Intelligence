import crypto from 'crypto';
import type { Citation } from '@docsage/shared';

export interface CachedQueryResult {
  text: string;
  citations: Citation[];
  totalTokens: number;
  source: 'exact-cache' | 'semantic-cache';
}

interface SemanticCacheEntry {
  query: string;
  queryEmbedding: number[];
  result: { text: string; citations: Citation[]; totalTokens: number };
  createdAt: number;
}

export class MultiTierQueryCache {
  private exactCache = new Map<
    string,
    { text: string; citations: Citation[]; totalTokens: number }
  >();
  private semanticCache = new Map<string, SemanticCacheEntry[]>(); // Keyed by tenant:version
  private corpusVersions = new Map<string, number>(); // tenantId -> corpus_version

  private stats = {
    exactHits: 0,
    semanticHits: 0,
    misses: 0,
  };

  getCorpusVersion(tenantId: string): number {
    return this.corpusVersions.get(tenantId) ?? 1;
  }

  invalidateTenantCorpus(tenantId: string): void {
    const current = this.getCorpusVersion(tenantId);
    this.corpusVersions.set(tenantId, current + 1);
    // Prune stale semantic cache entries for prior versions
    this.semanticCache.delete(`${tenantId}:${current}`);
  }

  private computeExactKey(
    tenantId: string,
    version: number,
    query: string,
    configStr = '',
  ): string {
    const hash = crypto
      .createHash('sha256')
      .update(`${tenantId}:${version}:${query.trim().toLowerCase()}:${configStr}`)
      .digest('hex');
    return `exact:${hash}`;
  }

  private computeCosine(a: number[], b: number[]): number {
    let dot = 0;
    let normA = 0;
    let normB = 0;
    for (let i = 0; i < a.length; i++) {
      const valA = a[i] ?? 0;
      const valB = b[i] ?? 0;
      dot += valA * valB;
      normA += valA * valA;
      normB += valB * valB;
    }
    if (normA === 0 || normB === 0) return 0;
    return dot / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  get(
    tenantId: string,
    query: string,
    queryEmbedding?: number[],
    configStr = '',
  ): CachedQueryResult | null {
    const version = this.getCorpusVersion(tenantId);

    // 1. Check Exact Query Cache
    const exactKey = this.computeExactKey(tenantId, version, query, configStr);
    const exactHit = this.exactCache.get(exactKey);
    if (exactHit) {
      this.stats.exactHits++;
      return {
        ...exactHit,
        source: 'exact-cache',
      };
    }

    // 2. Check Semantic Cache (if query embedding is provided)
    if (queryEmbedding && queryEmbedding.length > 0) {
      const tenantKey = `${tenantId}:${version}`;
      const entries = this.semanticCache.get(tenantKey) ?? [];

      for (const entry of entries) {
        const similarity = this.computeCosine(queryEmbedding, entry.queryEmbedding);
        // Tuned semantic similarity cutoff: 0.98
        if (similarity >= 0.98) {
          this.stats.semanticHits++;
          return {
            ...entry.result,
            source: 'semantic-cache',
          };
        }
      }
    }

    this.stats.misses++;
    return null;
  }

  set(
    tenantId: string,
    query: string,
    result: { text: string; citations: Citation[]; totalTokens: number },
    queryEmbedding?: number[],
    configStr = '',
  ): void {
    const version = this.getCorpusVersion(tenantId);

    // Set Exact Cache
    const exactKey = this.computeExactKey(tenantId, version, query, configStr);
    this.exactCache.set(exactKey, result);

    // Set Semantic Cache
    if (queryEmbedding && queryEmbedding.length > 0) {
      const tenantKey = `${tenantId}:${version}`;
      const entries = this.semanticCache.get(tenantKey) ?? [];
      entries.push({
        query,
        queryEmbedding,
        result,
        createdAt: Date.now(),
      });
      this.semanticCache.set(tenantKey, entries);
    }
  }

  getMetrics(): { exactHits: number; semanticHits: number; misses: number; hitRatio: number } {
    const total = this.stats.exactHits + this.stats.semanticHits + this.stats.misses;
    const hitRatio = total > 0 ? (this.stats.exactHits + this.stats.semanticHits) / total : 0;
    return {
      ...this.stats,
      hitRatio: Number(hitRatio.toFixed(4)),
    };
  }

  reset(): void {
    this.exactCache.clear();
    this.semanticCache.clear();
    this.corpusVersions.clear();
    this.stats = { exactHits: 0, semanticHits: 0, misses: 0 };
  }
}

export const queryCache = new MultiTierQueryCache();
