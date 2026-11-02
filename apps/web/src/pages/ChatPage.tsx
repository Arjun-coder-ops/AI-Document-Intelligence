import React, { useState, useRef, useEffect } from 'react';
import { api } from '../api/client.js';
import type { Citation, SSEEventDone } from '@docsage/shared';
import { Send, Square } from 'lucide-react';
import { ChatMessageItem, type ChatMessage } from '../components/ChatMessageItem.js';
import { CitationDrawer } from '../components/CitationDrawer.js';

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
            setIsStreaming(false);
          },
        },
        controller.signal,
      );
    } catch {
      setIsStreaming(false);
    }
  };

  const handleStop = () => {
    abortControllerRef.current?.abort();
    setIsStreaming(false);
  };

  const handleFeedback = async (messageId: string, rating: 1 | -1) => {
    try {
      await api.submitFeedback(messageId, rating);
      setMessages((prev) =>
        prev.map((m) => (m.id === messageId ? { ...m, feedbackSubmitted: rating } : m)),
      );
    } catch (err: unknown) {
      console.error('Feedback failed:', err);
    }
  };

  const openCitationDrawer = (cit: Citation) => {
    setSelectedCitation(cit);
    setDrawerOpen(true);
  };

  return (
    <div style={{ display: 'flex', height: '100%', width: '100%', overflow: 'hidden' }}>
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          position: 'relative',
        }}
      >
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '24px 32px',
            display: 'flex',
            flexDirection: 'column',
            gap: '20px',
          }}
        >
          {messages.map((msg) => (
            <ChatMessageItem
              key={msg.id}
              message={msg}
              onOpenCitation={openCitationDrawer}
              onFeedback={(id, rating) => void handleFeedback(id, rating)}
            />
          ))}
          <div ref={messagesEndRef} />
        </div>

        {messages.length <= 1 && (
          <div style={{ padding: '0 24px 12px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {[
              'How does PostgreSQL RLS enforce tenant isolation?',
              'What are the HNSW index parameters for vector search?',
              'Explain the Raft election timer safety invariants.',
            ].map((preset, idx) => (
              <button
                key={idx}
                onClick={() => setInput(preset)}
                className="btn btn-secondary"
                style={{
                  fontSize: '0.75rem',
                  padding: '6px 12px',
                  borderRadius: 'var(--radius-full)',
                }}
              >
                {preset}
              </button>
            ))}
          </div>
        )}

        <div
          style={{
            padding: '16px 24px',
            borderTop: '1px solid var(--border-subtle)',
            backgroundColor: 'var(--bg-app)',
          }}
        >
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

      <CitationDrawer
        open={drawerOpen}
        citations={currentCitations}
        selectedCitation={selectedCitation}
        onSelectCitation={setSelectedCitation}
        onClose={() => setDrawerOpen(false)}
      />
    </div>
  );
};
