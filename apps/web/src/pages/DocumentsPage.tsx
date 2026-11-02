import React, { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, type DocumentRecord } from '../api/client.js';
import { useAuth } from '../context/AuthContext.js';
import {
  UploadCloud,
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
      // Auto-poll every 3s if any document is pending or processing
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

    // Frontend validation: check magic PDF type
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

    if (!canMutate) {
      setUploadError(
        'Viewer role does not have upload permissions. Contact a tenant administrator.',
      );
      return;
    }

    const files = e.dataTransfer.files;
    if (files.length > 0 && files[0]) {
      void handleUploadFile(files[0]);
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
  };

  return (
    <div style={{ padding: '32px 40px', maxWidth: '1200px', margin: '0 auto', width: '100%' }}>
      {/* Page Header */}
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
            Document Knowledge Base
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
            Upload PDFs to undergo structure-aware chunking, batch vector embedding, and full-text
            GIN indexing.
          </p>
        </div>

        <button
          onClick={() => void refetch()}
          className="btn btn-secondary"
          disabled={isRefetching}
          title="Refresh library"
        >
          <RefreshCw size={15} className={isRefetching ? 'animate-spin' : ''} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Upload Drop Zone */}
      {canMutate && (
        <div
          onDragEnter={(e) => {
            e.preventDefault();
            setDragActive(true);
          }}
          onDragLeave={(e) => {
            e.preventDefault();
            setDragActive(false);
          }}
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop}
          style={{
            border: `2px dashed ${dragActive ? 'var(--accent)' : 'var(--border-strong)'}`,
            borderRadius: 'var(--radius-lg)',
            padding: '36px 20px',
            textAlign: 'center',
            backgroundColor: dragActive ? 'var(--accent-light)' : 'var(--bg-card)',
            transition: 'all 0.2s ease',
            marginBottom: '28px',
            cursor: isUploading ? 'not-allowed' : 'pointer',
          }}
          onClick={() => {
            if (!isUploading && fileInputRef.current) {
              fileInputRef.current.click();
            }
          }}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,application/pdf"
            style={{ display: 'none' }}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) {
                void handleUploadFile(file);
              }
            }}
          />

          <div
            style={{
              width: '48px',
              height: '48px',
              borderRadius: 'var(--radius-full)',
              backgroundColor: 'var(--bg-surface)',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--accent)',
              marginBottom: '12px',
            }}
          >
            {isUploading ? (
              <Loader2 size={24} className="animate-spin" />
            ) : (
              <UploadCloud size={24} />
            )}
          </div>

          <div style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '4px' }}>
            {isUploading
              ? 'Streaming & Parsing PDF...'
              : 'Click to select or drag and drop PDF file'}
          </div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            Streamed in chunks to object storage • Strict magic byte validation (%PDF-) • 20MB limit
          </div>
        </div>
      )}

      {/* Notification Banners */}
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
            border: '1px solid rgba(239, 68, 68, 0.2)',
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
          <div style={{ overflowX: 'auto' }}>
            <table
              style={{
                width: '100%',
                borderCollapse: 'collapse',
                textAlign: 'left',
                fontSize: '0.875rem',
              }}
            >
              <thead>
                <tr
                  style={{
                    borderBottom: '1px solid var(--border-subtle)',
                    color: 'var(--text-muted)',
                  }}
                >
                  <th style={{ padding: '12px 20px', fontWeight: 600 }}>DOCUMENT</th>
                  <th style={{ padding: '12px 20px', fontWeight: 600 }}>STATUS</th>
                  <th style={{ padding: '12px 20px', fontWeight: 600 }}>VERSION</th>
                  <th style={{ padding: '12px 20px', fontWeight: 600 }}>SIZE</th>
                  <th style={{ padding: '12px 20px', fontWeight: 600 }}>UPLOADED</th>
                  <th style={{ padding: '12px 20px', fontWeight: 600, textAlign: 'right' }}>
                    ACTIONS
                  </th>
                </tr>
              </thead>
              <tbody>
                {documents.map((doc) => (
                  <tr
                    key={doc.id}
                    style={{
                      borderBottom: '1px solid var(--border-subtle)',
                      transition: 'background-color 0.15s ease',
                    }}
                  >
                    <td style={{ padding: '14px 20px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <FileCheck size={18} color="var(--accent)" />
                        <div>
                          <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                            {doc.title || doc.filename}
                          </div>
                          <div
                            style={{
                              fontSize: '0.75rem',
                              color: 'var(--text-muted)',
                              fontFamily: 'var(--font-mono)',
                            }}
                          >
                            SHA: {doc.contentSha256.slice(0, 12)}...
                          </div>
                        </div>
                      </div>
                    </td>

                    <td style={{ padding: '14px 20px' }}>
                      {doc.status === 'ready' && (
                        <span className="badge badge-emerald">
                          <CheckCircle2 size={12} />
                          Ready
                        </span>
                      )}
                      {doc.status === 'processing' && (
                        <span className="badge badge-cyan animate-pulse">
                          <Loader2 size={12} className="animate-spin" />
                          Processing
                        </span>
                      )}
                      {doc.status === 'pending' && (
                        <span className="badge badge-amber">
                          <Clock size={12} />
                          Pending
                        </span>
                      )}
                      {doc.status === 'failed' && (
                        <span className="badge badge-rose" title={doc.error ?? 'Processing failed'}>
                          <AlertCircle size={12} />
                          Failed
                        </span>
                      )}
                    </td>

                    <td style={{ padding: '14px 20px' }}>
                      <span className="badge badge-neutral">v{doc.version}</span>
                    </td>

                    <td style={{ padding: '14px 20px', color: 'var(--text-secondary)' }}>
                      {formatBytes(doc.sizeBytes)}
                    </td>

                    <td
                      style={{
                        padding: '14px 20px',
                        color: 'var(--text-muted)',
                        fontSize: '0.8rem',
                      }}
                    >
                      {new Date(doc.createdAt).toLocaleDateString()}
                    </td>

                    <td style={{ padding: '14px 20px', textAlign: 'right' }}>
                      {canMutate ? (
                        <button
                          onClick={() => {
                            if (
                              window.confirm(
                                `Soft-delete document "${doc.title}" and purge chunks?`,
                              )
                            ) {
                              deleteMutation.mutate(doc.id);
                            }
                          }}
                          className="btn btn-ghost"
                          style={{ color: 'var(--rose)', padding: '6px' }}
                          title="Soft delete and purge chunks"
                          disabled={deleteMutation.isPending}
                        >
                          <Trash2 size={16} />
                        </button>
                      ) : (
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          Read-Only
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
