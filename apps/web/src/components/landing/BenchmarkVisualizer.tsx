import React, { useState } from 'react';
import { Activity } from 'lucide-react';
import { SectionHeader } from './SectionHeader.js';

interface MetricBar {
  label: string;
  lexical: number;
  dense: number;
  docsage: number;
  unit: string;
}

export const BenchmarkVisualizer: React.FC = () => {
  const [selectedMetric, setSelectedMetric] = useState<'recall' | 'mrr' | 'ndcg'>('recall');

  const metricsData: Record<'recall' | 'mrr' | 'ndcg', MetricBar> = {
    recall: {
      label: 'Recall@5 (Target retrieval completeness)',
      lexical: 51.6,
      dense: 100.0,
      docsage: 100.0,
      unit: '%',
    },
    mrr: {
      label: 'Mean Reciprocal Rank (Rank position accuracy)',
      lexical: 47.2,
      dense: 100.0,
      docsage: 96.8,
      unit: '%',
    },
    ndcg: {
      label: 'Normalized Discounted Cumulative Gain (nDCG@5)',
      lexical: 48.0,
      dense: 99.6,
      docsage: 98.5,
      unit: '%',
    },
  };

  const current = metricsData[selectedMetric];

  const bars = [
    { name: 'Lexical (PostgreSQL tsvector)', val: current.lexical, color: 'var(--amber)' },
    { name: 'Dense Semantic (Gemini 768-d HNSW)', val: current.dense, color: 'var(--cyan)' },
    { name: 'DocSage Hybrid + Gemini 1.5 Rerank', val: current.docsage, color: 'var(--accent)' },
  ];

  return (
    <section style={{ padding: '64px 24px', maxWidth: '1200px', margin: '0 auto' }}>
      <SectionHeader
        badgeIcon={<Activity size={13} />}
        badgeText="Production Benchmarks"
        title="Empirical Retrieval Visualizer"
        description="Visual performance comparison across lexical, dense, and hybrid reranked configurations."
      />

      <div className="card" style={{ padding: '32px', boxShadow: 'var(--shadow-md)' }}>
        {/* Metric toggles */}
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '28px' }}>
          <button
            onClick={() => setSelectedMetric('recall')}
            className="btn"
            style={{
              backgroundColor: selectedMetric === 'recall' ? 'var(--accent)' : 'var(--bg-surface)',
              color: selectedMetric === 'recall' ? '#fff' : 'var(--text-primary)',
              border: '1px solid var(--border-subtle)',
            }}
          >
            Recall@5
          </button>
          <button
            onClick={() => setSelectedMetric('mrr')}
            className="btn"
            style={{
              backgroundColor: selectedMetric === 'mrr' ? 'var(--accent)' : 'var(--bg-surface)',
              color: selectedMetric === 'mrr' ? '#fff' : 'var(--text-primary)',
              border: '1px solid var(--border-subtle)',
            }}
          >
            Mean Reciprocal Rank (MRR)
          </button>
          <button
            onClick={() => setSelectedMetric('ndcg')}
            className="btn"
            style={{
              backgroundColor: selectedMetric === 'ndcg' ? 'var(--accent)' : 'var(--bg-surface)',
              color: selectedMetric === 'ndcg' ? '#fff' : 'var(--text-primary)',
              border: '1px solid var(--border-subtle)',
            }}
          >
            nDCG@5 Score
          </button>
        </div>

        <div style={{ marginBottom: '24px' }}>
          <div style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)' }}>
            {current.label}
          </div>
        </div>

        {/* Visual Bars */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {bars.map((bar, idx) => (
            <div key={idx}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  marginBottom: '8px',
                  fontSize: '0.85rem',
                }}
              >
                <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{bar.name}</span>
                <span className="font-mono" style={{ fontWeight: 700, color: bar.color }}>
                  {bar.val.toFixed(1)}
                  {current.unit}
                </span>
              </div>
              <div
                style={{
                  height: '14px',
                  width: '100%',
                  backgroundColor: 'var(--bg-surface)',
                  borderRadius: 'var(--radius-full)',
                  overflow: 'hidden',
                  border: '1px solid var(--border-subtle)',
                }}
              >
                <div
                  style={{
                    height: '100%',
                    width: `${bar.val}%`,
                    backgroundColor: bar.color,
                    borderRadius: 'var(--radius-full)',
                    transition: 'width 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
                  }}
                />
              </div>
            </div>
          ))}
        </div>

        {/* Telemetry Footer */}
        <div
          style={{
            marginTop: '32px',
            paddingTop: '20px',
            borderTop: '1px solid var(--border-subtle)',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '16px',
          }}
        >
          <div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>P95 TTFT Latency</div>
            <div
              className="font-serif"
              style={{ fontSize: '1.4rem', color: 'var(--accent)', fontWeight: 700 }}
            >
              111ms
            </div>
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>System Throughput</div>
            <div
              className="font-serif"
              style={{ fontSize: '1.4rem', color: 'var(--accent)', fontWeight: 700 }}
            >
              218.6 req/s
            </div>
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              Load Test Error Rate
            </div>
            <div
              className="font-serif"
              style={{ fontSize: '1.4rem', color: 'var(--emerald)', fontWeight: 700 }}
            >
              0.00%
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
