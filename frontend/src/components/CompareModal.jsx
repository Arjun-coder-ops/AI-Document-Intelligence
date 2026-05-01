import { useState } from "react";
import { X, Zap, Brain, Loader2, ArrowRight } from "lucide-react";
import { compareAnswers } from "../utils/api";

/**
 * CompareModal — side-by-side comparison of RAG vs baseline answers.
 */
export default function CompareModal({ onClose, hasDocuments }) {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const handleCompare = async () => {
    if (!query.trim()) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const data = await compareAnswers(query.trim());
      setResult(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-ink-900/80 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative glass rounded-2xl border border-subtle w-full max-w-4xl max-h-[85vh] flex flex-col animate-slide-up shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-subtle">
          <div>
            <h2 className="font-display text-lg text-parchment-100">RAG vs Baseline Comparison</h2>
            <p className="text-xs text-ink-400 mt-0.5">
              Compare answers with and without document context
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-ink-700/50 text-ink-400 hover:text-ink-200 transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {/* Query input */}
          <div className="flex gap-2">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCompare()}
              placeholder="Enter a question to compare…"
              className="input-field"
            />
            <button
              onClick={handleCompare}
              disabled={loading || !query.trim() || !hasDocuments}
              className="btn-primary flex items-center gap-2 whitespace-nowrap"
            >
              {loading
                ? <Loader2 size={14} className="animate-spin" />
                : <ArrowRight size={14} />
              }
              Compare
            </button>
          </div>

          {!hasDocuments && (
            <p className="text-xs text-yellow-400/70 text-center">
              Upload documents first to use the comparison feature
            </p>
          )}

          {error && (
            <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl p-3">
              {error}
            </div>
          )}

          {/* Results */}
          {result && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-fade-in">
              {/* With Context */}
              <div className="rounded-xl border border-accent-500/30 bg-accent-500/5 p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-lg bg-accent-500/20 flex items-center justify-center">
                    <Zap size={13} className="text-accent-400" />
                  </div>
                  <span className="text-sm font-semibold text-accent-400">With Document Context</span>
                  <span className="ml-auto text-[10px] text-ink-500 font-mono">
                    {result.with_context.sources_used} sources
                  </span>
                </div>
                <div className="text-sm text-parchment-200 leading-relaxed whitespace-pre-wrap">
                  {result.with_context.answer}
                </div>
                {result.with_context.sources?.length > 0 && (
                  <div className="border-t border-subtle pt-3 space-y-1">
                    <p className="text-[10px] text-ink-500 font-semibold uppercase tracking-wide">Sources used</p>
                    {result.with_context.sources.map((src) => (
                      <div key={src.id} className="text-[11px] text-ink-400 flex items-center gap-1.5">
                        <span className="w-4 h-4 rounded-full bg-accent-500/20 text-accent-400 text-[9px] flex items-center justify-center font-mono">
                          {src.id}
                        </span>
                        {src.source} · p.{src.page}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Without Context */}
              <div className="rounded-xl border border-ink-600/50 bg-ink-800/30 p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-lg bg-ink-700/60 flex items-center justify-center">
                    <Brain size={13} className="text-ink-300" />
                  </div>
                  <span className="text-sm font-semibold text-ink-300">Baseline (No Context)</span>
                  <span className="ml-auto text-[10px] text-ink-500 font-mono">LLM only</span>
                </div>
                <div className="text-sm text-ink-300 leading-relaxed whitespace-pre-wrap">
                  {result.without_context.answer}
                </div>
              </div>
            </div>
          )}

          {/* Context preview */}
          {result?.retrieved_context_preview && (
            <div className="rounded-xl border border-subtle bg-ink-900/60 p-4 space-y-2">
              <p className="text-[10px] text-ink-500 font-semibold uppercase tracking-wide">Retrieved Context Preview</p>
              <pre className="text-[11px] text-ink-400 font-mono whitespace-pre-wrap leading-relaxed max-h-36 overflow-y-auto">
                {result.retrieved_context_preview}
              </pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
