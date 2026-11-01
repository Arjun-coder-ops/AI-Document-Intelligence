import { describe, it, expect } from 'vitest';
import { calculateRRF } from './index.js';

describe('RAG Core Utilities', () => {
  it('correctly calculates Reciprocal Rank Fusion (RRF) scores', () => {
    const denseRanks = new Map<string, number>([
      ['chunk-1', 1],
      ['chunk-2', 2],
    ]);
    const lexicalRanks = new Map<string, number>([
      ['chunk-2', 1],
      ['chunk-3', 2],
    ]);

    const rrfScores = calculateRRF(denseRanks, lexicalRanks, 60);

    // chunk-1: 1/(60+1) = 1/61 ~= 0.016393
    // chunk-2: 1/(60+2) + 1/(60+1) = 1/62 + 1/61 ~= 0.016129 + 0.016393 = 0.032522
    // chunk-3: 1/(60+2) = 1/62 ~= 0.016129
    const scoreChunk1 = rrfScores.get('chunk-1');
    const scoreChunk2 = rrfScores.get('chunk-2');
    const scoreChunk3 = rrfScores.get('chunk-3');

    expect(scoreChunk1).toBeCloseTo(1 / 61, 5);
    expect(scoreChunk2).toBeCloseTo(1 / 62 + 1 / 61, 5);
    expect(scoreChunk3).toBeCloseTo(1 / 62, 5);

    // chunk-2 appears in both lists, so it must rank highest
    expect(scoreChunk2).toBeGreaterThan(scoreChunk1 ?? 0);
    expect(scoreChunk2).toBeGreaterThan(scoreChunk3 ?? 0);
  });
});
