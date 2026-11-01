import type { Citation } from '@docsage/shared';
import type { PromptContextChunk, VerifiedCitationResult } from './types.js';

export function verifyAndExtractCitations(
  llmResponse: string,
  contextChunks: PromptContextChunk[],
): VerifiedCitationResult {
  const chunkByIndex = new Map<number, PromptContextChunk>();
  for (const c of contextChunks) {
    chunkByIndex.set(c.citationIndex, c);
  }

  // Regex to match [n] where n is 1 or more digits
  const citationRegex = /\[(\d+)\]/g;
  const verifiedMap = new Map<number, Citation>();
  const hallucinatedIndices = new Set<number>();

  let match: RegExpExecArray | null;
  while ((match = citationRegex.exec(llmResponse)) !== null) {
    const rawNumber = match[1];
    if (!rawNumber) continue;
    const index = parseInt(rawNumber, 10);
    const chunk = chunkByIndex.get(index);

    if (chunk) {
      if (!verifiedMap.has(index)) {
        // Compute clean snippet (first 250 characters of chunk)
        const snippet = chunk.content.slice(0, 250).trim().replace(/\s+/g, ' ');
        verifiedMap.set(index, {
          chunkId: chunk.chunkId,
          documentId: chunk.documentId,
          documentTitle: chunk.documentTitle,
          page: chunk.page,
          snippet,
          relevanceScore: Number((1 / (1 + (index - 1) * 0.1)).toFixed(4)),
        });
      }
    } else {
      hallucinatedIndices.add(index);
    }
  }

  // Remove hallucinated citations [n] from the text to avoid presenting false sources to the user
  let cleanedText = llmResponse;
  for (const badIndex of hallucinatedIndices) {
    const badRegex = new RegExp(`\\[${badIndex}\\]`, 'g');
    cleanedText = cleanedText.replace(badRegex, '');
  }
  cleanedText = cleanedText.replace(/\s{2,}/g, ' ').trim();

  return {
    verifiedCitations: Array.from(verifiedMap.values()),
    hallucinatedIndices: Array.from(hallucinatedIndices),
    cleanedText,
  };
}
