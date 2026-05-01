import { useState } from "react";
import { BookOpen, ChevronLeft, ChevronRight, BarChart2, Layers } from "lucide-react";
import UploadZone from "./UploadZone";
import DocumentList from "./DocumentList";

/**
 * Sidebar — collapsible panel with upload zone, document list, and stats.
 */
export default function Sidebar({
  documents,
  stats,
  uploading,
  uploadProgress,
  uploadError,
  loading,
  onUpload,
  onDelete,
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [tab, setTab] = useState("docs"); // "docs" | "stats"

  return (
    <aside
      className={`
        relative flex flex-col glass border-r border-subtle transition-all duration-300 ease-in-out
        ${collapsed ? "w-12" : "w-72"}
      `}
    >
      {/* Collapse toggle */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="absolute -right-3 top-6 z-10 w-6 h-6 rounded-full glass border border-subtle flex items-center justify-center text-ink-400 hover:text-parchment-200 transition-colors shadow-md"
      >
        {collapsed ? <ChevronRight size={12} /> : <ChevronLeft size={12} />}
      </button>

      {/* Collapsed state: just icons */}
      {collapsed && (
        <div className="flex flex-col items-center py-4 gap-4">
          <BookOpen size={18} className="text-ink-500" />
          <div className="w-6 h-px bg-ink-700" />
          <span className="text-[10px] text-ink-600 font-mono rotate-90 mt-4 whitespace-nowrap">
            {documents.length} docs
          </span>
        </div>
      )}

      {/* Expanded state */}
      {!collapsed && (
        <div className="flex flex-col h-full overflow-hidden">
          {/* Header */}
          <div className="px-4 pt-5 pb-3 border-b border-subtle shrink-0">
            <div className="flex items-center gap-2 mb-3">
              <BookOpen size={16} className="text-accent-400" />
              <h2 className="font-display text-sm font-semibold text-parchment-100">
                DocSage
              </h2>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 p-0.5 bg-ink-800/60 rounded-lg">
              {[
                { id: "docs", label: "Library", icon: Layers },
                { id: "stats", label: "Stats", icon: BarChart2 },
              ].map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  onClick={() => setTab(id)}
                  className={`
                    flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-md text-xs font-medium transition-all duration-200
                    ${tab === id
                      ? "bg-ink-700 text-parchment-100 shadow-sm"
                      : "text-ink-400 hover:text-ink-200"
                    }
                  `}
                >
                  <Icon size={11} />
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Tab content */}
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
            {tab === "docs" && (
              <>
                <UploadZone
                  onUpload={onUpload}
                  uploading={uploading}
                  uploadProgress={uploadProgress}
                  error={uploadError}
                />
                <div>
                  <p className="text-[10px] text-ink-500 font-semibold uppercase tracking-wider mb-2 px-0.5">
                    Indexed Documents ({documents.length})
                  </p>
                  <DocumentList
                    documents={documents}
                    onDelete={onDelete}
                    loading={loading}
                  />
                </div>
              </>
            )}

            {tab === "stats" && stats && (
              <div className="space-y-3 animate-fade-in">
                <div className="rounded-xl bg-ink-800/40 border border-subtle p-4 space-y-3">
                  <h3 className="text-xs font-semibold text-ink-300 uppercase tracking-wide">
                    Pipeline Status
                  </h3>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { label: "Documents", value: stats.documents_indexed },
                      { label: "Chunks", value: stats.total_chunks },
                      { label: "Chunk Size", value: `${stats.chunk_size}` },
                      { label: "Overlap", value: `${stats.chunk_overlap}` },
                      { label: "Top-K", value: stats.top_k },
                      {
                        label: "Index",
                        value: stats.vector_store_ready ? "Ready" : "Empty",
                        valueClass: stats.vector_store_ready ? "text-green-400" : "text-yellow-400",
                      },
                    ].map(({ label, value, valueClass }) => (
                      <div key={label} className="bg-ink-900/40 rounded-lg p-2.5 text-center">
                        <div className={`text-sm font-semibold font-mono ${valueClass || "text-parchment-100"}`}>
                          {value}
                        </div>
                        <div className="text-[10px] text-ink-500 mt-0.5">{label}</div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-xl bg-ink-800/40 border border-subtle p-4 space-y-2">
                  <h3 className="text-xs font-semibold text-ink-300 uppercase tracking-wide">
                    Models
                  </h3>
                  <div className="space-y-1.5 text-[11px] font-mono">
                    <div className="flex justify-between">
                      <span className="text-ink-500">LLM</span>
                      <span className="text-parchment-300">{stats.llm_model}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-ink-500">Embeddings</span>
                      <span className="text-parchment-300 truncate ml-2">{stats.embedding_model}</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {tab === "stats" && !stats && (
              <div className="text-center py-8 text-sm text-ink-500">
                Loading stats…
              </div>
            )}
          </div>
        </div>
      )}
    </aside>
  );
}
