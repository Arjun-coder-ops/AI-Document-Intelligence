import React, { useState, useRef, useEffect } from 'react';
import { api } from '../api/client.js';
import type { Citation, SSEEventDone } from '@docsage/shared';
import {
  Send,
  Square,
  Sparkles,
  User,
  ThumbsUp,
  ThumbsDown,
  BookOpen,
  X,
  Zap,
  DollarSign,
} from 'lucide-react';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  citations?: Citation[] | undefined;
  metrics?: {
    latencyMs?: number | undefined;
    ttftMs?: number | undefined;
    totalTokens?: number | undefined;
    estimatedCost?: number | undefined;
  } | undefined;
  feedbackSubmitted?: 1 | -1 | undefined;
}

export const ChatPage: React.FC = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome-1',
      role: 'assistant',
      content:
        'Hello! I am DocSage, your enterprise document intelligence assistant. Ask me anything grounded in your uploaded documents, and I will synthesize verified answers with citation markers [1].',
    },
  ]);

  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [selectedCitation, setSelectedCitation] = useState<Citation | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [currentCitations, setCurrentCitations] = useState<Citation[]>([]);

  const abortControllerRef = useRef<AbortController | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isStreaming]);

  const handleSend = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const query = input.trim();
    if (!query || isStreaming) return;

    setInput('');
    const userMsgId = `user-${Date.now()}`;
    const assistantMsgId = `asst-${Date.now()}`;

    setMessages((prev) => [
      ...prev,
      { id: userMsgId, role: 'user', content: query },
      { id: assistantMsgId, role: 'assistant', content: '', citations: [] },
    ]);

    setIsStreaming(true);
    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      await api.streamChat(
        query,
        undefined,
        {
          onToken: (tok) => {
            setMessages((prev) =>
              prev.map((m) => (m.id === assistantMsgId ? { ...m, content: m.content + tok } : m)),
            );
          },
          onCitations: (cits) => {
            setCurrentCitations(cits);
            setMessages((prev) =>
              prev.map((m) => (m.id === assistantMsgId ? { ...m, citations: cits } : m)),
            );
          },
          onError: (err) => {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantMsgId
                  ? { ...m, content: m.content + `\n\n⚠️ Stream Error: ${err.message}` }
                  : m,
              ),
            );
          },
          onDone: (done: SSEEventDone) => {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantMsgId
                  ? {
                      ...m,
                      metrics: {
                        latencyMs: done.latencyMs,
                        ttftMs: done.ttftMs,
                        totalTokens: done.totalTokens,
                        estimatedCost: done.estimatedCost,
                      },
                    }
                  : m,
              ),
            );
          },
        },
        controller.signal,
      );
    } catch (err: unknown) {
      if ((err as Error).name !== 'AbortError') {
        const msg = err instanceof Error ? err.message : 'Chat error';
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantMsgId
              ? { ...m, content: m.content || `⚠️ Service Error: ${msg}` }
              : m,
          ),
        );
      }
    } finally {
      setIsStreaming(false);
      abortControllerRef.current = null;
    }
  };

  const handleStop = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setIsStreaming(false);
    }
  };

  const handleFeedback = async (msgId: string, rating: 1 | -1) => {
    try {
      // Mock UUID for feedback payload if msgId is local
      const mockUuid = '550e8400-e29b-41d4-a716-446655440001';
      await api.submitFeedback(mockUuid, rating);
      setMessages((prev) =>
        prev.map((m) => (m.id === msgId ? { ...m, feedbackSubmitted: rating } : m)),
      );
    } catch {
      // Ignore feedback error
    }
  };

  const openCitationDrawer = (citation: Citation) => {
    setSelectedCitation(citation);
    setDrawerOpen(true);
  };

  // Helper to render inline citation tags [1], [2] as clickable chips
  const renderMessageContent = (content: string, citations?: Citation[]) => {
    if (!citations || citations.length === 0) {
      return content;
    }

    const parts = content.split(/(\[\d+\])/g);
    return parts.map((part, index) => {
      const match = part.match(/\[(\d+)\]/);
      if (match && match[1]) {
        const citationIdx = parseInt(match[1], 10) - 1;
        const cit = citations[citationIdx];
        if (cit) {
          return (
            <button
              key={index}
              onClick={() => openCitationDrawer(cit)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '2px',
                padding: '1px 5px',
                margin: '0 2px',
                fontSize: '0.75rem',
                fontWeight: 600,
                color: 'var(--accent)',
                backgroundColor: 'var(--accent-light)',
                border: '1px solid rgba(99, 102, 241, 0.3)',
                borderRadius: 'var(--radius-sm)',
                cursor: 'pointer',
                verticalAlign: 'baseline',
              }}
              title={`Source: ${cit.documentTitle} (Page ${cit.page ?? 'N/A'})`}
            >
              [{match[1]}]
            </button>
          );
        }
      }
      return part;
    });
  };

  return (
    <div style={{ display: 'flex', height: '100%', position: 'relative', overflow: 'hidden' }}>
      {/* Center Chat Timeline */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
        {/* Timeline Header */}
        <div
          style={{
            padding: '14px 24px',
            borderBottom: '1px solid var(--border-subtle)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: 'var(--bg-app)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Sparkles size={16} color="var(--accent)" />
            <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>Enterprise RAG Assistant</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            <span className="badge badge-emerald">Hybrid + Rerank</span>
            <span className="badge badge-neutral">Groq Llama 3.3 70B</span>
          </div>
        </div>

        {/* Message Stream Scroll Area */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {messages.map((msg) => (
            <div
              key={msg.id}
              className="animate-fade-in"
              style={{
                display: 'flex',
                gap: '14px',
                alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
                maxWidth: msg.role === 'user' ? '70%' : '85%',
              }}
            >
              {/* Avatar Icon */}
              <div
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: msg.role === 'user' ? 'var(--accent)' : 'var(--bg-surface)',
                  border: '1px solid var(--border-subtle)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  color: '#ffffff',
                }}
              >
                {msg.role === 'user' ? <User size={16} /> : <Sparkles size={16} color="var(--accent)" />}
              </div>

              {/* Message Bubble */}
              <div style={{ flex: 1 }}>
                <div
                  style={{
                    backgroundColor: msg.role === 'user' ? 'var(--bg-surface)' : 'var(--bg-card)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-lg)',
                    padding: '14px 18px',
                    fontSize: '0.9rem',
                    lineHeight: '1.6',
                    color: 'var(--text-primary)',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                  }}
                >
                  {renderMessageContent(msg.content, msg.citations)}
                </div>

                {/* Assistant Footer: Metrics & Citations & Feedback */}
                {msg.role === 'assistant' && msg.content && (
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
                    {/* Stage Metrics */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      {msg.metrics?.ttftMs && (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                          <Zap size={11} color="var(--accent)" /> TTFT: {msg.metrics.ttftMs}ms
                        </span>
                      )}
                      {msg.metrics?.latencyMs && (
                        <span>Total: {msg.metrics.latencyMs}ms</span>
                      )}
                      {msg.metrics?.estimatedCost !== undefined && (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '1px' }}>
                          <DollarSign size={11} color="var(--emerald)" />
                          {msg.metrics.estimatedCost.toFixed(5)}
                        </span>
                      )}
                    </div>

                    {/* Actions: View Citations & Feedback */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      {msg.citations && msg.citations.length > 0 && (
                        <button
                          onClick={() => {
                            if (msg.citations && msg.citations[0]) {
                              openCitationDrawer(msg.citations[0]);
                            }
                          }}
                          className="btn btn-ghost"
                          style={{ padding: '3px 8px', fontSize: '0.75rem', color: 'var(--accent)' }}
                        >
                          <BookOpen size={12} />
                          {msg.citations.length} Sources
                        </button>
                      )}

                      {/* Thumbs Feedback */}
                      <button
                        onClick={() => {
                          void handleFeedback(msg.id, 1);
                        }}
                        className="btn btn-ghost"
                        style={{
                          padding: '3px 6px',
                          color: msg.feedbackSubmitted === 1 ? 'var(--emerald)' : 'var(--text-muted)',
                        }}
                        title="Accurate citation"
                      >
                        <ThumbsUp size={12} />
                      </button>
                      <button
                        onClick={() => {
                          void handleFeedback(msg.id, -1);
                        }}
                        className="btn btn-ghost"
                        style={{
                          padding: '3px 6px',
                          color: msg.feedbackSubmitted === -1 ? 'var(--rose)' : 'var(--text-muted)',
                        }}
                        title="Negative feedback (queue as golden set candidate)"
                      >
                        <ThumbsDown size={12} />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        {/* Suggested Queries Pill Bar */}
        {messages.length <= 1 && (
          <div style={{ padding: '0 24px 12px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {[
              'How does PostgreSQL RLS enforce tenant isolation?',
              'What are the HNSW index parameters for vector search?',
              'Explain the Raft election timer safety invariants.',
            ].map((preset, idx) => (
              <button
                key={idx}
                onClick={() => {
                  setInput(preset);
                }}
                className="btn btn-secondary"
                style={{ fontSize: '0.75rem', padding: '6px 12px', borderRadius: 'var(--radius-full)' }}
              >
                {preset}
              </button>
            ))}
          </div>
        )}

        {/* Input Bar */}
        <div style={{ padding: '16px 24px', borderTop: '1px solid var(--border-subtle)', backgroundColor: 'var(--bg-app)' }}>
          <form
            onSubmit={(e) => {
              void handleSend(e);
            }}
            style={{ display: 'flex', gap: '10px', alignItems: 'center' }}
          >
            <input
              type="text"
              className="input"
              placeholder="Ask a question about your indexed documents..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={isStreaming}
              style={{ flex: 1, padding: '12px 16px' }}
            />

            {isStreaming ? (
              <button
                type="button"
                onClick={handleStop}
                className="btn btn-danger"
                style={{ padding: '12px 18px' }}
              >
                <Square size={16} fill="currentColor" />
                <span>Stop</span>
              </button>
            ) : (
              <button
                type="submit"
                className="btn btn-primary"
                disabled={!input.trim()}
                style={{ padding: '12px 20px' }}
              >
                <Send size={16} />
                <span>Send</span>
              </button>
            )}
          </form>
        </div>
      </div>

      {/* Right Drawer: Evidence & Citations */}
      {drawerOpen && (
        <aside
          className="animate-fade-in"
          style={{
            width: '380px',
            borderLeft: '1px solid var(--border-subtle)',
            backgroundColor: 'var(--bg-sidebar)',
            display: 'flex',
            flexDirection: 'column',
            height: '100%',
            flexShrink: 0,
          }}
          aria-label="Citations and Evidence"
        >
          {/* Drawer Header */}
          <div
            style={{
              padding: '16px 20px',
              borderBottom: '1px solid var(--border-subtle)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600, fontSize: '0.9rem' }}>
              <BookOpen size={16} color="var(--accent)" />
              <span>Verified Evidence ({currentCitations.length})</span>
            </div>
            <button
              onClick={() => setDrawerOpen(false)}
              className="btn btn-ghost"
              style={{ padding: '4px' }}
              aria-label="Close citations drawer"
            >
              <X size={16} />
            </button>
          </div>

          {/* Drawer Content */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {currentCitations.map((cit, idx) => {
              const isSelected = selectedCitation?.chunkId === cit.chunkId;
              return (
                <div
                  key={cit.chunkId}
                  onClick={() => setSelectedCitation(cit)}
                  style={{
                    backgroundColor: isSelected ? 'var(--bg-surface)' : 'var(--bg-card)',
                    border: `1px solid ${isSelected ? 'var(--accent)' : 'var(--border-subtle)'}`,
                    borderRadius: 'var(--radius-md)',
                    padding: '14px',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <span className="badge badge-emerald" style={{ fontSize: '0.7rem' }}>
                      [{idx + 1}] Score {(cit.relevanceScore * 100).toFixed(0)}%
                    </span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      Page {cit.page ?? 'N/A'}
                    </span>
                  </div>

                  <div style={{ fontWeight: 600, fontSize: '0.85rem', marginBottom: '6px', color: 'var(--text-primary)' }}>
                    {cit.documentTitle}
                  </div>

                  <p
                    style={{
                      fontSize: '0.8rem',
                      color: 'var(--text-secondary)',
                      lineHeight: '1.5',
                      backgroundColor: 'var(--bg-input)',
                      padding: '8px 10px',
                      borderRadius: 'var(--radius-sm)',
                      border: '1px solid var(--border-subtle)',
                      fontStyle: 'italic',
                    }}
                  >
                    "{cit.snippet}"
                  </p>
                </div>
              );
            })}
          </div>
        </aside>
      )}
    </div>
  );
};
