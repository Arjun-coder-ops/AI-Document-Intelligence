/**
 * API utility functions for communicating with the RAG backend.
 * All endpoints use the Vite proxy in dev, or VITE_API_URL in production.
 */

const API_BASE = import.meta.env.VITE_API_URL || "";

/**
 * Upload one or more PDF files to the backend.
 * @param {File[]} files - Array of File objects
 * @param {function} onProgress - Optional progress callback (not used here, placeholder)
 * @returns {Promise<{success, results, errors}>}
 */
export async function uploadPDFs(files) {
  const formData = new FormData();
  files.forEach((file) => formData.append("files", file));

  const response = await fetch(`${API_BASE}/upload`, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({ detail: "Upload failed" }));
    throw new Error(err.detail?.message || err.detail || "Upload failed");
  }

  return response.json();
}

/**
 * Stream a RAG query response using Server-Sent Events.
 *
 * @param {object} params
 * @param {string} params.query - User question
 * @param {Array}  params.chatHistory - [{role, content}]
 * @param {boolean} params.debug - Include debug chunks
 * @param {function} params.onSources - Called once with source list
 * @param {function} params.onToken - Called for each streamed token
 * @param {function} params.onDebug - Called with debug chunk data
 * @param {function} params.onDone - Called when stream completes
 * @param {function} params.onError - Called on error
 * @param {AbortSignal} params.signal - AbortController signal
 */
export async function askQuestion({
  query,
  chatHistory = [],
  debug = false,
  onSources,
  onToken,
  onDebug,
  onDone,
  onError,
  signal,
}) {
  try {
    const response = await fetch(`${API_BASE}/ask`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query, chat_history: chatHistory, debug }),
      signal,
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.detail || "Request failed");
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop(); // Keep incomplete line in buffer

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith("data: ")) continue;

        const data = trimmed.slice(6);
        if (data === "[DONE]") {
          onDone?.();
          return;
        }

        try {
          const event = JSON.parse(data);
          switch (event.type) {
            case "sources":
              onSources?.(event.data);
              break;
            case "token":
              onToken?.(event.data);
              break;
            case "debug_chunks":
              onDebug?.(event.data);
              break;
            case "done":
              onDone?.();
              return;
            case "error":
              onError?.(new Error(event.data));
              return;
          }
        } catch (parseErr) {
          console.warn("Failed to parse SSE event:", data);
        }
      }
    }

    onDone?.();
  } catch (err) {
    if (err.name === "AbortError") return;
    onError?.(err);
  }
}

/**
 * Compare RAG answer vs baseline (no context) answer.
 * @param {string} query
 * @param {Array} chatHistory
 * @returns {Promise<{with_context, without_context, query}>}
 */
export async function compareAnswers(query, chatHistory = []) {
  const response = await fetch(`${API_BASE}/compare`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, chat_history: chatHistory }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.detail || "Comparison failed");
  }

  return response.json();
}

/**
 * Fetch list of indexed documents.
 * @returns {Promise<{documents, total}>}
 */
export async function listDocuments() {
  const response = await fetch(`${API_BASE}/documents`);
  if (!response.ok) throw new Error("Failed to fetch documents");
  return response.json();
}

/**
 * Delete a document from the registry.
 * @param {string} filename
 */
export async function deleteDocument(filename) {
  const response = await fetch(
    `${API_BASE}/documents/${encodeURIComponent(filename)}`,
    { method: "DELETE" }
  );
  if (!response.ok) throw new Error("Failed to delete document");
  return response.json();
}

/**
 * Fetch pipeline statistics.
 * @returns {Promise<object>}
 */
export async function getStats() {
  const response = await fetch(`${API_BASE}/stats`);
  if (!response.ok) throw new Error("Failed to fetch stats");
  return response.json();
}

/**
 * Health check.
 * @returns {Promise<object>}
 */
export async function healthCheck() {
  const response = await fetch(`${API_BASE}/health`);
  if (!response.ok) throw new Error("Backend unavailable");
  return response.json();
}
