import React from 'react';

export interface KPICardProps {
  title: string;
  value: string;
  subtitle: string;
  icon: React.ReactNode;
  iconBg?: string;
}

export const KPICard: React.FC<KPICardProps> = ({
  title,
  value,
  subtitle,
  icon,
  iconBg = 'var(--emerald-bg)',
}) => {
  return (
    <div className="card">
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '12px',
        }}
      >
        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>
          {title}
        </span>
        <div
          style={{
            padding: '6px',
            backgroundColor: iconBg,
            borderRadius: 'var(--radius-sm)',
          }}
        >
          {icon}
        </div>
      </div>
      <div style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--text-primary)' }}>
        {value}
      </div>
      <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
        {subtitle}
      </div>
    </div>
  );
};
