import React from 'react';
import type { Citation } from '@docsage/shared';
import { Sparkles, User, BookOpen, ThumbsUp, ThumbsDown, Zap, DollarSign } from 'lucide-react';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  citations?: Citation[] | undefined;
  metrics?:
    | {
        latencyMs?: number | undefined;
        ttftMs?: number | undefined;
        totalTokens?: number | undefined;
        estimatedCost?: number | undefined;
      }
    | undefined;
  feedbackSubmitted?: 1 | -1 | undefined;
}

export interface ChatMessageItemProps {
  message: ChatMessage;
  onOpenCitation: (cit: Citation) => void;
  onFeedback: (msgId: string, rating: 1 | -1) => void;
}

export const ChatMessageItem: React.FC<ChatMessageItemProps> = ({
  message,
  onOpenCitation,
  onFeedback,
}) => {
  const renderMessageContent = (text: string, citations?: Citation[]) => {
    if (!citations || citations.length === 0) return text;

    const parts = text.split(/(\[\d+\])/g);
    return parts.map((part, i) => {
      const match = part.match(/\[(\d+)\]/);
      if (match && match[1]) {
        const citationIdx = parseInt(match[1], 10) - 1;
        const cit = citations[citationIdx];
        if (cit) {
          return (
            <button
              key={i}
              onClick={() => onOpenCitation(cit)}
              className="badge badge-emerald"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '2px',
                cursor: 'pointer',
                margin: '0 3px',
                padding: '1px 6px',
                verticalAlign: 'baseline',
                border: 'none',
              }}
              title={`Source: ${cit.documentTitle} (p.${cit.page ?? 'N/A'})`}
            >
              <span>[{citationIdx + 1}]</span>
            </button>
          );
        }
      }
      return part;
    });
  };

  return (
    <div
      style={{
        display: 'flex',
        gap: '14px',
        alignItems: 'flex-start',
        maxWidth: message.role === 'user' ? '80%' : '100%',
        alignSelf: message.role === 'user' ? 'flex-end' : 'flex-start',
      }}
    >
      <div
        style={{
          width: '32px',
          height: '32px',
          borderRadius: 'var(--radius-full)',
          backgroundColor: message.role === 'user' ? 'var(--accent)' : 'var(--bg-surface)',
          border: `1px solid ${message.role === 'user' ? 'transparent' : 'var(--border-subtle)'}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          color: message.role === 'user' ? '#ffffff' : 'var(--accent)',
        }}
      >
        {message.role === 'user' ? <User size={16} /> : <Sparkles size={16} />}
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            backgroundColor: message.role === 'user' ? 'var(--accent)' : 'var(--bg-card)',
            border: message.role === 'user' ? 'none' : '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-lg)',
            padding: '14px 18px',
            fontSize: '0.9rem',
            lineHeight: '1.6',
            color: message.role === 'user' ? '#ffffff' : 'var(--text-primary)',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
          }}
        >
          {renderMessageContent(message.content, message.citations)}
        </div>

        {message.role === 'assistant' && message.content && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginTop: '8px',
              fontSize: '0.75rem',
              color: 'var(--text-muted)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              {message.metrics?.ttftMs && (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                  <Zap size={11} color="var(--accent)" /> TTFT: {message.metrics.ttftMs}ms
                </span>
              )}
              {message.metrics?.latencyMs && <span>Total: {message.metrics.latencyMs}ms</span>}
              {message.metrics?.estimatedCost !== undefined && (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '1px' }}>
                  <DollarSign size={11} color="var(--emerald)" />
                  {message.metrics.estimatedCost.toFixed(5)}
                </span>
              )}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              {message.citations && message.citations.length > 0 && (
                <button
                  onClick={() => {
                    if (message.citations?.[0]) onOpenCitation(message.citations[0]);
                  }}
                  className="btn btn-ghost"
                  style={{ padding: '3px 8px', fontSize: '0.75rem', color: 'var(--accent)' }}
                >
                  <BookOpen size={12} />
                  {message.citations.length} Sources
                </button>
              )}

              <button
                onClick={() => onFeedback(message.id, 1)}
                className="btn btn-ghost"
                style={{
                  padding: '3px 6px',
                  color: message.feedbackSubmitted === 1 ? 'var(--emerald)' : 'var(--text-muted)',
                }}
                title="Accurate citation"
              >
                <ThumbsUp size={12} />
              </button>
              <button
                onClick={() => onFeedback(message.id, -1)}
                className="btn btn-ghost"
                style={{
                  padding: '3px 6px',
                  color: message.feedbackSubmitted === -1 ? 'var(--rose)' : 'var(--text-muted)',
                }}
                title="Negative feedback"
              >
                <ThumbsDown size={12} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
