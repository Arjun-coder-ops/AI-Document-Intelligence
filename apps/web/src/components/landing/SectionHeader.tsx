import React from 'react';

export interface SectionHeaderProps {
  badgeIcon: React.ReactNode;
  badgeText: string;
  title: string;
  description: string;
  badgeClass?: string;
}

export function SectionHeader({
  badgeIcon,
  badgeText,
  title,
  description,
  badgeClass = 'badge badge-emerald',
}: SectionHeaderProps): React.JSX.Element {
  return (
    <div style={{ textAlign: 'center', marginBottom: '36px' }}>
      <div className={badgeClass} style={{ marginBottom: '12px', display: 'inline-flex' }}>
        {badgeIcon}
        <span>{badgeText}</span>
      </div>
      <h2 className="font-serif" style={{ fontSize: '2.4rem', marginBottom: '12px' }}>
        {title}
      </h2>
      <p style={{ color: 'var(--text-secondary)', maxWidth: '640px', margin: '0 auto' }}>
        {description}
      </p>
    </div>
  );
}
