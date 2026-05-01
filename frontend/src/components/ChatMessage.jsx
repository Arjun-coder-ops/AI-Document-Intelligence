import { useState } from "react";
import { User, Bot, ChevronDown, ChevronUp, Bug, AlertCircle } from "lucide-react";
import SourceCard from "./SourceCard";

/**
 * ChatMessage — renders a single message bubble with optional sources and debug info.
 */
export default function ChatMessage({ message }) {
  const [showSources, setShowSources] = useState(true);
  const [showDebug, setShowDebug] = useState(false);

  const isUser = message.role === "user";
  const isAssistant = message.role === "assistant";
  const hasError = !!message.error;
  const hasSources = message.sources?.length > 0;
  const hasDebug = message.debugChunks?.length > 0;

  const formatTime = (date) =>
    new Date(date).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  // Simple markdown-like renderer for assistant messages
  const renderContent = (text) => {
    if (!text) return null;
    // Split by code blocks first
    const parts = text.split(/(```[\s\S]*?```)/g);
    return parts.map((part, i) => {
      if (part.startsWith("```")) {
        const lines = part.slice(3, -3).split("\n");
        const lang = lines[0];
        const code = lines.slice(1).join("\n");
        return (
          <pre key={i} className="bg-ink-900/80 border border-subtle rounded-lg p-3 overflow-x-auto my-2 text-[11px] font-mono text-parchment-200">
            {lang && <div className="text-ink-500 mb-1 text-[10px]">{lang}</div>}
            <code>{code}</code>
          </pre>
        );
      }
      // Process inline formatting
      return (
        <span key={i}>
          {part.split("\n").map((line, j, arr) => {
            // Bold
            const processed = line.split(/(\*\*[^*]+\*\*)/g).map((seg, k) => {
              if (seg.startsWith("**") && seg.endsWith("**")) {
                return <strong key={k} className="text-parchment-100 font-semibold">{seg.slice(2, -2)}</strong>;
              }
              // Inline code
              return seg.split(/(`[^`]+`)/g).map((s, l) => {
                if (s.startsWith("`") && s.endsWith("`")) {
                  return <code key={l} className="bg-ink-800 rounded px-1 py-0.5 text-[11px] font-mono text-parchment-300">{s.slice(1, -1)}</code>;
                }
                return s;
              });
            });
            return (
              <span key={j}>
                {processed}
                {j < arr.length - 1 && <br />}
              </span>
            );
          })}
        </span>
      );
    });
  };

  return (
    <div className={`flex gap-3 animate-slide-up ${isUser ? "flex-row-reverse" : "flex-row"}`}>
      {/* Avatar */}
      <div className={`
        w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5
        ${isUser
          ? "bg-accent-500/20 border border-accent-500/30"
          : "bg-ink-700/80 border border-subtle"
        }
      `}>
        {isUser
          ? <User size={15} className="text-accent-400" />
          : <Bot size={15} className="text-parchment-300" />
        }
      </div>

      {/* Bubble */}
      <div className={`flex-1 max-w-[85%] space-y-2 ${isUser ? "items-end" : "items-start"} flex flex-col`}>
        {/* Main bubble */}
        <div className={`
          rounded-2xl px-4 py-3 text-sm leading-relaxed
          ${isUser
            ? "bg-accent-500/15 border border-accent-500/25 text-parchment-100 rounded-tr-sm ml-auto"
            : hasError
              ? "bg-red-500/10 border border-red-500/20 text-red-300 rounded-tl-sm"
              : "glass-light text-parchment-200 rounded-tl-sm"
          }
        `}>
          {hasError ? (
            <div className="flex items-start gap-2">
              <AlertCircle size={14} className="text-red-400 mt-0.5 shrink-0" />
              <span>{message.error}</span>
            </div>
          ) : (
            <div className="prose-content">
              {isUser
                ? <p className="m-0">{message.content}</p>
                : renderContent(message.content)
              }
              {/* Streaming cursor */}
              {message.isStreaming && message.content && (
                <span className="inline-block w-0.5 h-4 bg-accent-400 ml-0.5 cursor-blink align-text-bottom" />
              )}
              {/* Loading dots before first token */}
              {message.isStreaming && !message.content && (
                <div className="flex items-center gap-1 py-1">
                  <div className="w-1.5 h-1.5 rounded-full bg-ink-400 dot-pulse-1" />
                  <div className="w-1.5 h-1.5 rounded-full bg-ink-400 dot-pulse-2" />
                  <div className="w-1.5 h-1.5 rounded-full bg-ink-400 dot-pulse-3" />
                </div>
              )}
            </div>
          )}
        </div>

        {/* Timestamp */}
        <span className="text-[10px] text-ink-600 px-1">
          {formatTime(message.timestamp)}
        </span>

        {/* Sources section */}
        {hasSources && !message.isStreaming && (
          <div className="w-full space-y-1.5">
            <button
              onClick={() => setShowSources(!showSources)}
              className="flex items-center gap-1.5 text-[11px] text-ink-400 hover:text-ink-200 transition-colors"
            >
              {showSources ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
              <span className="font-medium">{message.sources.length} source{message.sources.length !== 1 ? "s" : ""} retrieved</span>
            </button>

            {showSources && (
              <div className="space-y-1.5">
                {message.sources.map((src) => (
                  <SourceCard key={src.id} source={src} index={src.id} />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Debug chunks */}
        {hasDebug && (
          <div className="w-full">
            <button
              onClick={() => setShowDebug(!showDebug)}
              className="flex items-center gap-1.5 text-[11px] text-yellow-500/70 hover:text-yellow-400 transition-colors"
            >
              <Bug size={11} />
              {showDebug ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
              <span>Debug: {message.debugChunks.length} chunks</span>
            </button>

            {showDebug && (
              <div className="mt-2 rounded-lg bg-yellow-500/5 border border-yellow-500/20 p-3 text-[11px] font-mono text-yellow-200/70 space-y-3 max-h-72 overflow-y-auto">
                {message.debugChunks.map((chunk) => (
                  <div key={chunk.chunk_index} className="space-y-1">
                    <div className="text-yellow-400/80 font-semibold">
                      [{chunk.chunk_index}] {chunk.source} · p.{chunk.page} · score: {chunk.score}
                    </div>
                    <div className="text-yellow-200/50 whitespace-pre-wrap leading-relaxed">
                      {chunk.text}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
