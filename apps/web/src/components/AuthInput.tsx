import React from 'react';

export interface AuthInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  icon: React.ReactNode;
}

export const AuthInput: React.FC<AuthInputProps> = ({ label, icon, ...props }) => {
  return (
    <div>
      <label
        style={{
          display: 'block',
          fontSize: '0.8rem',
          fontWeight: 500,
          color: 'var(--text-secondary)',
          marginBottom: '6px',
        }}
      >
        {label}
      </label>
      <div style={{ position: 'relative' }}>
        <div
          style={{
            position: 'absolute',
            left: '12px',
            top: '13px',
            color: 'var(--text-muted)',
            display: 'flex',
            alignItems: 'center',
          }}
        >
          {icon}
        </div>
        <input className="input" style={{ paddingLeft: '38px', width: '100%' }} {...props} />
      </div>
    </div>
  );
};
