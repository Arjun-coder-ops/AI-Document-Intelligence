import React from 'react';
import { RefreshCw } from 'lucide-react';

export interface PageHeaderProps {
  title: string;
  description: string;
  buttonText: string;
  onRefresh: () => void;
  isRefetching: boolean;
}

export function PageHeader({
  title,
  description,
  buttonText,
  onRefresh,
  isRefetching,
}: PageHeaderProps): React.JSX.Element {
  return (
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
          {title}
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>{description}</p>
      </div>

      <button onClick={onRefresh} className="btn btn-secondary" disabled={isRefetching}>
        <RefreshCw size={15} className={isRefetching ? 'animate-spin' : ''} />
        <span>{buttonText}</span>
      </button>
    </div>
  );
}
