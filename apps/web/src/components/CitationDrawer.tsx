import React from 'react';
import type { Citation } from '@docsage/shared';
import { BookOpen, X } from 'lucide-react';

export interface CitationDrawerProps {
  open: boolean;
  citations: Citation[];
  selectedCitation: Citation | null;
  onSelectCitation: (cit: Citation) => void;
  onClose: () => void;
}

export const CitationDrawer: React.FC<CitationDrawerProps> = ({
  open,
  citations,
  selectedCitation,
  onSelectCitation,
  onClose,
}) => {
  if (!open) return null;

  return (
    <aside
      className="animate-fade-in"
      style={{
        width: '380px',
        borderLeft: '1px solid var(--border-subtle)',
        backgroundColor: 'var(--bg-sidebar)',
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        flexShrink: 0,
      }}
      aria-label="Citations and Evidence"
    >
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
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontWeight: 600,
            fontSize: '0.9rem',
          }}
        >
          <BookOpen size={16} color="var(--accent)" />
          <span>Verified Evidence ({citations.length})</span>
        </div>
        <button
          onClick={onClose}
          className="btn btn-ghost"
          style={{ padding: '4px' }}
          aria-label="Close citations drawer"
        >
          <X size={16} />
        </button>
      </div>

      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '14px',
        }}
      >
        {citations.map((cit, idx) => {
          const isSelected = selectedCitation?.chunkId === cit.chunkId;
          return (
            <div
              key={cit.chunkId}
              onClick={() => onSelectCitation(cit)}
              style={{
                backgroundColor: isSelected ? 'var(--bg-surface)' : 'var(--bg-card)',
                border: `1px solid ${isSelected ? 'var(--accent)' : 'var(--border-subtle)'}`,
                borderRadius: 'var(--radius-md)',
                padding: '14px',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: '8px',
                }}
              >
                <span className="badge badge-emerald" style={{ fontSize: '0.7rem' }}>
                  [{idx + 1}] Score {(cit.relevanceScore * 100).toFixed(0)}%
                </span>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  Page {cit.page ?? 'N/A'}
                </span>
              </div>

              <div
                style={{
                  fontWeight: 600,
                  fontSize: '0.85rem',
                  marginBottom: '6px',
                  color: 'var(--text-primary)',
                }}
              >
                {cit.documentTitle}
              </div>

              <p
                style={{
                  fontSize: '0.8rem',
                  color: 'var(--text-secondary)',
                  lineHeight: '1.5',
                  backgroundColor: 'var(--bg-input)',
                  padding: '8px 10px',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border-subtle)',
                  fontStyle: 'italic',
                }}
              >
                "{cit.snippet}"
              </p>
            </div>
          );
        })}
      </div>
    </aside>
  );
};
