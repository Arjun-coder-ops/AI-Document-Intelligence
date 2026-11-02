import React from 'react';
import { UploadCloud, Loader2 } from 'lucide-react';

export interface UploadDropzoneProps {
  canMutate: boolean;
  isUploading: boolean;
  dragActive: boolean;
  fileInputRef: React.RefObject<HTMLInputElement>;
  onDragEnter: (e: React.DragEvent) => void;
  onDragLeave: (e: React.DragEvent) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
  onFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export const UploadDropzone: React.FC<UploadDropzoneProps> = ({
  canMutate,
  isUploading,
  dragActive,
  fileInputRef,
  onDragEnter,
  onDragLeave,
  onDragOver,
  onDrop,
  onFileSelect,
}) => {
  return (
    <div
      onDragEnter={onDragEnter}
      onDragLeave={onDragLeave}
      onDragOver={onDragOver}
      onDrop={onDrop}
      style={{
        border: `2px dashed ${dragActive ? 'var(--accent)' : 'var(--border-subtle)'}`,
        backgroundColor: dragActive ? 'var(--accent-light)' : 'var(--bg-surface)',
        borderRadius: 'var(--radius-lg)',
        padding: '36px 24px',
        textAlign: 'center',
        marginBottom: '28px',
        transition: 'all 0.2s ease',
        cursor: canMutate ? 'pointer' : 'not-allowed',
      }}
      onClick={() => {
        if (canMutate && !isUploading) fileInputRef.current?.click();
      }}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,application/pdf"
        style={{ display: 'none' }}
        onChange={onFileSelect}
        disabled={!canMutate || isUploading}
      />

      <div
        style={{
          width: '48px',
          height: '48px',
          borderRadius: 'var(--radius-full)',
          backgroundColor: 'var(--bg-app)',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: '12px',
          color: 'var(--accent)',
        }}
      >
        {isUploading ? <Loader2 size={24} className="animate-spin" /> : <UploadCloud size={24} />}
      </div>

      <div style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '4px' }}>
        {isUploading ? 'Streaming & Parsing PDF Magic Bytes...' : 'Upload PDF Document'}
      </div>

      <p
        style={{
          color: 'var(--text-muted)',
          fontSize: '0.85rem',
          maxWidth: '440px',
          margin: '0 auto 12px',
        }}
      >
        {canMutate
          ? 'Drag and drop your PDF file here, or click to browse. Max size: 20MB. Automatic deduplication via SHA-256.'
          : 'Your role has read-only access. Editor or Admin role required to upload documents.'}
      </p>

      {canMutate && (
        <button
          type="button"
          className="btn btn-primary"
          style={{ padding: '8px 16px', fontSize: '0.85rem' }}
          disabled={isUploading}
          onClick={(e) => {
            e.stopPropagation();
            fileInputRef.current?.click();
          }}
        >
          <span>Select Document</span>
        </button>
      )}
    </div>
  );
};
