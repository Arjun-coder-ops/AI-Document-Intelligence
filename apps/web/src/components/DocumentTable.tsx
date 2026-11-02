import React from 'react';
import type { DocumentRecord } from '../api/client.js';
import { FileCheck, CheckCircle2, Loader2, Clock, AlertCircle, Trash2 } from 'lucide-react';

function formatBytes(bytes: number, decimals = 1): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

export interface DocumentTableProps {
  documents: DocumentRecord[];
  canMutate: boolean;
  isDeleting: boolean;
  onDelete: (id: string, title: string) => void;
}

export const DocumentTable: React.FC<DocumentTableProps> = ({
  documents,
  canMutate,
  isDeleting,
  onDelete,
}) => {
  return (
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
            <th style={{ padding: '12px 20px', fontWeight: 600, textAlign: 'right' }}>ACTIONS</th>
          </tr>
        </thead>
        <tbody>
          {documents.map((doc) => (
            <tr key={doc.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
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
                  <span className="badge badge-rose" title={doc.error ?? 'Failed'}>
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
                      if (window.confirm(`Soft-delete document "${doc.title}" and purge chunks?`)) {
                        onDelete(doc.id, doc.title);
                      }
                    }}
                    className="btn btn-ghost"
                    style={{ color: 'var(--rose)', padding: '6px' }}
                    title="Soft delete and purge chunks"
                    disabled={isDeleting}
                  >
                    <Trash2 size={16} />
                  </button>
                ) : (
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Read-Only</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
