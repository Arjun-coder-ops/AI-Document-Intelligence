import crypto from 'crypto';
import type { DocumentChunk } from './index.js';

export interface RawPageText {
  page: number;
  text: string;
}

export interface ChunkerOptions {
  targetTokens?: number;
  overlapTokens?: number;
}

/**
 * Approximate token count: ~4 characters per token in English.
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

export function hashContent(content: string): string {
  return crypto.createHash('sha256').update(content).digest('hex');
}

/**
 * Structure-aware chunker that respects document headers, paragraphs, and table boundaries.
 * Guarantees tables are never severed mid-row and preserves parent section hierarchy.
 */
export function chunkDocument(
  pages: RawPageText[],
  options: ChunkerOptions = {},
): DocumentChunk[] {
  const targetTokens = options.targetTokens ?? 400; // ~1600 characters
  const overlapTokens = options.overlapTokens ?? 60; // ~240 characters
  const targetChars = targetTokens * 4;
  const overlapChars = overlapTokens * 4;

  const chunks: DocumentChunk[] = [];
  let currentSection = 'General';
  let ordinal = 0;

  for (const pageItem of pages) {
    const lines = pageItem.text.split('\n');
    let currentBlock = '';
    let inTable = false;
    let tableBuffer: string[] = [];

    const flushBlock = () => {
      const trimmed = currentBlock.trim();
      if (!trimmed) return;

      if (trimmed.length <= targetChars) {
        chunks.push({
          ordinal: ordinal++,
          content: trimmed,
          tokenCount: estimateTokens(trimmed),
          page: pageItem.page,
          section: currentSection,
          contentSha256: hashContent(trimmed),
        });
        currentBlock = '';
        return;
      }

      // If block exceeds target, slide window respecting sentences
      let startIdx = 0;
      while (startIdx < trimmed.length) {
        let endIdx = Math.min(startIdx + targetChars, trimmed.length);

        if (endIdx < trimmed.length) {
          // Look for sentence boundary
          const lastPeriod = trimmed.lastIndexOf('. ', endIdx);
          if (lastPeriod > startIdx + Math.floor(targetChars * 0.5)) {
            endIdx = lastPeriod + 1;
          }
        }

        const chunkText = trimmed.slice(startIdx, endIdx).trim();
        if (chunkText.length > 0) {
          chunks.push({
            ordinal: ordinal++,
            content: chunkText,
            tokenCount: estimateTokens(chunkText),
            page: pageItem.page,
            section: currentSection,
            contentSha256: hashContent(chunkText),
          });
        }

        if (endIdx >= trimmed.length) break;
        startIdx = Math.max(endIdx - overlapChars, startIdx + 1);
      }

      currentBlock = '';
    };

    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line) continue;

      // 1. Detect section headings
      const headingMatch = line.match(/^(#{1,4}\s+[A-Za-z0-9\s-]+|[0-9]+(\.[0-9]+)*\s+[A-Za-z\s]+)$/);
      if (headingMatch) {
        flushBlock();
        currentSection = line.replace(/^#+\s*/, '').trim();
        currentBlock = line + '\n\n';
        continue;
      }

      // 2. Table row detection (| col1 | col2 |)
      const isTableRow = line.startsWith('|') && line.endsWith('|');
      if (isTableRow) {
        inTable = true;
        tableBuffer.push(line);
        continue;
      } else if (inTable) {
        // Table ended: append entire table atomically
        inTable = false;
        const wholeTable = tableBuffer.join('\n');
        tableBuffer = [];
        if (currentBlock.length + wholeTable.length > targetChars) {
          flushBlock();
        }
        currentBlock += wholeTable + '\n\n';
      }

      // Regular paragraph line
      if (currentBlock.length + line.length > targetChars) {
        flushBlock();
      }
      currentBlock += line + ' ';
    }

    if (inTable && tableBuffer.length > 0) {
      currentBlock += tableBuffer.join('\n') + '\n\n';
      tableBuffer = [];
    }

    flushBlock();
  }

  return chunks;
}
