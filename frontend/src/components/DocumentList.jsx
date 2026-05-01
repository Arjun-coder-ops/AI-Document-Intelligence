import { useState } from "react";
import { FileText, Trash2, ChevronDown, ChevronRight, BookOpen, Hash } from "lucide-react";

/**
 * DocumentList — shows all indexed documents with metadata.
 */
export default function DocumentList({ documents, onDelete, loading }) {
  const [expanded, setExpanded] = useState(null);
  const [deleting, setDeleting] = useState(null);

  const handleDelete = async (filename) => {
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
    <div className="space-y-1.5">
      {documents.map((doc) => {
        const isOpen = expanded === doc.filename;
        return (
          <div
            key={doc.filename}
            className="rounded-lg border border-subtle overflow-hidden transition-all duration-200"
          >
            {/* Header row */}
            <div className="flex items-center gap-2 px-3 py-2.5 bg-ink-800/40 hover:bg-ink-800/60 transition-colors">
              <button
                onClick={() => setExpanded(isOpen ? null : doc.filename)}
                className="flex items-center gap-2 flex-1 min-w-0 text-left"
              >
                {isOpen
                  ? <ChevronDown size={13} className="text-ink-400 shrink-0" />
                  : <ChevronRight size={13} className="text-ink-400 shrink-0" />
                }
                <FileText size={14} className="text-accent-400 shrink-0" />
                <span className="text-xs font-medium text-parchment-200 truncate">
                  {doc.filename}
                </span>
              </button>

              <div className="flex items-center gap-2 shrink-0">
                <span className="text-[10px] text-ink-500 font-mono">
                  {doc.chunks}ch
                </span>
                <button
                  onClick={() => handleDelete(doc.filename)}
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
                    <div className="text-ink-500 col-span-2">
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
