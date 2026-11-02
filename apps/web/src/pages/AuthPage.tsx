import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.js';
import { Sparkles, Lock, Mail, Building, AlertCircle, ArrowRight } from 'lucide-react';
import { AuthInput } from '../components/AuthInput.js';

export const AuthPage: React.FC = () => {
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [tenantName, setTenantName] = useState('');
  const [error, setError] = useState<string | null>(null);

  const { login, register, isLoading } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    try {
      if (isRegister) {
        if (!tenantName.trim()) {
          setError('Organization or workspace name is required');
          return;
        }
        await register(email, password, tenantName);
      } else {
        await login(email, password);
      }
      void navigate('/chat');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Authentication failed';
      setError(msg);
    }
  };

  const handleDemoFill = (role: 'admin' | 'viewer') => {
    setError(null);
    if (role === 'admin') {
      setEmail('admin@enterprise.com');
      setPassword('AdminPassword123!');
      setTenantName('Acme Global');
    } else {
      setEmail('viewer@enterprise.com');
      setPassword('ViewerPassword123!');
      setTenantName('Acme Global');
    }
  };

  return (
    <div
      style={{
        display: 'flex',
        minHeight: '100vh',
        width: '100vw',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'var(--bg-app)',
        padding: '20px',
      }}
    >
      <div
        className="card animate-fade-in"
        style={{
          width: '100%',
          maxWidth: '440px',
          padding: '36px',
          boxShadow: 'var(--shadow-lg)',
        }}
      >
        {/* Brand Header */}
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <div
            style={{
              width: '48px',
              height: '48px',
              borderRadius: 'var(--radius-lg)',
              backgroundColor: 'var(--accent)',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#ffffff',
              marginBottom: '16px',
              boxShadow: 'var(--shadow-glow)',
            }}
          >
            <Sparkles size={24} />
          </div>
          <h1
            style={{
              fontSize: '1.5rem',
              fontWeight: 700,
              letterSpacing: '-0.02em',
              marginBottom: '6px',
            }}
          >
            {isRegister ? 'Create Workspace' : 'Welcome to DocSage'}
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
            {isRegister
              ? 'Deploy an isolated multi-tenant RAG knowledge base.'
              : 'Sign in to access your organization documents.'}
          </p>
        </div>

        {error && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '12px 14px',
              backgroundColor: 'var(--rose-bg)',
              color: 'var(--rose)',
              borderRadius: 'var(--radius-md)',
              fontSize: '0.875rem',
              marginBottom: '20px',
              border: '1px solid rgba(244, 63, 94, 0.2)',
            }}
          >
            <AlertCircle size={18} style={{ flexShrink: 0 }} />
            <span>{error}</span>
          </div>
        )}

        <form
          onSubmit={(e) => {
            void handleSubmit(e);
          }}
          style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}
        >
          {isRegister && (
            <AuthInput
              label="Organization / Workspace Name"
              icon={<Building size={16} />}
              type="text"
              placeholder="e.g. Acme Corporation"
              value={tenantName}
              onChange={(e) => setTenantName(e.target.value)}
              required
            />
          )}

          <AuthInput
            label="Corporate Email Address"
            icon={<Mail size={16} />}
            type="email"
            placeholder="colleague@enterprise.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />

          <AuthInput
            label="Password"
            icon={<Lock size={16} />}
            type="password"
            placeholder="••••••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
          />

          <button
            type="submit"
            className="btn btn-primary"
            disabled={isLoading}
            style={{ width: '100%', padding: '12px', marginTop: '8px' }}
          >
            {isLoading ? (
              <span>Authenticating...</span>
            ) : (
              <>
                <span>{isRegister ? 'Create Enterprise Workspace' : 'Sign In'}</span>
                <ArrowRight size={16} />
              </>
            )}
          </button>
        </form>

        {/* Mode Toggle */}
        <div style={{ textAlign: 'center', marginTop: '20px', fontSize: '0.875rem' }}>
          <span style={{ color: 'var(--text-muted)' }}>
            {isRegister
              ? 'Already have a workspace account?'
              : "Don't have an enterprise workspace?"}{' '}
          </span>
          <button
            type="button"
            onClick={() => {
              setIsRegister(!isRegister);
              setError(null);
            }}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--accent)',
              fontWeight: 600,
              cursor: 'pointer',
              textDecoration: 'underline',
              padding: 0,
            }}
          >
            {isRegister ? 'Sign In' : 'Register Workspace'}
          </button>
        </div>

        {/* Demo Fast-Fill Box */}
        <div
          style={{
            marginTop: '28px',
            paddingTop: '20px',
            borderTop: '1px solid var(--border-subtle)',
            textAlign: 'center',
          }}
        >
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '10px' }}>
            DEMO PRESET CREDENTIALS (CLICK TO PREFILL)
          </div>
          <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
            <button
              type="button"
              className="btn btn-secondary"
              style={{ fontSize: '0.75rem', padding: '6px 10px' }}
              onClick={() => handleDemoFill('admin')}
            >
              Prefill Demo Admin
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              style={{ fontSize: '0.75rem', padding: '6px 10px' }}
              onClick={() => handleDemoFill('viewer')}
            >
              Prefill Demo Viewer
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
