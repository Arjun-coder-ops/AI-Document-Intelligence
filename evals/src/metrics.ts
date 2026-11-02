import type { MetricConfidenceInterval } from './types.js';

function getTopKHits(
  goldChunkIds: string[],
  retrievedChunkIds: string[],
  k: number,
): { hits: number; total: number } {
  if (goldChunkIds.length === 0) return { hits: 0, total: 0 };
  const topK = retrievedChunkIds.slice(0, k);
  const goldSet = new Set(goldChunkIds);
  let hits = 0;
  for (const id of topK) {
    if (goldSet.has(id)) hits++;
  }
  return { hits, total: goldChunkIds.length };
}

export function calculateRecallAtK(
  goldChunkIds: string[],
  retrievedChunkIds: string[],
  k: number,
): number {
  const { hits, total } = getTopKHits(goldChunkIds, retrievedChunkIds, k);
  return total === 0 ? 1.0 : hits / total;
}

export function calculateMRR(goldChunkIds: string[], retrievedChunkIds: string[]): number {
  if (goldChunkIds.length === 0) return 1.0;
  const goldSet = new Set(goldChunkIds);
  for (let i = 0; i < retrievedChunkIds.length; i++) {
    const id = retrievedChunkIds[i];
    if (id && goldSet.has(id)) {
      return 1 / (i + 1);
    }
  }
  return 0.0;
}

export function calculateNDCGAtK(
  goldChunkIds: string[],
  retrievedChunkIds: string[],
  k: number,
): number {
  if (goldChunkIds.length === 0) return 1.0;
  const goldSet = new Set(goldChunkIds);
  const topK = retrievedChunkIds.slice(0, k);

  let dcg = 0;
  for (let i = 0; i < topK.length; i++) {
    const id = topK[i];
    if (id && goldSet.has(id)) {
      dcg += 1 / Math.log2(i + 2); // i + 2 because i is 0-indexed, so rank is i + 1
    }
  }

  const idealCount = Math.min(k, goldChunkIds.length);
  let idcg = 0;
  for (let i = 0; i < idealCount; i++) {
    idcg += 1 / Math.log2(i + 2);
  }

  return idcg > 0 ? dcg / idcg : 0.0;
}

export function calculateHitRate(
  goldChunkIds: string[],
  retrievedChunkIds: string[],
  k: number,
): number {
  const { hits, total } = getTopKHits(goldChunkIds, retrievedChunkIds, k);
  return total === 0 ? 1.0 : hits > 0 ? 1.0 : 0.0;
}

/**
 * Bootstrap 95% Confidence Interval Resampling (B = 1000)
 */
export function bootstrapConfidenceInterval(
  values: number[],
  iterations = 1000,
  confidenceLevel = 0.95,
): MetricConfidenceInterval {
  if (values.length === 0) {
    return { mean: 0, ciLower: 0, ciUpper: 0 };
  }

  const n = values.length;
  const sampleMean = values.reduce((sum, v) => sum + v, 0) / n;
  if (n === 1) {
    return { mean: sampleMean, ciLower: sampleMean, ciUpper: sampleMean };
  }

  const bootstrapMeans: number[] = [];

  // Deterministic PRNG for reproducible bootstrap CI in CI runs
  let seed = 42;
  const pseudoRandom = () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };

  for (let b = 0; b < iterations; b++) {
    let sum = 0;
    for (let i = 0; i < n; i++) {
      const idx = Math.floor(pseudoRandom() * n);
      sum += values[idx] ?? 0;
    }
    bootstrapMeans.push(sum / n);
  }

  bootstrapMeans.sort((a, b) => a - b);

  const alpha = 1 - confidenceLevel;
  const lowerIdx = Math.floor((alpha / 2) * iterations);
  const upperIdx = Math.floor((1 - alpha / 2) * iterations);

  const ciLower = bootstrapMeans[lowerIdx] ?? sampleMean;
  const ciUpper = bootstrapMeans[upperIdx] ?? sampleMean;

  return {
    mean: Number(sampleMean.toFixed(4)),
    ciLower: Number(ciLower.toFixed(4)),
    ciUpper: Number(ciUpper.toFixed(4)),
  };
}
