import { useState } from "react";
import { FileText, ChevronDown, ChevronUp, Hash, BarChart2 } from "lucide-react";

/**
 * SourceCard — displays a single retrieved document chunk with metadata.
 */
export default function SourceCard({ source, index }) {
  const [expanded, setExpanded] = useState(false);

  // Map relevance score to a visual bar (FAISS returns L2 distance; lower = better)
  // We invert and normalize to 0–100 for display
  const scorePercent = Math.max(0, Math.min(100, Math.round((1 / (1 + source.relevance_score)) * 100)));

  return (
    <div className="rounded-lg border border-subtle bg-ink-900/60 overflow-hidden text-xs animate-fade-in">
      {/* Header */}
      <div
        className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-ink-800/40 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <span className="w-5 h-5 rounded-full bg-accent-500/20 text-accent-400 flex items-center justify-center font-mono text-[10px] font-semibold shrink-0">
          {index}
        </span>
        <FileText size={12} className="text-ink-400 shrink-0" />
        <span className="flex-1 truncate text-ink-300 font-medium">{source.source}</span>
        <span className="text-ink-500 shrink-0">p.{source.page}</span>

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

        {expanded
          ? <ChevronUp size={12} className="text-ink-500 shrink-0" />
          : <ChevronDown size={12} className="text-ink-500 shrink-0" />
        }
      </div>

      {/* Expanded content */}
      {expanded && (
        <div className="px-3 pb-3 border-t border-subtle animate-fade-in">
          <div className="flex items-center gap-3 py-2 mb-1">
            <span className="text-ink-500 flex items-center gap-1">
              <Hash size={10} /> chunk {source.chunk_id}
            </span>
            <span className="text-ink-500 flex items-center gap-1">
              <BarChart2 size={10} /> score {source.relevance_score.toFixed(4)}
            </span>
          </div>
          <p className="text-ink-300 leading-relaxed whitespace-pre-wrap font-mono text-[11px] bg-ink-800/40 rounded-lg p-2.5 max-h-48 overflow-y-auto">
            {source.full_text}
          </p>
        </div>
      )}

      {/* Preview (when collapsed) */}
      {!expanded && (
        <div className="px-3 pb-2">
          <p className="text-ink-500 leading-snug line-clamp-2 text-[11px]">
            {source.preview}
          </p>
        </div>
      )}
    </div>
  );
}
