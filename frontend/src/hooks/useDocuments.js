/**
 * useDocuments — manages uploaded document state.
 */
import { useState, useCallback, useEffect } from "react";
import { listDocuments, uploadPDFs, deleteDocument, getStats } from "../utils/api";

export function useDocuments() {
  const [documents, setDocuments] = useState([]);
  const [stats, setStats] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState([]);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const [docsRes, statsRes] = await Promise.all([listDocuments(), getStats()]);
      setDocuments(docsRes.documents || []);
      setStats(statsRes);
    } catch (err) {
      console.error("Failed to refresh documents:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const upload = useCallback(
    async (files) => {
      if (!files.length) return;
      setUploading(true);
      setError(null);

      // Show pending state for each file
      const pending = Array.from(files).map((f) => ({
        name: f.name,
        status: "uploading",
        size: f.size,
      }));
      setUploadProgress(pending);

      try {
        const result = await uploadPDFs(Array.from(files));

        // Build progress update
        const updated = pending.map((p) => {
          const success = result.results.find((r) => r.original_filename === p.name);
          const err = result.errors.find((e) => e.filename === p.name);
          if (success) return { ...p, status: "success", chunks: success.chunks_indexed };
          if (err) return { ...p, status: "error", errorMsg: err.error };
          return { ...p, status: "unknown" };
        });
        setUploadProgress(updated);

        await refresh();
        return result;
      } catch (err) {
        setError(err.message);
        setUploadProgress((prev) =>
          prev.map((p) => ({ ...p, status: "error", errorMsg: err.message }))
        );
        throw err;
      } finally {
        setUploading(false);
        // Clear progress after a delay
        setTimeout(() => setUploadProgress([]), 5000);
      }
    },
    [refresh]
  );

  const remove = useCallback(
    async (filename) => {
      try {
        await deleteDocument(filename);
        await refresh();
      } catch (err) {
        setError(err.message);
      }
    },
    [refresh]
  );

  return {
    documents,
    stats,
    uploading,
    uploadProgress,
    error,
    loading,
    upload,
    remove,
    refresh,
    setError,
  };
}
