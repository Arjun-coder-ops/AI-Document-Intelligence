import { useState } from "react";
import { FileText, ChevronDown, ChevronUp, Hash, BarChart2 } from "lucide-react";

/**
 * SourceCard — displays a single unique document source, grouping all its chunks.
 */
export default function SourceCard({ docName, chunks, index }) {
  const [expanded, setExpanded] = useState(false);

  if (!chunks || chunks.length === 0) return null;

  // Take the highest relevance score (lowest L2 score is best)
  const bestScore = Math.min(...chunks.map((c) => c.relevance_score));
  const scorePercent = Math.max(0, Math.min(100, Math.round((1 / (1 + bestScore)) * 100)));

  // Extract unique pages
  const uniquePages = [...new Set(chunks.map((c) => c.page))].sort((a, b) => a - b);
  const pagesString = uniquePages.join(", ");

  return (
    <div className="rounded-lg border border-subtle bg-ink-900/60 overflow-hidden text-xs animate-fade-in">
      {/* Header */}
      <div
        className="flex items-center gap-2 px-3 py-2.5 cursor-pointer hover:bg-ink-800/40 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <span className="w-5 h-5 rounded-full bg-accent-500/20 text-accent-400 flex items-center justify-center font-mono text-[10px] font-semibold shrink-0">
          {index}
        </span>
        <FileText size={12} className="text-ink-400 shrink-0" />
        <span className="flex-1 truncate text-ink-300 font-medium" title={docName}>
          {docName}
        </span>
        <span className="text-ink-500 shrink-0 font-medium">
          p.{pagesString} ({chunks.length} chunk{chunks.length !== 1 ? "s" : ""})
        </span>

        {/* Relevance bar */}
        <div className="flex items-center gap-1 shrink-0">
          <div className="w-12 h-1.5 bg-ink-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-accent-500 rounded-full transition-all"
              style={{ width: `${scorePercent}%` }}
            />
          </div>
          <span className="text-ink-500 text-[10px] w-6 text-right">{scorePercent}%</span>
        </div>

        {expanded ? (
          <ChevronUp size={12} className="text-ink-500 shrink-0" />
        ) : (
          <ChevronDown size={12} className="text-ink-500 shrink-0" />
        )}
      </div>

      {/* Expanded content */}
      {expanded && (
        <div className="px-3 pb-3 border-t border-subtle bg-ink-950/20 animate-fade-in space-y-3 pt-2">
          {chunks.map((chunk, idx) => (
            <div key={chunk.id || idx} className="space-y-1">
              <div className="flex items-center gap-3 text-ink-500 font-mono text-[9px] border-b border-subtle/20 pb-0.5">
                <span className="font-semibold text-accent-400">
                  Chunk {idx + 1} of {chunks.length}
                </span>
                <span>Page {chunk.page}</span>
                <span>Score: {chunk.relevance_score.toFixed(4)}</span>
              </div>
              <p className="text-ink-300 leading-relaxed whitespace-pre-wrap font-mono text-[10.5px] bg-ink-800/30 rounded-lg p-2.5 max-h-36 overflow-y-auto">
                {chunk.full_text}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Preview (when collapsed) */}
      {!expanded && (
        <div className="px-3 pb-2 text-[11px] text-ink-500 leading-relaxed border-t border-subtle/10 pt-1.5 bg-ink-950/10">
          <span>{chunks[0]?.preview}</span>
          {chunks.length > 1 && (
            <span className="text-accent-400 font-medium ml-1">
              (+ {chunks.length - 1} more chunks from this document)
            </span>
          )}
        </div>
      )}
    </div>
  );
}
