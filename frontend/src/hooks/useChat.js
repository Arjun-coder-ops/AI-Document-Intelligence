import { useState, useCallback, useRef, useEffect } from "react";
import { askQuestion } from "../utils/api";

const ACTIVE_DOC_KEY = "docsage_active_doc_name";

export function useChat() {
  const [activeDocName, setActiveDocName] = useState(() => {
    try {
      return localStorage.getItem(ACTIVE_DOC_KEY) || null;
    } catch (e) {
      console.error("Failed to load active document name:", e);
      return null;
    }
  });

  const [messages, setMessages] = useState([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState(null);
  const abortRef = useRef(null);

  // Load chat history when activeDocName changes
  useEffect(() => {
    if (!activeDocName) {
      setMessages([]);
      return;
    }
    try {
      const stored = localStorage.getItem(`docsage_history_${activeDocName}`);
      if (stored) {
        setMessages(JSON.parse(stored));
      } else {
        setMessages([]);
      }
      setError(null);
    } catch (e) {
      console.error("Failed to load chat history for", activeDocName, e);
      setMessages([]);
    }
  }, [activeDocName]);

  // Save chat history when messages change
  useEffect(() => {
    if (!activeDocName) return;
    try {
      localStorage.setItem(`docsage_history_${activeDocName}`, JSON.stringify(messages));
    } catch (e) {
      console.error("Failed to save chat history for", activeDocName, e);
    }
  }, [messages, activeDocName]);

  // Sync activeDocName to localStorage
  useEffect(() => {
    try {
      if (activeDocName) {
        localStorage.setItem(ACTIVE_DOC_KEY, activeDocName);
      } else {
        localStorage.removeItem(ACTIVE_DOC_KEY);
      }
    } catch (e) {
      console.error("Failed to save active doc name:", e);
    }
  }, [activeDocName]);

  /**
   * Delete history for a document.
   */
  const deleteHistoryForDoc = useCallback(
    (docName) => {
      try {
        localStorage.removeItem(`docsage_history_${docName}`);
      } catch (e) {
        console.error("Failed to delete chat history for", docName, e);
      }
      if (activeDocName === docName) {
        setActiveDocName(null);
      }
    },
    [activeDocName]
  );

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
   * Helper to update messages.
   */
  const updateMessages = useCallback((updater) => {
    setMessages((prev) => {
      return typeof updater === "function" ? updater(prev) : updater;
    });
  }, []);

  /**
   * Send a query through the RAG pipeline.
   */
  const sendMessage = useCallback(
    async (query, { debug = false } = {}) => {
      if (!query.trim() || isStreaming || !activeDocName) return;

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

      let historySnapshot = [];
      setMessages((prev) => {
        historySnapshot = buildHistory(prev);
        return [...prev, userMsg, assistantMsg];
      });

      setIsStreaming(true);

      await askQuestion({
        query: query.trim(),
        chatHistory: historySnapshot,
        debug,
        docSource: activeDocName,
        signal: abortRef.current.signal,

        onSources: (sources) => {
          updateMessages((prev) =>
            prev.map((m) => (m.id === assistantId ? { ...m, sources } : m))
          );
        },

        onToken: (token) => {
          updateMessages((prev) =>
            prev.map((m) => (m.id === assistantId ? { ...m, content: m.content + token } : m))
          );
        },

        onDebug: (chunks) => {
          updateMessages((prev) =>
            prev.map((m) => (m.id === assistantId ? { ...m, debugChunks: chunks } : m))
          );
        },

        onDone: () => {
          updateMessages((prev) =>
            prev.map((m) => (m.id === assistantId ? { ...m, isStreaming: false } : m))
          );
          setIsStreaming(false);
        },

        onError: (err) => {
          updateMessages((prev) =>
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
    [isStreaming, activeDocName, buildHistory, updateMessages]
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
    updateMessages((prev) =>
      prev.map((m) => (m.isStreaming ? { ...m, isStreaming: false } : m))
    );
  }, [updateMessages]);

  /**
   * Clear all messages for the active document.
   */
  const clearChat = useCallback(() => {
    stopStreaming();
    setMessages([]);
    setError(null);
    if (activeDocName) {
      try {
        localStorage.removeItem(`docsage_history_${activeDocName}`);
      } catch (e) {
        console.error(e);
      }
    }
  }, [stopStreaming, activeDocName]);

  return {
    activeDocName,
    setActiveDocName,
    messages,
    isStreaming,
    error,
    sendMessage,
    stopStreaming,
    clearChat,
    deleteHistoryForDoc,
    setError,
  };
}
