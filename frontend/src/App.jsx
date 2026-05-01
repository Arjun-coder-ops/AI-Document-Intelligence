import { useState, useEffect, useRef, useCallback } from "react";
import {
  MessageSquare, Trash2, GitCompare, AlertCircle,
  Wifi, WifiOff, BookOpen, Sparkles
} from "lucide-react";
import Sidebar from "./components/Sidebar";
import ChatMessage from "./components/ChatMessage";
import ChatInput from "./components/ChatInput";
import CompareModal from "./components/CompareModal";
import { useChat } from "./hooks/useChat";
import { useDocuments } from "./hooks/useDocuments";
import { healthCheck } from "./utils/api";

export default function App() {
  const { messages, isStreaming, error, sendMessage, stopStreaming, clearChat } = useChat();
  const {
    documents, stats, uploading, uploadProgress, error: uploadError,
    loading: docsLoading, upload, remove, refresh
  } = useDocuments();

  const [showCompare, setShowCompare] = useState(false);
  const [backendStatus, setBackendStatus] = useState("checking"); // checking | online | offline
  const messagesEndRef = useRef(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Backend health polling
  useEffect(() => {
    const check = async () => {
      try {
        await healthCheck();
        setBackendStatus("online");
        refresh();
      } catch {
        setBackendStatus("offline");
      }
    };
    check();
    const interval = setInterval(check, 30_000);
    return () => clearInterval(interval);
  }, [refresh]);

  const handleSend = useCallback(
    (query, opts) => {
      if (backendStatus !== "online") return;
      if (!documents.length) return;
      sendMessage(query, opts);
    },
    [backendStatus, documents.length, sendMessage]
  );

  const hasDocuments = documents.length > 0;
  const isOffline = backendStatus === "offline";

  return (
    <div className="h-screen flex bg-ink-900 grain-overlay overflow-hidden">
      {/* Ambient background */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-accent-500/5 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-64 h-64 bg-parchment-500/3 rounded-full blur-3xl" />
      </div>

      {/* Sidebar */}
      <Sidebar
        documents={documents}
        stats={stats}
        uploading={uploading}
        uploadProgress={uploadProgress}
        uploadError={uploadError}
        loading={docsLoading}
        onUpload={upload}
        onDelete={remove}
      />

      {/* Main chat area */}
      <main className="flex-1 flex flex-col min-w-0 relative z-10">
        {/* Topbar */}
        <header className="flex items-center justify-between px-6 py-3.5 border-b border-subtle glass shrink-0">
          <div className="flex items-center gap-3">
            <div>
              <h1 className="font-display text-base font-semibold text-parchment-100">
                Document Intelligence
              </h1>
              <p className="text-[11px] text-ink-500">
                {hasDocuments
                  ? `${documents.length} document${documents.length !== 1 ? "s" : ""} · ${stats?.total_chunks || 0} chunks indexed`
                  : "Upload documents to begin chatting"
                }
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Backend status */}
            <div className={`
              flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-medium
              ${backendStatus === "online"
                ? "bg-green-500/10 text-green-400 border border-green-500/20"
                : backendStatus === "offline"
                  ? "bg-red-500/10 text-red-400 border border-red-500/20"
                  : "bg-ink-700/50 text-ink-400 border border-subtle"
              }
            `}>
              {backendStatus === "online"
                ? <Wifi size={11} />
                : backendStatus === "offline"
                  ? <WifiOff size={11} />
                  : <div className="w-2 h-2 rounded-full bg-ink-500 animate-pulse" />
              }
              {backendStatus === "checking" ? "Connecting…" : backendStatus}
            </div>

            {/* Compare button */}
            <button
              onClick={() => setShowCompare(true)}
              disabled={!hasDocuments || isOffline}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium glass-light hover:bg-ink-700/50 text-ink-300 hover:text-parchment-200 transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed border border-subtle"
              title="Compare RAG vs baseline"
            >
              <GitCompare size={12} />
              Compare
            </button>

            {/* Clear chat */}
            {messages.length > 0 && (
              <button
                onClick={clearChat}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium text-ink-400 hover:text-red-400 hover:bg-red-500/10 transition-all duration-200 border border-subtle"
                title="Clear conversation"
              >
                <Trash2 size={12} />
                Clear
              </button>
            )}
          </div>
        </header>

        {/* Messages area */}
        <div className="flex-1 overflow-y-auto px-6 py-6 space-y-5">
          {/* Empty state */}
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-center animate-fade-in">
              {isOffline ? (
                <div className="space-y-3 max-w-sm">
                  <div className="w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto">
                    <WifiOff size={28} className="text-red-400" />
                  </div>
                  <h2 className="font-display text-xl text-parchment-100">Backend Offline</h2>
                  <p className="text-sm text-ink-400 leading-relaxed">
                    Make sure the FastAPI backend is running on port 8000.
                    <br />
                    <code className="text-xs font-mono text-accent-400 mt-1 block">
                      uvicorn main:app --reload
                    </code>
                  </p>
                </div>
              ) : !hasDocuments ? (
                <div className="space-y-4 max-w-md">
                  <div className="w-20 h-20 rounded-2xl bg-accent-500/10 border border-accent-500/20 flex items-center justify-center mx-auto">
                    <BookOpen size={34} className="text-accent-400" />
                  </div>
                  <div>
                    <h2 className="font-display text-2xl text-parchment-100 mb-2">
                      Upload your documents
                    </h2>
                    <p className="text-sm text-ink-400 leading-relaxed">
                      Drop PDFs in the sidebar to index them. Then ask questions
                      and get answers grounded in your documents.
                    </p>
                  </div>
                  <div className="grid grid-cols-3 gap-3 mt-4">
                    {[
                      { icon: "📄", label: "Upload PDF" },
                      { icon: "🔍", label: "Ask questions" },
                      { icon: "📎", label: "See sources" },
                    ].map(({ icon, label }) => (
                      <div key={label} className="rounded-xl bg-ink-800/40 border border-subtle p-3 text-center">
                        <div className="text-2xl mb-1">{icon}</div>
                        <div className="text-[11px] text-ink-400">{label}</div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="space-y-4 max-w-lg">
                  <div className="w-16 h-16 rounded-2xl bg-ink-700/60 border border-subtle flex items-center justify-center mx-auto">
                    <Sparkles size={26} className="text-parchment-400" />
                  </div>
                  <div>
                    <h2 className="font-display text-xl text-parchment-100 mb-2">
                      Ready to answer
                    </h2>
                    <p className="text-sm text-ink-400">
                      {documents.length} document{documents.length !== 1 ? "s" : ""} indexed.
                      Ask anything about your content.
                    </p>
                  </div>
                  {/* Suggestion chips */}
                  <div className="flex flex-wrap gap-2 justify-center mt-2">
                    {[
                      "Summarize the main topics",
                      "What are the key findings?",
                      "List important dates or numbers",
                      "What conclusions are drawn?",
                    ].map((suggestion) => (
                      <button
                        key={suggestion}
                        onClick={() => handleSend(suggestion, {})}
                        className="px-3 py-1.5 rounded-full text-xs glass-light border border-subtle text-ink-300 hover:text-parchment-200 hover:border-ink-500 transition-all duration-200"
                      >
                        {suggestion}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Message list */}
          {messages.map((msg) => (
            <ChatMessage key={msg.id} message={msg} />
          ))}

          {/* Global error */}
          {error && messages.length > 0 && (
            <div className="flex items-center gap-2 text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 animate-fade-in">
              <AlertCircle size={13} />
              {error}
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="px-6 py-4 border-t border-subtle glass shrink-0">
          <ChatInput
            onSend={handleSend}
            onStop={stopStreaming}
            isStreaming={isStreaming}
            disabled={!hasDocuments || isOffline}
            placeholder={
              isOffline
                ? "Backend offline…"
                : !hasDocuments
                  ? "Upload a PDF first to start chatting…"
                  : "Ask a question about your documents…"
            }
          />
        </div>
      </main>

      {/* Compare Modal */}
      {showCompare && (
        <CompareModal
          onClose={() => setShowCompare(false)}
          hasDocuments={hasDocuments}
        />
      )}
    </div>
  );
}
