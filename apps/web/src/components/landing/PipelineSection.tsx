import React, { useState } from 'react';
import { Layers, Search, Sparkles, ShieldCheck, CheckCircle2, type LucideIcon } from 'lucide-react';

interface Stage {
  id: number;
  title: string;
  tag: string;
  icon: LucideIcon;
  headline: string;
  description: string;
  specs: string[];
}

export const PipelineSection: React.FC = () => {
  const [activeStage, setActiveStage] = useState(0);

  const stages: Stage[] = [
    {
      id: 1,
      title: 'Ingestion & Chunking',
      tag: 'Stage 1',
      icon: Layers,
      headline: 'Deterministic Recursive Token Decomposition',
      description:
        'Uploads are securely parsed in-memory with Busboy streaming. Text is partitioned into 500-token chunks with 50-token semantic overlap, preserving heading provenance and chunk page offsets.',
      specs: [
        '500-token target chunk size',
        '50-token sliding overlap window',
        'Page-level provenance metadata',
        'In-memory streaming (zero disk residue)',
      ],
    },
    {
      id: 2,
      title: 'Dual-Vector Indexing',
      tag: 'Stage 2',
      icon: Search,
      headline: 'Hybrid Dense HNSW + Inverted Lexical Index',
      description:
        'Chunks are embedded using Gemini text-embedding-004 into 768-dimensional normalized vectors stored in PostgreSQL with pgvector HNSW indexing, alongside PostgreSQL tsvector full-text inverted indexes.',
      specs: [
        'Gemini text-embedding-004 (768-d)',
        'PostgreSQL pgvector with HNSW index (m=16, ef_construction=64)',
        'PostgreSQL tsvector lexical full-text index',
        'Sub-20ms vector similarity lookup',
      ],
    },
    {
      id: 3,
      title: 'Reciprocal Rank Fusion',
      tag: 'Stage 3',
      icon: Sparkles,
      headline: 'Score Normalization with Constant k=60',
      description:
        'Dense similarity and lexical BM25 ranks are fused via Reciprocal Rank Fusion: RRF(d) = Σ 1 / (60 + rank(d)). Overcoming vector semantic drift and lexical vocabulary mismatch simultaneously.',
      specs: [
        'k=60 constant fusion formula',
        'Overcomes out-of-vocabulary queries',
        'Zero score calibration overhead',
        'Top-k combined candidate pool',
      ],
    },
    {
      id: 4,
      title: 'Gemini Listwise Rerank',
      tag: 'Stage 4',
      icon: ShieldCheck,
      headline: 'Listwise Attention & Provenance Verification',
      description:
        'Candidate passages undergo high-order contextual reranking via Gemini 1.5 Flash. Citations are verified against source texts; ungrounded assertions are strictly pruned before client streaming.',
      specs: [
        'Gemini 1.5 Flash listwise evaluator',
        'Strict quotation & citation validation',
        '100% negative control abstention',
        'Zero legacy closed-source fallback dependency',
      ],
    },
  ];

  const current = stages[activeStage] ?? stages[0]!;

  return (
    <section
      id="architecture"
      style={{ padding: '64px 24px', maxWidth: '1200px', margin: '0 auto' }}
    >
      <div style={{ textAlign: 'center', marginBottom: '40px' }}>
        <h2 className="font-serif" style={{ fontSize: '2.4rem', marginBottom: '12px' }}>
          Four-Stage Hybrid RAG Architecture
        </h2>
        <p style={{ color: 'var(--text-secondary)', maxWidth: '640px', margin: '0 auto' }}>
          Designed for zero hallucination, sub-second latency, and mathematical retrieval rigor.
        </p>
      </div>

      {/* Stepper Tabs */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '12px',
          marginBottom: '28px',
        }}
      >
        {stages.map((stage, idx) => {
          const Icon = stage.icon;
          const isActive = idx === activeStage;
          return (
            <button
              key={stage.id}
              onClick={() => setActiveStage(idx)}
              className="card"
              style={{
                textAlign: 'left',
                cursor: 'pointer',
                borderColor: isActive ? 'var(--accent)' : 'var(--border-subtle)',
                backgroundColor: isActive ? 'var(--accent-light)' : 'var(--bg-card)',
                padding: '16px',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
              }}
            >
              <div
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: isActive ? 'var(--accent)' : 'var(--bg-surface)',
                  color: isActive ? '#fff' : 'var(--text-secondary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <Icon size={18} />
              </div>
              <div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                  {stage.tag}
                </div>
                <div style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                  {stage.title}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Detail Pane */}
      <div
        className="card"
        style={{
          padding: '36px',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          gap: '32px',
          alignItems: 'center',
        }}
      >
        <div>
          <div
            className="badge badge-emerald"
            style={{ marginBottom: '14px', alignSelf: 'flex-start' }}
          >
            {current.tag} Active
          </div>
          <h3 className="font-serif" style={{ fontSize: '1.8rem', marginBottom: '16px' }}>
            {current.headline}
          </h3>
          <p
            style={{
              color: 'var(--text-secondary)',
              fontSize: '1rem',
              lineHeight: 1.6,
              marginBottom: '20px',
            }}
          >
            {current.description}
          </p>
        </div>

        <div
          style={{
            backgroundColor: 'var(--bg-surface)',
            borderRadius: 'var(--radius-lg)',
            padding: '24px',
            border: '1px solid var(--border-subtle)',
          }}
        >
          <div
            style={{
              fontSize: '0.85rem',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
              marginBottom: '16px',
              color: 'var(--text-primary)',
            }}
          >
            Architectural Specifications
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {current.specs.map((spec, sIdx) => (
              <div key={sIdx} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                <CheckCircle2
                  size={16}
                  color="var(--accent)"
                  style={{ marginTop: '3px', flexShrink: 0 }}
                />
                <span style={{ fontSize: '0.875rem', color: 'var(--text-primary)' }}>{spec}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};
