import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sparkles, Sun, Moon, ArrowRight, Github, Terminal, Check, Copy } from 'lucide-react';
import { useAuth } from '../context/AuthContext.js';
import { HeroSection } from '../components/landing/HeroSection.js';
import { PipelineSection } from '../components/landing/PipelineSection.js';
import { TryItWidget } from '../components/landing/TryItWidget.js';
import { ComparisonMatrix } from '../components/landing/ComparisonMatrix.js';
import { SecuritySection } from '../components/landing/SecuritySection.js';
import { BenchmarkVisualizer } from '../components/landing/BenchmarkVisualizer.js';

export const LandingPage: React.FC = () => {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const [copied, setCopied] = useState(false);
  const [isDark, setIsDark] = useState(() => document.documentElement.classList.contains('dark'));

  const toggleTheme = () => {
    const nextDark = !isDark;
    setIsDark(nextDark);
    if (nextDark) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('docsage-theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('docsage-theme', 'light');
    }
  };

  const copyQuickstart = () => {
    void navigator.clipboard.writeText(
      'git clone https://github.com/Arjun-coder-ops/AI-Document-Intelligence.git\ncd AI-Document-Intelligence\nnpm install\nnpm run dev',
    );
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      style={{ minHeight: '100vh', backgroundColor: 'var(--bg-app)', color: 'var(--text-primary)' }}
    >
      {/* Navigation Bar */}
      <header
        style={{
          borderBottom: '1px solid var(--border-subtle)',
          backgroundColor: 'var(--bg-app)',
          position: 'sticky',
          top: 0,
          zIndex: 40,
          backdropFilter: 'blur(8px)',
        }}
      >
        <div
          style={{
            maxWidth: '1200px',
            margin: '0 auto',
            padding: '16px 24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          {/* Brand */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '34px',
                height: '34px',
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'var(--accent)',
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: 'var(--shadow-sm)',
              }}
            >
              <Sparkles size={18} />
            </div>
            <div>
              <span
                className="font-serif"
                style={{ fontSize: '1.2rem', fontWeight: 700, letterSpacing: '-0.02em' }}
              >
                DocSage
              </span>
              <span
                style={{
                  fontSize: '0.72rem',
                  color: 'var(--text-muted)',
                  marginLeft: '8px',
                  borderLeft: '1px solid var(--border-subtle)',
                  paddingLeft: '8px',
                }}
              >
                The Reading Room
              </span>
            </div>
          </div>

          {/* Action Links */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button
              onClick={toggleTheme}
              aria-label="Toggle color theme"
              className="btn btn-ghost"
              style={{ padding: '8px', borderRadius: 'var(--radius-sm)' }}
            >
              {isDark ? <Sun size={18} /> : <Moon size={18} />}
            </button>

            <a
              href="https://github.com/Arjun-coder-ops/AI-Document-Intelligence"
              target="_blank"
              rel="noreferrer"
              className="btn btn-ghost"
              style={{ padding: '8px 12px', gap: '6px' }}
            >
              <Github size={16} />
              <span>GitHub</span>
            </a>

            <button
              onClick={() => {
                void navigate(isAuthenticated ? '/chat' : '/auth');
              }}
              className="btn btn-primary"
              style={{ padding: '8px 18px', fontWeight: 600 }}
            >
              <span>{isAuthenticated ? 'Enter Workspace' : 'Sign In'}</span>
              <ArrowRight size={16} />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Sections */}
      <main>
        <HeroSection />
        <PipelineSection />
        <TryItWidget />
        <ComparisonMatrix />
        <SecuritySection />
        <BenchmarkVisualizer />

        {/* Quickstart / CTA Section */}
        <section
          style={{
            padding: '72px 24px',
            backgroundColor: 'var(--bg-surface)',
            borderTop: '1px solid var(--border-subtle)',
          }}
        >
          <div style={{ maxWidth: '840px', margin: '0 auto', textAlign: 'center' }}>
            <h2 className="font-serif" style={{ fontSize: '2.5rem', marginBottom: '14px' }}>
              Begin Archival Research with DocSage
            </h2>
            <p
              style={{
                color: 'var(--text-secondary)',
                fontSize: '1.05rem',
                lineHeight: 1.6,
                marginBottom: '32px',
              }}
            >
              Multi-tenant architecture, sub-second vector search, and verifiable citations.
            </p>

            {/* Quickstart Code Block */}
            <div
              className="card"
              style={{
                textAlign: 'left',
                padding: '20px',
                marginBottom: '32px',
                backgroundColor: 'var(--bg-card)',
                boxShadow: 'var(--shadow-sm)',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '10px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Terminal size={16} color="var(--accent)" />
                  <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                    Local Quickstart
                  </span>
                </div>
                <button
                  onClick={copyQuickstart}
                  className="btn btn-ghost"
                  style={{ padding: '4px 8px', fontSize: '0.75rem', gap: '4px' }}
                >
                  {copied ? <Check size={13} color="var(--emerald)" /> : <Copy size={13} />}
                  <span>{copied ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
              <pre
                className="font-mono"
                style={{
                  fontSize: '0.85rem',
                  lineHeight: 1.5,
                  color: 'var(--text-primary)',
                  margin: 0,
                  overflowX: 'auto',
                }}
              >
                git clone https://github.com/Arjun-coder-ops/AI-Document-Intelligence.git{'\n'}
                cd AI-Document-Intelligence && npm install && npm run dev
              </pre>
            </div>

            <button
              onClick={() => {
                void navigate(isAuthenticated ? '/chat' : '/auth');
              }}
              className="btn btn-primary"
              style={{ padding: '14px 32px', fontSize: '1.05rem', fontWeight: 600 }}
            >
              <span>{isAuthenticated ? 'Open Document Studio' : 'Get Started Now'}</span>
              <ArrowRight size={18} />
            </button>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer
        style={{
          borderTop: '1px solid var(--border-subtle)',
          padding: '32px 24px',
          textAlign: 'center',
          fontSize: '0.8rem',
          color: 'var(--text-muted)',
        }}
      >
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          DocSage Rebuild v2.0 • The Reading Room Editorial Design System • Neon Postgres + pgvector
          + Groq + Gemini 1.5 Flash
        </div>
      </footer>
    </div>
  );
};
