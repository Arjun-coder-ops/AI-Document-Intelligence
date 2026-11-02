import React, { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, type DocumentRecord } from '../api/client.js';
import { useAuth } from '../context/AuthContext.js';
import {
  FileText,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Clock,
  Loader2,
  RefreshCw,
  HardDrive,
  FileCheck,
} from 'lucide-react';
import { UploadDropzone } from '../components/UploadDropzone.js';
import { DocumentTable } from '../components/DocumentTable.js';

function formatBytes(bytes: number, decimals = 1): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

export const DocumentsPage: React.FC = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [dragActive, setDragActive] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const canMutate = user?.role === 'admin' || user?.role === 'editor';

  // ─── Query Documents List ───────────────────────────────────────────────────
  const {
    data: documents = [],
    isLoading,
    refetch,
    isRefetching,
  } = useQuery<DocumentRecord[]>({
    queryKey: ['documents'],
    queryFn: () => api.getDocuments(),
    refetchInterval: (query) => {
      const hasPending = query.state.data?.some(
        (d) => d.status === 'pending' || d.status === 'processing',
      );
      return hasPending ? 3000 : false;
    },
  });

  // ─── Delete Mutation ────────────────────────────────────────────────────────
  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.deleteDocument(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['documents'] });
    },
    onError: (err: Error) => {
      setUploadError(`Delete failed: ${err.message}`);
    },
  });

  // ─── Upload Handler ─────────────────────────────────────────────────────────
  const handleUploadFile = async (file: File) => {
    setUploadError(null);
    setUploadSuccess(null);

    if (!file.name.toLowerCase().endsWith('.pdf') && file.type !== 'application/pdf') {
      setUploadError('Only valid PDF documents (%PDF-) are accepted.');
      return;
    }

    if (file.size > 20 * 1024 * 1024) {
      setUploadError('File size exceeds the 20MB tenant threshold.');
      return;
    }

    setIsUploading(true);
    try {
      const res = await api.uploadDocument(file);
      if (res.isDuplicate) {
        setUploadSuccess(
          `Identical content detected: returned existing document ID ${res.documentId.slice(0, 8)}...`,
        );
      } else {
        setUploadSuccess(`Document queued for asynchronous chunking and HNSW indexing!`);
      }
      void queryClient.invalidateQueries({ queryKey: ['documents'] });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Upload failed';
      setUploadError(msg);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (!canMutate || isUploading) return;
    const file = e.dataTransfer.files?.[0];
    if (file) void handleUploadFile(file);
  };

  return (
    <div style={{ padding: '32px 40px', maxWidth: '1200px', margin: '0 auto', width: '100%' }}>
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '28px',
        }}
      >
        <div>
          <h1
            style={{
              fontSize: '1.75rem',
              fontWeight: 700,
              letterSpacing: '-0.02em',
              marginBottom: '4px',
            }}
          >
            Document Management
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
            Upload PDFs to automatically generate recursive text chunks, 768-d Gemini embeddings,
            and PostgreSQL GIN full-text vectors.
          </p>
        </div>

        <button
          onClick={() => void refetch()}
          className="btn btn-secondary"
          disabled={isRefetching}
        >
          <RefreshCw size={15} className={isRefetching ? 'animate-spin' : ''} />
          <span>Sync Corpus</span>
        </button>
      </div>

      {/* Upload Dropzone */}
      <UploadDropzone
        canMutate={canMutate}
        isUploading={isUploading}
        dragActive={dragActive}
        fileInputRef={fileInputRef}
        onDragEnter={(e) => {
          e.preventDefault();
          e.stopPropagation();
          if (canMutate) setDragActive(true);
        }}
        onDragLeave={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setDragActive(false);
        }}
        onDragOver={(e) => {
          e.preventDefault();
          e.stopPropagation();
        }}
        onDrop={handleDrop}
        onFileSelect={(e) => {
          const file = e.target.files?.[0];
          if (file) void handleUploadFile(file);
        }}
      />

      {/* Status Alerts */}
      {uploadError && (
        <div
          className="animate-fade-in"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            padding: '12px 16px',
            backgroundColor: 'var(--rose-bg)',
            color: 'var(--rose)',
            borderRadius: 'var(--radius-md)',
            marginBottom: '20px',
            fontSize: '0.875rem',
            border: '1px solid rgba(244, 63, 94, 0.2)',
          }}
        >
          <AlertCircle size={18} />
          <div>{uploadError}</div>
        </div>
      )}

      {uploadSuccess && (
        <div
          className="animate-fade-in"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            padding: '12px 16px',
            backgroundColor: 'var(--emerald-bg)',
            color: 'var(--emerald)',
            borderRadius: 'var(--radius-md)',
            marginBottom: '20px',
            fontSize: '0.875rem',
            border: '1px solid rgba(16, 185, 129, 0.2)',
          }}
        >
          <CheckCircle2 size={18} />
          <div>{uploadSuccess}</div>
        </div>
      )}

      {/* Documents Table */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid var(--border-subtle)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div
            style={{
              fontSize: '0.9rem',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <HardDrive size={16} color="var(--accent)" />
            <span>Indexed Corpus ({documents.length} files)</span>
          </div>
        </div>

        {isLoading ? (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
            <Loader2 size={24} className="animate-spin" style={{ margin: '0 auto 10px' }} />
            <div>Loading tenant documents...</div>
          </div>
        ) : documents.length === 0 ? (
          <div style={{ padding: '60px 20px', textAlign: 'center', color: 'var(--text-muted)' }}>
            <FileText size={36} style={{ margin: '0 auto 12px', opacity: 0.3 }} />
            <div
              style={{
                fontWeight: 600,
                fontSize: '1rem',
                color: 'var(--text-secondary)',
                marginBottom: '4px',
              }}
            >
              No documents in this workspace yet
            </div>
            <div style={{ fontSize: '0.85rem' }}>
              Upload your first PDF document to build your searchable RAG vector corpus.
            </div>
          </div>
        ) : (
          <DocumentTable
            documents={documents}
            canMutate={canMutate}
            isDeleting={deleteMutation.isPending}
            onDelete={(id) => {
              deleteMutation.mutate(id);
            }}
          />
        )}
      </div>
    </div>
  );
};
