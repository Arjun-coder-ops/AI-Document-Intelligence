import React from 'react';
import { BarChart3, CheckCircle2 } from 'lucide-react';

interface MethodMetrics {
  name: string;
  badge: string;
  badgeClass: string;
  recallAt1: string;
  recallAt3: string;
  recallAt5: string;
  mrr: string;
  ndcgAt5: string;
  abstention: string;
  highlight?: boolean;
}

export const ComparisonMatrix: React.FC = () => {
  const methods: MethodMetrics[] = [
    {
      name: 'Lexical Only (BM25)',
      badge: 'Baseline',
      badgeClass: 'badge-amber',
      recallAt1: '0.4032',
      recallAt3: '0.4758',
      recallAt5: '0.5161',
      mrr: '0.4723',
      ndcgAt5: '0.4798',
      abstention: '1.0000',
    },
    {
      name: 'Dense Vector Only (HNSW)',
      badge: 'Semantic',
      badgeClass: 'badge-cyan',
      recallAt1: '0.9113',
      recallAt3: '0.9839',
      recallAt5: '1.0000',
      mrr: '1.0000',
      ndcgAt5: '0.9960',
      abstention: '1.0000',
    },
    {
      name: 'DocSage Hybrid + Gemini Rerank',
      badge: 'Production Engine',
      badgeClass: 'badge-emerald',
      recallAt1: '0.9113',
      recallAt3: '0.9839',
      recallAt5: '1.0000',
      mrr: '0.9677',
      ndcgAt5: '0.9846',
      abstention: '1.0000',
      highlight: true,
    },
  ];

  return (
    <section style={{ padding: '64px 24px', maxWidth: '1200px', margin: '0 auto' }}>
      <div style={{ textAlign: 'center', marginBottom: '36px' }}>
        <div
          className="badge badge-emerald"
          style={{ marginBottom: '12px', display: 'inline-flex' }}
        >
          <BarChart3 size={13} />
          <span>Empirical Evaluation Results</span>
        </div>
        <h2 className="font-serif" style={{ fontSize: '2.4rem', marginBottom: '12px' }}>
          Retrieval Comparison Matrix
        </h2>
        <p style={{ color: 'var(--text-secondary)', maxWidth: '640px', margin: '0 auto' }}>
          Exact empirical metrics verified on golden dataset
          (docs/results/retrieval-comparison.json) with 1,000 bootstrap iterations.
        </p>
      </div>

      <div
        className="card"
        style={{ padding: '0', overflowX: 'auto', boxShadow: 'var(--shadow-md)' }}
      >
        <table
          style={{
            width: '100%',
            borderCollapse: 'collapse',
            textAlign: 'left',
            fontSize: '0.875rem',
          }}
        >
          <thead>
            <tr
              style={{
                backgroundColor: 'var(--bg-surface)',
                borderBottom: '1px solid var(--border-subtle)',
              }}
            >
              <th style={{ padding: '16px 20px', fontWeight: 600 }}>Retrieval Strategy</th>
              <th style={{ padding: '16px 20px', fontWeight: 600 }}>Recall@1</th>
              <th style={{ padding: '16px 20px', fontWeight: 600 }}>Recall@3</th>
              <th style={{ padding: '16px 20px', fontWeight: 600 }}>Recall@5</th>
              <th style={{ padding: '16px 20px', fontWeight: 600 }}>MRR</th>
              <th style={{ padding: '16px 20px', fontWeight: 600 }}>nDCG@5</th>
              <th style={{ padding: '16px 20px', fontWeight: 600 }}>Abstention</th>
            </tr>
          </thead>
          <tbody>
            {methods.map((method, idx) => (
              <tr
                key={idx}
                style={{
                  borderBottom:
                    idx < methods.length - 1 ? '1px solid var(--border-subtle)' : 'none',
                  backgroundColor: method.highlight ? 'var(--accent-light)' : 'transparent',
                }}
              >
                <td style={{ padding: '16px 20px' }}>
                  <div
                    style={{
                      fontWeight: method.highlight ? 700 : 500,
                      color: 'var(--text-primary)',
                    }}
                  >
                    {method.name}
                  </div>
                  <span className={`badge ${method.badgeClass}`} style={{ marginTop: '4px' }}>
                    {method.badge}
                  </span>
                </td>
                <td className="font-mono" style={{ padding: '16px 20px' }}>
                  {method.recallAt1}
                </td>
                <td className="font-mono" style={{ padding: '16px 20px' }}>
                  {method.recallAt3}
                </td>
                <td
                  className="font-mono"
                  style={{
                    padding: '16px 20px',
                    fontWeight: 700,
                    color: method.highlight ? 'var(--accent)' : 'inherit',
                  }}
                >
                  {method.recallAt5}
                </td>
                <td className="font-mono" style={{ padding: '16px 20px' }}>
                  {method.mrr}
                </td>
                <td className="font-mono" style={{ padding: '16px 20px' }}>
                  {method.ndcgAt5}
                </td>
                <td style={{ padding: '16px 20px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <CheckCircle2 size={16} color="var(--accent)" />
                    <span className="font-mono" style={{ fontWeight: 600 }}>
                      {method.abstention}
                    </span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div
        style={{
          marginTop: '16px',
          fontSize: '0.75rem',
          color: 'var(--text-muted)',
          textAlign: 'right',
        }}
      >
        Source: docs/results/retrieval-comparison.json — Verified via evals/src/runner.ts
      </div>
    </section>
  );
};
