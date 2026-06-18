import { useState, useCallback, useRef, useEffect } from "react";
import { askQuestion } from "../utils/api";

const SESSIONS_KEY = "docsage_chat_sessions";
const ACTIVE_SESSION_ID_KEY = "docsage_active_session_id";

const defaultSession = {
  id: "default",
  title: "General Chat",
  messages: [],
  timestamp: new Date().toISOString(),
};

export function useChat() {
  const [sessions, setSessions] = useState(() => {
    try {
      const stored = localStorage.getItem(SESSIONS_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {
      console.error("Failed to load chat sessions:", e);
    }
    return [defaultSession];
  });

  const [activeSessionId, setActiveSessionId] = useState(() => {
    try {
      const stored = localStorage.getItem(ACTIVE_SESSION_ID_KEY);
      if (stored) return stored;
    } catch (e) {
      console.error("Failed to load active session ID:", e);
    }
    return "default";
  });

  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState(null);
  const abortRef = useRef(null);

  // Sync sessions to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(SESSIONS_KEY, JSON.stringify(sessions));
    } catch (e) {
      console.error("Failed to save chat sessions:", e);
    }
  }, [sessions]);

  // Sync activeSessionId to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(ACTIVE_SESSION_ID_KEY, activeSessionId);
    } catch (e) {
      console.error("Failed to save active session ID:", e);
    }
  }, [activeSessionId]);

  // Get active session messages
  const activeSession = sessions.find((s) => s.id === activeSessionId) || sessions[0] || defaultSession;
  const messages = activeSession.messages || [];

  /**
   * Create a new chat session.
   */
  const createSession = useCallback((title = "New Chat") => {
    const newSession = {
      id: `session-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      title,
      messages: [],
      timestamp: new Date().toISOString(),
    };
    setSessions((prev) => [newSession, ...prev]);
    setActiveSessionId(newSession.id);
    return newSession.id;
  }, []);

  /**
   * Delete a chat session.
   */
  const deleteSession = useCallback(
    (id) => {
      let nextActiveId = "default";
      setSessions((prev) => {
        const filtered = prev.filter((s) => s.id !== id);
        if (filtered.length === 0) {
          nextActiveId = "default";
          return [defaultSession];
        }
        nextActiveId = filtered[0].id;
        return filtered;
      });

      if (activeSessionId === id) {
        setActiveSessionId(nextActiveId);
      }
    },
    [activeSessionId]
  );

  /**
   * Switch active session.
   */
  const selectSession = useCallback((id) => {
    setActiveSessionId(id);
    setError(null);
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
    setIsStreaming(false);
  }, []);

  /**
   * Helper to update messages for the active session.
   */
  const updateActiveSessionMessages = useCallback((updater) => {
    setSessions((prev) =>
      prev.map((s) => {
        if (s.id === activeSessionId) {
          const newMessages = typeof updater === "function" ? updater(s.messages || []) : updater;
          return { ...s, messages: newMessages, timestamp: new Date().toISOString() };
        }
        return s;
      })
    );
  }, [activeSessionId]);

  /**
   * Build the chat history array for the API (last N turns).
   */
  const buildHistory = useCallback((currentMessages, limit = 10) => {
    return currentMessages
      .filter((m) => m.role === "user" || m.role === "assistant")
      .slice(-limit)
      .map((m) => ({ role: m.role, content: m.content }));
  }, []);

  /**
   * Send a query through the RAG pipeline.
   */
  const sendMessage = useCallback(
    async (query, { debug = false } = {}) => {
      if (!query.trim() || isStreaming) return;

      setError(null);

      // Cancel any ongoing stream
      if (abortRef.current) {
        abortRef.current.abort();
      }
      abortRef.current = new AbortController();

      const userMsg = {
        id: `user-${Date.now()}`,
        role: "user",
        content: query.trim(),
        timestamp: new Date().toISOString(),
      };

      const assistantId = `assistant-${Date.now()}`;
      const assistantMsg = {
        id: assistantId,
        role: "assistant",
        content: "",
        timestamp: new Date().toISOString(),
        sources: [],
        debugChunks: null,
        isStreaming: true,
      };

      // Add user and placeholder assistant message to the active session
      let historySnapshot = [];
      setSessions((prev) => {
        const active = prev.find((s) => s.id === activeSessionId) || prev[0] || defaultSession;
        const currentMsgs = active.messages || [];
        historySnapshot = buildHistory(
          currentMsgs.filter((m) => m.role === "user" || m.role === "assistant")
        );
        return prev.map((s) => {
          if (s.id === activeSessionId) {
            return {
              ...s,
              messages: [...currentMsgs, userMsg, assistantMsg],
              timestamp: new Date().toISOString(),
            };
          }
          return s;
        });
      });

      setIsStreaming(true);

      await askQuestion({
        query: query.trim(),
        chatHistory: historySnapshot,
        debug,
        signal: abortRef.current.signal,

        onSources: (sources) => {
          updateActiveSessionMessages((prev) =>
            prev.map((m) => (m.id === assistantId ? { ...m, sources } : m))
          );
        },

        onToken: (token) => {
          updateActiveSessionMessages((prev) =>
            prev.map((m) => (m.id === assistantId ? { ...m, content: m.content + token } : m))
          );
        },

        onDebug: (chunks) => {
          updateActiveSessionMessages((prev) =>
            prev.map((m) => (m.id === assistantId ? { ...m, debugChunks: chunks } : m))
          );
        },

        onDone: () => {
          updateActiveSessionMessages((prev) =>
            prev.map((m) => (m.id === assistantId ? { ...m, isStreaming: false } : m))
          );
          setIsStreaming(false);
        },

        onError: (err) => {
          updateActiveSessionMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId
                ? {
                    ...m,
                    content: "",
                    error: err.message || "Something went wrong",
                    isStreaming: false,
                  }
                : m
            )
          );
          setIsStreaming(false);
          setError(err.message);
        },
      });
    },
    [isStreaming, activeSessionId, buildHistory, updateActiveSessionMessages]
  );

  /**
   * Stop the current stream.
   */
  const stopStreaming = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
    setIsStreaming(false);
    updateActiveSessionMessages((prev) =>
      prev.map((m) => (m.isStreaming ? { ...m, isStreaming: false } : m))
    );
  }, [updateActiveSessionMessages]);

  /**
   * Clear all messages in the active session.
   */
  const clearChat = useCallback(() => {
    stopStreaming();
    updateActiveSessionMessages([]);
    setError(null);
  }, [stopStreaming, updateActiveSessionMessages]);

  return {
    sessions,
    activeSessionId,
    createSession,
    deleteSession,
    selectSession,
    messages,
    isStreaming,
    error,
    sendMessage,
    stopStreaming,
    clearChat,
    setError,
  };
}
