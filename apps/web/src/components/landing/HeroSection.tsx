import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Sparkles } from 'lucide-react';
import { useAuth } from '../../context/AuthContext.js';

export const HeroSection: React.FC = () => {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();

  const handleCta = () => {
    void navigate(isAuthenticated ? '/chat' : '/auth');
  };

  const tickerMetrics = [
    { label: 'Recall@5', value: '1.000', note: '100% on golden set' },
    { label: 'MRR', value: '0.968', note: 'Reciprocal rank' },
    { label: 'Abstention', value: '1.000', note: 'Zero hallucination' },
    { label: 'P95 TTFT', value: '111ms', note: '50 concurrent VUs' },
    { label: 'Error Rate', value: '0.00%', note: '1,145 load test reqs' },
  ];

  return (
    <section
      style={{
        padding: '64px 24px 48px',
        maxWidth: '1200px',
        margin: '0 auto',
        textAlign: 'center',
      }}
    >
      {/* Badge */}
      <div
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '8px',
          padding: '6px 14px',
          borderRadius: 'var(--radius-full)',
          backgroundColor: 'var(--accent-light)',
          border: '1px solid var(--accent)',
          color: 'var(--accent)',
          fontSize: '0.8rem',
          fontWeight: 600,
          marginBottom: '24px',
        }}
      >
        <Sparkles size={14} />
        <span>DocSage v2: The Reading Room Design System</span>
      </div>

      {/* Main Title */}
      <h1
        className="font-serif"
        style={{
          fontSize: 'clamp(2.5rem, 5vw, 4.2rem)',
          lineHeight: 1.15,
          color: 'var(--text-primary)',
          maxWidth: '960px',
          margin: '0 auto 20px',
        }}
      >
        Intelligence Grounded in <span style={{ color: 'var(--accent)' }}>Archival Authority</span>.
      </h1>

      {/* Subtitle */}
      <p
        style={{
          fontSize: '1.15rem',
          color: 'var(--text-secondary)',
          maxWidth: '680px',
          margin: '0 auto 32px',
          lineHeight: 1.6,
        }}
      >
        Search and synthesize complex documents with verified page citations and zero hallucination.
      </p>

      {/* CTA Buttons */}
      <div
        style={{
          display: 'flex',
          gap: '16px',
          justifyContent: 'center',
          alignItems: 'center',
          flexWrap: 'wrap',
          marginBottom: '56px',
        }}
      >
        <button
          onClick={handleCta}
          className="btn btn-primary"
          style={{ padding: '12px 28px', fontSize: '1rem', fontWeight: 600 }}
        >
          <span>{isAuthenticated ? 'Open Workspace' : 'Get Started Free'}</span>
          <ArrowRight size={18} />
        </button>
        <a
          href="#architecture"
          className="btn btn-secondary"
          style={{ padding: '12px 24px', fontSize: '1rem' }}
        >
          <span>Explore Pipeline</span>
        </a>
      </div>

      {/* Live Verified Stats Ticker */}
      <div
        className="card"
        style={{
          maxWidth: '1040px',
          margin: '0 auto',
          padding: '18px 24px',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
          gap: '16px',
          textAlign: 'left',
          boxShadow: 'var(--shadow-md)',
        }}
      >
        {tickerMetrics.map((item, idx) => (
          <div
            key={idx}
            style={{
              borderRight:
                idx < tickerMetrics.length - 1 ? '1px solid var(--border-subtle)' : 'none',
              paddingRight: '12px',
            }}
          >
            <div
              style={{
                fontSize: '0.75rem',
                color: 'var(--text-muted)',
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
              }}
            >
              {item.label}
            </div>
            <div
              className="font-serif"
              style={{
                fontSize: '1.75rem',
                fontWeight: 700,
                color: 'var(--accent)',
                lineHeight: 1.2,
                marginTop: '4px',
              }}
            >
              {item.value}
            </div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>{item.note}</div>
          </div>
        ))}
      </div>
    </section>
  );
};
