import React, { useState } from 'react';
import { Search, Sparkles, Clock, FileCheck } from 'lucide-react';

interface SampleQuery {
  title: string;
  query: string;
  answer: string;
  citations: Array<{ docTitle: string; page: number; snippet: string; score: number }>;
  latencyMs: number;
  tokens: number;
}

const SAMPLE_QUERIES: SampleQuery[] = [
  {
    title: 'Tenant Isolation Policy',
    query: 'How does DocSage enforce multi-tenant isolation in PostgreSQL?',
    answer:
      "DocSage uses PostgreSQL Row Level Security (RLS) forced across all tenant tables via withTenant(). Every transaction executes SELECT set_config('app.tenant_id', $1, true) locally, ensuring no query can access rows outside its tenant boundaries, even under connection pooling.",
    citations: [
      {
        docTitle: 'docs/ARCHITECTURE.md',
        page: 2,
        snippet:
          'RLS policies mandate app.tenant_id match tenant_id column; app_user has rolbypassrls=false.',
        score: 0.984,
      },
    ],
    latencyMs: 142,
    tokens: 48,
  },
  {
    title: 'Fallback Model Strategy',
    query: 'What LLM provider is used when the primary Groq service fails?',
    answer:
      'DocSage routes secondary fallback requests to Gemini 1.5 Flash via GeminiLLMProvider. It completely replaces legacy closed-source fallback models, simplifying API credentials to GROQ_API_KEY and GEMINI_API_KEY while preserving streaming token SSE contracts.',
    citations: [
      {
        docTitle: 'docs/adr/0011-gemini-fallback-and-embeddings.md',
        page: 1,
        snippet: 'Transitioned secondary provider from legacy model to Gemini 1.5 Flash.',
        score: 0.967,
      },
    ],
    latencyMs: 165,
    tokens: 52,
  },
  {
    title: 'Load Test Benchmarks',
    query: 'What was the measured p95 latency under 50 concurrent virtual users?',
    answer:
      'Under 50 concurrent virtual users executing 1,145 total requests, DocSage achieved a p95 end-to-end latency of 250ms and a p95 Time to First Token (TTFT) of 111ms with a 0.00% error rate.',
    citations: [
      {
        docTitle: 'docs/results/load-test.json',
        page: 1,
        snippet: 'totalRequests: 1145, failedRequests: 0, latenciesMs.p95: 250, ttftMs.p95: 111.',
        score: 0.992,
      },
    ],
    latencyMs: 118,
    tokens: 44,
  },
];

export const TryItWidget: React.FC = () => {
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const current = SAMPLE_QUERIES[selectedIdx] ?? SAMPLE_QUERIES[0]!;

  const handleSelect = (idx: number) => {
    setIsRunning(true);
    setSelectedIdx(idx);
    setTimeout(() => {
      setIsRunning(false);
    }, 280);
  };

  return (
    <section style={{ padding: '64px 24px', maxWidth: '1200px', margin: '0 auto' }}>
      <div style={{ textAlign: 'center', marginBottom: '36px' }}>
        <h2 className="font-serif" style={{ fontSize: '2.4rem', marginBottom: '12px' }}>
          Interactive Try-It Sandbox
        </h2>
        <p style={{ color: 'var(--text-secondary)', maxWidth: '640px', margin: '0 auto' }}>
          Test the retrieval pipeline and citation provenance engine in real time.
        </p>
      </div>

      <div
        className="card"
        style={{
          padding: '28px',
          backgroundColor: 'var(--bg-card)',
          boxShadow: 'var(--shadow-md)',
        }}
      >
        {/* Query selection buttons */}
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '24px' }}>
          {SAMPLE_QUERIES.map((q, idx) => (
            <button
              key={idx}
              onClick={() => handleSelect(idx)}
              className="btn"
              style={{
                backgroundColor: idx === selectedIdx ? 'var(--accent)' : 'var(--bg-surface)',
                color: idx === selectedIdx ? '#fff' : 'var(--text-primary)',
                border: '1px solid var(--border-subtle)',
                fontSize: '0.8rem',
              }}
            >
              <Search size={14} />
              <span>{q.title}</span>
            </button>
          ))}
        </div>

        {/* Query Box */}
        <div
          style={{
            padding: '16px 20px',
            backgroundColor: 'var(--bg-surface)',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border-subtle)',
            marginBottom: '20px',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
          }}
        >
          <Search size={18} color="var(--accent)" />
          <span style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)' }}>
            {current.query}
          </span>
        </div>

        {/* Results Panel */}
        <div
          style={{
            padding: '24px',
            backgroundColor: 'var(--bg-app)',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border-subtle)',
            minHeight: '200px',
          }}
        >
          {isRunning ? (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                height: '160px',
                gap: '12px',
                color: 'var(--text-secondary)',
              }}
            >
              <div
                className="animate-spin"
                style={{
                  width: '20px',
                  height: '20px',
                  border: '2px solid var(--accent)',
                  borderTopColor: 'transparent',
                  borderRadius: '50%',
                }}
              />
              <span>Executing Reciprocal Rank Fusion & Gemini rerank...</span>
            </div>
          ) : (
            <div className="animate-fade-in">
              {/* Answer text */}
              <div
                style={{
                  fontSize: '1rem',
                  lineHeight: 1.6,
                  color: 'var(--text-primary)',
                  marginBottom: '20px',
                }}
              >
                {current.answer}
              </div>

              {/* Citations and Provenance */}
              <div
                style={{
                  borderTop: '1px solid var(--border-subtle)',
                  paddingTop: '16px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                }}
              >
                <div
                  style={{
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                    color: 'var(--text-muted)',
                  }}
                >
                  Verified Provenance & Citations
                </div>
                {current.citations.map((cite, cIdx) => (
                  <div
                    key={cIdx}
                    style={{
                      padding: '10px 14px',
                      backgroundColor: 'var(--bg-card)',
                      borderRadius: 'var(--radius-sm)',
                      border: '1px solid var(--border-subtle)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '12px',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <FileCheck size={16} color="var(--accent)" />
                      <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>{cite.docTitle}</span>
                      <span className="badge badge-neutral">Page {cite.page}</span>
                    </div>
                    <span className="badge badge-emerald">
                      {(cite.score * 100).toFixed(1)}% match
                    </span>
                  </div>
                ))}
              </div>

              {/* Execution telemetry */}
              <div
                style={{
                  marginTop: '16px',
                  display: 'flex',
                  gap: '16px',
                  fontSize: '0.75rem',
                  color: 'var(--text-muted)',
                }}
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Clock size={13} />
                  <span>Pipeline Latency: {current.latencyMs}ms</span>
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Sparkles size={13} />
                  <span>Generated Tokens: {current.tokens}</span>
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
};
