/**
 * useChat — manages conversation state, streaming, and history.
 * Encapsulates all chat logic so components stay clean.
 */
import { useState, useCallback, useRef } from "react";
import { askQuestion } from "../utils/api";

export function useChat() {
  const [messages, setMessages] = useState([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState(null);
  const abortRef = useRef(null);

  /**
   * Add a message to history.
   */
  const addMessage = useCallback((role, content, extras = {}) => {
    const msg = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      role,
      content,
      timestamp: new Date(),
      ...extras,
    };
    setMessages((prev) => [...prev, msg]);
    return msg.id;
  }, []);

  /**
   * Update the content of the last assistant message (for streaming).
   */
  const appendToLastMessage = useCallback((token) => {
    setMessages((prev) => {
      if (!prev.length) return prev;
      const updated = [...prev];
      const last = { ...updated[updated.length - 1] };
      last.content += token;
      updated[updated.length - 1] = last;
      return updated;
    });
  }, []);

  /**
   * Patch any field on a message by id.
   */
  const patchMessage = useCallback((id, patch) => {
    setMessages((prev) =>
      prev.map((m) => (m.id === id ? { ...m, ...patch } : m))
    );
  }, []);

  /**
   * Build the chat history array for the API (last N turns).
   */
  const buildHistory = useCallback(
    (currentMessages, limit = 10) => {
      return currentMessages
        .filter((m) => m.role === "user" || m.role === "assistant")
        .slice(-limit)
        .map((m) => ({ role: m.role, content: m.content }));
    },
    []
  );

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

      // Add user message
      setMessages((prev) => {
        const userMsg = {
          id: `user-${Date.now()}`,
          role: "user",
          content: query.trim(),
          timestamp: new Date(),
        };
        return [...prev, userMsg];
      });

      // Add placeholder assistant message
      const assistantId = `assistant-${Date.now()}`;
      setMessages((prev) => [
        ...prev,
        {
          id: assistantId,
          role: "assistant",
          content: "",
          timestamp: new Date(),
          sources: [],
          debugChunks: null,
          isStreaming: true,
        },
      ]);

      setIsStreaming(true);

      // Build history from current messages snapshot
      const historySnapshot = buildHistory(
        messages.filter((m) => m.role === "user" || m.role === "assistant")
      );

      await askQuestion({
        query: query.trim(),
        chatHistory: historySnapshot,
        debug,
        signal: abortRef.current.signal,

        onSources: (sources) => {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId ? { ...m, sources } : m
            )
          );
        },

        onToken: (token) => {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId
                ? { ...m, content: m.content + token }
                : m
            )
          );
        },

        onDebug: (chunks) => {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId ? { ...m, debugChunks: chunks } : m
            )
          );
        },

        onDone: () => {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId ? { ...m, isStreaming: false } : m
            )
          );
          setIsStreaming(false);
        },

        onError: (err) => {
          setMessages((prev) =>
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
    [isStreaming, messages, buildHistory]
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
    setMessages((prev) =>
      prev.map((m) =>
        m.isStreaming ? { ...m, isStreaming: false } : m
      )
    );
  }, []);

  /**
   * Clear all messages.
   */
  const clearChat = useCallback(() => {
    stopStreaming();
    setMessages([]);
    setError(null);
  }, [stopStreaming]);

  return {
    messages,
    isStreaming,
    error,
    sendMessage,
    stopStreaming,
    clearChat,
    setError,
  };
}
