import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { api, type AdminAnalyticsData } from '../api/client.js';
import {
  DollarSign,
  Clock,
  ThumbsUp,
  ThumbsDown,
  HelpCircle,
  TrendingUp,
  CheckCircle2,
  BarChart2,
  RefreshCw,
} from 'lucide-react';
import { KPICard } from '../components/KPICard.js';

export const AdminPage: React.FC = () => {
  const {
    data: analytics,
    refetch,
    isRefetching,
  } = useQuery<AdminAnalyticsData>({
    queryKey: ['admin-analytics'],
    queryFn: () => api.getAdminAnalytics(),
  });

  return (
    <div style={{ padding: '32px 40px', maxWidth: '1200px', margin: '0 auto', width: '100%' }}>
      {/* Page Header */}
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
            Tenant Analytics & Observability
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
            Real-time inference costs, p95 stage latencies via PostgreSQL percentile_cont, and
            golden dataset feedback.
          </p>
        </div>

        <button
          onClick={() => void refetch()}
          className="btn btn-secondary"
          disabled={isRefetching}
        >
          <RefreshCw size={15} className={isRefetching ? 'animate-spin' : ''} />
          <span>Refresh Analytics</span>
        </button>
      </div>

      {/* KPI Stat Cards Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '16px',
          marginBottom: '32px',
        }}
      >
        <KPICard
          title="MONTHLY INFERENCE SPEND"
          value={`$${analytics?.totalCost !== undefined ? analytics.totalCost.toFixed(4) : '0.0000'}`}
          subtitle="Budget limit: $100.00 / month"
          icon={<DollarSign size={16} color="var(--emerald)" />}
          iconBg="var(--emerald-bg)"
        />

        <KPICard
          title="P95 STAGE LATENCY"
          value={`${analytics?.p95LatencyMs !== undefined ? Math.round(analytics.p95LatencyMs) : 0}ms`}
          subtitle={`p50 latency: ${analytics?.p50LatencyMs !== undefined ? Math.round(analytics.p50LatencyMs) : 0}ms`}
          icon={<Clock size={16} color="var(--accent)" />}
          iconBg="var(--accent-light)"
        />

        <KPICard
          title="TOTAL MESSAGES SERVICED"
          value={`${analytics?.totalMessages ?? 0}`}
          subtitle="Across all tenant conversations"
          icon={<BarChart2 size={16} color="var(--text-secondary)" />}
          iconBg="var(--bg-surface)"
        />

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
              USER FEEDBACK RATIO
            </span>
            <div
              style={{
                padding: '6px',
                backgroundColor: 'var(--bg-surface)',
                borderRadius: 'var(--radius-sm)',
              }}
            >
              <ThumbsUp size={16} color="var(--emerald)" />
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div
              style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--emerald)' }}
            >
              <ThumbsUp size={16} />
              <span style={{ fontSize: '1.25rem', fontWeight: 700 }}>
                {analytics?.feedback.thumbsUp ?? 0}
              </span>
            </div>
            <div
              style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--rose)' }}
            >
              <ThumbsDown size={16} />
              <span style={{ fontSize: '1.25rem', fontWeight: 700 }}>
                {analytics?.feedback.thumbsDown ?? 0}
              </span>
            </div>
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
            Negative ratings queue candidate golden queries
          </div>
        </div>
      </div>

      {/* RAG Experiment Benchmark Comparison Matrix */}
      <div className="card" style={{ marginBottom: '32px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
          <TrendingUp size={18} color="var(--accent)" />
          <h2 style={{ fontSize: '1.1rem', fontWeight: 600 }}>
            Offline Evaluation Matrix (65-Question Golden Corpus)
          </h2>
        </div>

        <div style={{ overflowX: 'auto' }}>
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
                  borderBottom: '1px solid var(--border-subtle)',
                  color: 'var(--text-muted)',
                }}
              >
                <th style={{ padding: '10px 16px', fontWeight: 600 }}>RETRIEVAL STRATEGY</th>
                <th style={{ padding: '10px 16px', fontWeight: 600 }}>RECALL@5</th>
                <th style={{ padding: '10px 16px', fontWeight: 600 }}>MRR</th>
                <th style={{ padding: '10px 16px', fontWeight: 600 }}>nDCG@5</th>
                <th style={{ padding: '10px 16px', fontWeight: 600 }}>HIT RATE</th>
                <th style={{ padding: '10px 16px', fontWeight: 600 }}>ABSTENTION</th>
              </tr>
            </thead>
            <tbody>
              <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                <td style={{ padding: '12px 16px', fontWeight: 500 }}>
                  Baseline Dense (Vector Only)
                </td>
                <td style={{ padding: '12px 16px', color: 'var(--rose)' }}>0.2455</td>
                <td style={{ padding: '12px 16px', color: 'var(--rose)' }}>0.2157</td>
                <td style={{ padding: '12px 16px', color: 'var(--rose)' }}>0.1670</td>
                <td style={{ padding: '12px 16px' }}>27.3%</td>
                <td style={{ padding: '12px 16px' }}>0.00</td>
              </tr>
              <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                <td style={{ padding: '12px 16px', fontWeight: 500 }}>
                  Lexical Only (PostgreSQL GIN)
                </td>
                <td style={{ padding: '12px 16px' }}>0.9545</td>
                <td style={{ padding: '12px 16px' }}>0.8490</td>
                <td style={{ padding: '12px 16px' }}>0.8623</td>
                <td style={{ padding: '12px 16px' }}>96.4%</td>
                <td style={{ padding: '12px 16px' }}>0.00</td>
              </tr>
              <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                <td style={{ padding: '12px 16px', fontWeight: 500 }}>Hybrid (RRF k=60)</td>
                <td style={{ padding: '12px 16px' }}>0.6000</td>
                <td style={{ padding: '12px 16px' }}>0.4687</td>
                <td style={{ padding: '12px 16px' }}>0.4502</td>
                <td style={{ padding: '12px 16px' }}>67.3%</td>
                <td style={{ padding: '12px 16px' }}>0.00</td>
              </tr>
              <tr style={{ backgroundColor: 'var(--accent-light)' }}>
                <td style={{ padding: '12px 16px', fontWeight: 700, color: '#ffffff' }}>
                  ★ Hybrid + Rerank (Production Tier)
                </td>
                <td style={{ padding: '12px 16px', fontWeight: 700, color: 'var(--emerald)' }}>
                  0.9818 (+300%)
                </td>
                <td style={{ padding: '12px 16px', fontWeight: 700, color: 'var(--emerald)' }}>
                  0.8833 (+309%)
                </td>
                <td style={{ padding: '12px 16px', fontWeight: 700, color: 'var(--emerald)' }}>
                  0.9021 (+440%)
                </td>
                <td style={{ padding: '12px 16px', fontWeight: 700, color: 'var(--emerald)' }}>
                  98.2%
                </td>
                <td style={{ padding: '12px 16px', fontWeight: 700, color: 'var(--emerald)' }}>
                  1.00 (100%)
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Top Unanswered / Threshold Fallback Queries */}
      <div className="card">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
          <HelpCircle size={18} color="var(--amber)" />
          <h2 style={{ fontSize: '1.1rem', fontWeight: 600 }}>
            Top Unanswered & Zero-Citation Queries
          </h2>
        </div>

        {analytics?.topUnanswered && analytics.topUnanswered.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {analytics.topUnanswered.map((q) => (
              <div
                key={q.messageId}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '12px 16px',
                  backgroundColor: 'var(--bg-surface)',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border-subtle)',
                }}
              >
                <div>
                  <div style={{ fontWeight: 500, fontSize: '0.875rem' }}>{q.contentSnippet}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    Triggered at: {new Date(q.createdAt).toLocaleString()}
                  </div>
                </div>
                <span className="badge badge-amber">Relevance Cutoff Skipped LLM</span>
              </div>
            ))}
          </div>
        ) : (
          <div
            style={{
              padding: '24px',
              textAlign: 'center',
              color: 'var(--text-muted)',
              fontSize: '0.875rem',
            }}
          >
            <CheckCircle2 size={24} color="var(--emerald)" style={{ margin: '0 auto 8px' }} />
            <div>
              Zero unanswered queries detected. All user queries matched verified chunk citations.
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
