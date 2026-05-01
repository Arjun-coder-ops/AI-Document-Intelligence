import { useState, useRef, useEffect, useCallback } from "react";
import { Send, Square, Bug, Zap } from "lucide-react";

/**
 * ChatInput — multi-line input with send/stop controls and debug toggle.
 */
export default function ChatInput({ onSend, isStreaming, onStop, disabled, placeholder }) {
  const [query, setQuery] = useState("");
  const [debugMode, setDebugMode] = useState(false);
  const textareaRef = useRef(null);

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 160) + "px";
  }, [query]);

  const handleSend = useCallback(() => {
    if (!query.trim() || isStreaming) return;
    onSend(query, { debug: debugMode });
    setQuery("");
  }, [query, isStreaming, onSend, debugMode]);

  const onKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const canSend = query.trim().length > 0 && !isStreaming && !disabled;

  return (
    <div className="space-y-2">
      {/* Input bar */}
      <div className={`
        flex items-end gap-2 glass rounded-2xl px-3 py-2.5 transition-all duration-200
        ${disabled ? "opacity-50" : "focus-within:border-accent-500/40 focus-within:ring-1 focus-within:ring-accent-500/20"}
      `}>
        <textarea
          ref={textareaRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={onKeyDown}
          disabled={disabled || isStreaming}
          placeholder={placeholder || "Ask a question about your documents…"}
          rows={1}
          className="flex-1 bg-transparent text-sm text-parchment-100 placeholder-ink-500 outline-none resize-none py-0.5 leading-relaxed max-h-40"
          style={{ fontFamily: "'DM Sans', sans-serif" }}
        />

        <div className="flex items-center gap-1 shrink-0 pb-0.5">
          {/* Debug toggle */}
          <button
            onClick={() => setDebugMode(!debugMode)}
            title={debugMode ? "Debug mode ON — chunks will be shown" : "Enable debug mode"}
            className={`
              p-1.5 rounded-lg transition-all duration-200
              ${debugMode
                ? "bg-yellow-500/20 text-yellow-400 border border-yellow-500/30"
                : "text-ink-500 hover:text-ink-300 hover:bg-ink-700/50"
              }
            `}
          >
            <Bug size={14} />
          </button>

          {/* Send / Stop */}
          {isStreaming ? (
            <button
              onClick={onStop}
              className="p-1.5 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/30 transition-all duration-200"
              title="Stop generation"
            >
              <Square size={14} />
            </button>
          ) : (
            <button
              onClick={handleSend}
              disabled={!canSend}
              className={`
                p-1.5 rounded-lg transition-all duration-200
                ${canSend
                  ? "bg-accent-500 hover:bg-accent-600 text-parchment-50 shadow-lg shadow-accent-500/20"
                  : "bg-ink-700/50 text-ink-500 cursor-not-allowed"
                }
              `}
              title="Send (Enter)"
            >
              <Send size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Hints */}
      <div className="flex items-center justify-between px-1">
        <span className="text-[10px] text-ink-600">
          Enter to send · Shift+Enter for new line
        </span>
        <div className="flex items-center gap-1">
          {debugMode && (
            <span className="flex items-center gap-1 text-[10px] text-yellow-500/70">
              <Bug size={9} /> debug on
            </span>
          )}
          {isStreaming && (
            <span className="flex items-center gap-1 text-[10px] text-accent-400/70 animate-pulse-soft">
              <Zap size={9} /> generating…
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
