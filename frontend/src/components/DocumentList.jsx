import { useState } from "react";
import { FileText, Trash2, ChevronDown, ChevronRight, BookOpen, Hash } from "lucide-react";

/**
 * DocumentList — shows all indexed documents with metadata.
 */
export default function DocumentList({ documents, onDelete, activeDocName, onSelectDocument, loading }) {
  const [expanded, setExpanded] = useState(null);
  const [deleting, setDeleting] = useState(null);

  const handleDelete = async (filename, e) => {
    e.stopPropagation();
    if (!confirm(`Remove "${filename}" from the index?`)) return;
    setDeleting(filename);
    try {
      await onDelete(filename);
    } finally {
      setDeleting(null);
    }
  };

  if (loading) {
    return (
      <div className="space-y-2">
        {[1, 2].map((i) => (
          <div key={i} className="h-12 rounded-lg skeleton" />
        ))}
      </div>
    );
  }

  if (!documents.length) {
    return (
      <div className="text-center py-8">
        <BookOpen size={32} className="text-ink-600 mx-auto mb-2" />
        <p className="text-sm text-ink-500">No documents indexed yet</p>
        <p className="text-xs text-ink-600 mt-1">Upload a PDF to get started</p>
      </div>
    );
  }

  return (
    <div className="space-y-1.5 font-sans">
      {documents.map((doc) => {
        const isOpen = expanded === doc.filename;
        const isActive = doc.filename === activeDocName;
        return (
          <div
            key={doc.filename}
            className={`rounded-lg border overflow-hidden transition-all duration-200 ${
              isActive ? "border-accent-500/50 shadow-md shadow-accent-500/5" : "border-subtle"
            }`}
          >
            {/* Header row */}
            <div
              onClick={() => onSelectDocument?.(doc.filename)}
              className={`flex items-center gap-1 px-2.5 py-2 transition-colors cursor-pointer select-none ${
                isActive ? "bg-ink-800/90 text-parchment-100" : "bg-ink-800/40 hover:bg-ink-800/60 text-ink-300"
              }`}
            >
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setExpanded(isOpen ? null : doc.filename);
                }}
                className="p-1 rounded hover:bg-ink-700/50 text-ink-400 hover:text-parchment-200 transition-colors shrink-0"
              >
                {isOpen
                  ? <ChevronDown size={13} />
                  : <ChevronRight size={13} />
                }
              </button>

              <div className="flex items-center gap-2 flex-1 min-w-0">
                <FileText size={14} className={`${isActive ? "text-accent-400" : "text-ink-400"} shrink-0`} />
                <span className={`text-xs font-medium truncate ${isActive ? "text-parchment-100" : "text-parchment-200"}`}>
                  {doc.filename}
                </span>
              </div>

              <div className="flex items-center gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                <span className="text-[10px] text-ink-500 font-mono">
                  {doc.chunks}ch
                </span>
                <button
                  onClick={(e) => handleDelete(doc.filename, e)}
                  disabled={deleting === doc.filename}
                  className="p-1 rounded hover:bg-red-500/20 text-ink-500 hover:text-red-400 transition-colors disabled:opacity-50"
                  title="Remove document"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            </div>

            {/* Expanded metadata */}
            {isOpen && (
              <div className="px-4 py-3 bg-ink-900/40 border-t border-subtle animate-fade-in">
                <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-[11px]">
                  <div className="flex items-center gap-1.5 text-ink-400">
                    <BookOpen size={11} />
                    <span>{doc.pages} pages</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-ink-400">
                    <Hash size={11} />
                    <span>{doc.chunks} chunks</span>
                  </div>
                  <div className="text-ink-500 col-span-2 font-mono truncate" title={doc.filename}>
                    {doc.filename}
                  </div>
                  {doc.chunk_size && (
                    <div className="text-ink-500 col-span-2 col-span-2 mt-0.5">
                      chunk: {doc.chunk_size}ch / overlap: {doc.chunk_overlap}ch
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
