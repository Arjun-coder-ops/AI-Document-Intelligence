import { useState, useRef, useCallback } from "react";
import { Upload, FileText, AlertCircle, CheckCircle2, Loader2, X } from "lucide-react";

/**
 * UploadZone — drag-and-drop + click-to-upload PDF zone.
 */
export default function UploadZone({ onUpload, uploading, uploadProgress, error }) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef(null);

  const handleFiles = useCallback(
    (files) => {
      const pdfs = Array.from(files).filter((f) =>
        f.name.toLowerCase().endsWith(".pdf")
      );
      if (!pdfs.length) return;
      onUpload(pdfs);
    },
    [onUpload]
  );

  const onDrop = useCallback(
    (e) => {
      e.preventDefault();
      setDragging(false);
      handleFiles(e.dataTransfer.files);
    },
    [handleFiles]
  );

  const onDragOver = (e) => { e.preventDefault(); setDragging(true); };
  const onDragLeave = () => setDragging(false);

  const statusIcon = (status) => {
    if (status === "uploading") return <Loader2 size={14} className="animate-spin text-accent-400" />;
    if (status === "success") return <CheckCircle2 size={14} className="text-green-400" />;
    if (status === "error") return <AlertCircle size={14} className="text-red-400" />;
    return null;
  };

  const formatBytes = (bytes) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="space-y-3">
      {/* Drop Zone */}
      <div
        onDrop={onDrop}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onClick={() => !uploading && inputRef.current?.click()}
        className={`
          relative rounded-xl border-2 border-dashed p-6 text-center
          transition-all duration-300 cursor-pointer group
          ${dragging
            ? "border-accent-400 bg-accent-500/10 scale-[1.02]"
            : "border-ink-600 hover:border-ink-500 hover:bg-ink-800/30"
          }
          ${uploading ? "cursor-not-allowed opacity-60" : ""}
        `}
      >
        <input
          ref={inputRef}
          type="file"
          multiple
          accept=".pdf"
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
          disabled={uploading}
        />

        <div className="flex flex-col items-center gap-2">
          <div className={`
            w-12 h-12 rounded-xl flex items-center justify-center
            transition-all duration-300
            ${dragging ? "bg-accent-500/20 scale-110" : "bg-ink-700/60 group-hover:bg-ink-700"}
          `}>
            {uploading
              ? <Loader2 size={22} className="text-accent-400 animate-spin" />
              : <Upload size={22} className={dragging ? "text-accent-400" : "text-ink-300 group-hover:text-parchment-300"} />
            }
          </div>

          <div>
            <p className="text-sm font-medium text-parchment-200">
              {dragging ? "Drop to upload" : uploading ? "Processing..." : "Drop PDFs here"}
            </p>
            <p className="text-xs text-ink-400 mt-0.5">
              or <span className="text-accent-400 hover:text-accent-300">browse files</span> · max 50MB each
            </p>
          </div>
        </div>
      </div>

      {/* Upload Progress */}
      {uploadProgress.length > 0 && (
        <div className="space-y-1.5 animate-fade-in">
          {uploadProgress.map((item, i) => (
            <div
              key={i}
              className={`
                flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs
                ${item.status === "error" ? "bg-red-500/10 border border-red-500/20" :
                  item.status === "success" ? "bg-green-500/10 border border-green-500/20" :
                  "bg-ink-800/60 border border-subtle"}
              `}
            >
              <FileText size={13} className="text-ink-400 shrink-0" />
              <span className="flex-1 truncate text-ink-200">{item.name}</span>
              <span className="text-ink-500 shrink-0">{formatBytes(item.size)}</span>
              {item.status === "success" && item.chunks && (
                <span className="text-green-400 shrink-0">{item.chunks} chunks</span>
              )}
              {item.status === "error" && (
                <span className="text-red-400 shrink-0 max-w-[120px] truncate" title={item.errorMsg}>
                  {item.errorMsg}
                </span>
              )}
              <span className="shrink-0">{statusIcon(item.status)}</span>
            </div>
          ))}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20 text-xs text-red-300 animate-fade-in">
          <AlertCircle size={13} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}
