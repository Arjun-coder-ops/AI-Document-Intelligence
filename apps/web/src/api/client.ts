import {
  type AuthResponse,
  type Citation,
  type SSEEventMeta,
  type SSEEventToken,
  type SSEEventCitations,
  type SSEEventError,
  type SSEEventDone,
} from '@docsage/shared';

const API_BASE = '/api';

export interface DocumentRecord {
  id: string;
  tenantId: string;
  ownerId: string;
  title: string;
  filename: string;
  mime: string;
  sizeBytes: number;
  contentSha256: string;
  status: 'pending' | 'processing' | 'ready' | 'failed';
  error: string | null;
  version: number;
  createdAt: string;
}

export interface DocumentStatusResponse {
  id: string;
  status: 'pending' | 'processing' | 'ready' | 'failed';
  error: string | null;
  version: number;
  chunksIndexed: number;
}

export interface AdminAnalyticsData {
  tenantId: string;
  totalCost: number;
  totalMessages: number;
  p95LatencyMs: number;
  p50LatencyMs: number;
  feedback: {
    thumbsUp: number;
    thumbsDown: number;
  };
  topUnanswered: Array<{
    messageId: string;
    contentSnippet: string;
    createdAt: string;
  }>;
}

export class ApiClient {
  private token: string | null = null;

  setToken(token: string | null): void {
    this.token = token;
  }

  getToken(): string | null {
    return this.token;
  }

  private getHeaders(extraHeaders: Record<string, string> = {}): Record<string, string> {
    const headers: Record<string, string> = {
      'X-Requested-With': 'XMLHttpRequest',
      ...extraHeaders,
    };
    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }
    return headers;
  }

  // ─── Auth API ─────────────────────────────────────────────────────────────
  async login(email: string, password: string): Promise<AuthResponse> {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: this.getHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ email, password }),
    });

    if (!res.ok) {
      const err = (await res.json()) as { error?: string };
      throw new Error(err.error ?? 'Authentication failed');
    }

    const data = (await res.json()) as AuthResponse;
    this.setToken(data.accessToken);
    return data;
  }

  async register(email: string, password: string, tenantName: string): Promise<AuthResponse> {
    const res = await fetch(`${API_BASE}/auth/register`, {
      method: 'POST',
      headers: this.getHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ email, password, tenantName }),
    });

    if (!res.ok) {
      const err = (await res.json()) as { error?: string };
      throw new Error(err.error ?? 'Registration failed');
    }

    const data = (await res.json()) as AuthResponse;
    this.setToken(data.accessToken);
    return data;
  }

  async logout(): Promise<void> {
    await fetch(`${API_BASE}/auth/logout`, {
      method: 'POST',
      headers: this.getHeaders(),
    });
    this.setToken(null);
  }

  // ─── Documents API ────────────────────────────────────────────────────────
  async getDocuments(): Promise<DocumentRecord[]> {
    const res = await fetch(`${API_BASE}/documents`, {
      headers: this.getHeaders(),
    });
    if (!res.ok) {
      throw new Error('Failed to load documents');
    }
    const data = (await res.json()) as { documents: DocumentRecord[] };
    return data.documents;
  }

  async uploadDocument(file: File): Promise<{ documentId: string; isDuplicate?: boolean }> {
    const formData = new FormData();
    formData.append('file', file);

    const res = await fetch(`${API_BASE}/documents`, {
      method: 'POST',
      headers: this.getHeaders(), // Let browser set Content-Type with multipart boundary
      body: formData,
    });

    if (!res.ok) {
      const err = (await res.json()) as { error?: string };
      throw new Error(err.error ?? 'Upload failed');
    }

    return (await res.json()) as { documentId: string; isDuplicate?: boolean };
  }

  async getDocumentStatus(id: string): Promise<DocumentStatusResponse> {
    const res = await fetch(`${API_BASE}/documents/${id}/status`, {
      headers: this.getHeaders(),
    });
    if (!res.ok) {
      throw new Error('Failed to retrieve document status');
    }
    return (await res.json()) as DocumentStatusResponse;
  }

  async deleteDocument(id: string): Promise<void> {
    const res = await fetch(`${API_BASE}/documents/${id}`, {
      method: 'DELETE',
      headers: this.getHeaders(),
    });
    if (!res.ok) {
      const err = (await res.json()) as { error?: string };
      throw new Error(err.error ?? 'Failed to delete document');
    }
  }

  // ─── Streaming Chat API (Fetch-based SSE parser) ──────────────────────────
  async streamChat(
    message: string,
    conversationId: string | undefined,
    callbacks: {
      onMeta?: (meta: SSEEventMeta) => void;
      onToken?: (token: string) => void;
      onCitations?: (citations: Citation[]) => void;
      onError?: (err: SSEEventError) => void;
      onDone?: (done: SSEEventDone) => void;
    },
    signal?: AbortSignal,
  ): Promise<void> {
    const res = await fetch(`${API_BASE}/chat`, {
      method: 'POST',
      headers: this.getHeaders({
        'Content-Type': 'application/json',
        Accept: 'text/event-stream',
      }),
      body: JSON.stringify({ message, conversationId }),
      signal: signal ?? null,
    });

    if (!res.ok) {
      const err = (await res.json()) as { error?: string };
      throw new Error(err.error ?? 'Chat request failed');
    }

    if (!res.body) {
      throw new Error('Streaming response body is null');
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const frames = buffer.split(/\r?\n\r?\n/);
        buffer = frames.pop() ?? '';

        for (const frame of frames) {
          const trimmed = frame.trim();
          if (!trimmed || trimmed.startsWith(':')) continue; // Ignore heartbeats/comments

          const lines = trimmed.split(/\r?\n/);
          let eventName = 'message';
          let dataStr = '';

          for (const line of lines) {
            if (line.startsWith('event: ')) {
              eventName = line.slice(7).trim();
            } else if (line.startsWith('data: ')) {
              dataStr = line.slice(6).trim();
            }
          }

          if (!dataStr) continue;

          try {
            const parsed = JSON.parse(dataStr) as unknown;
            if (eventName === 'meta') {
              callbacks.onMeta?.(parsed as SSEEventMeta);
            } else if (eventName === 'token') {
              const tokenPayload = parsed as SSEEventToken;
              callbacks.onToken?.(tokenPayload.token);
            } else if (eventName === 'citations') {
              const citationsPayload = parsed as SSEEventCitations;
              callbacks.onCitations?.(citationsPayload.citations);
            } else if (eventName === 'error') {
              callbacks.onError?.(parsed as SSEEventError);
            } else if (eventName === 'done') {
              callbacks.onDone?.(parsed as SSEEventDone);
            }
          } catch {
            // Ignore partial SSE chunk parse error
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  // ─── Admin Analytics & Feedback API ───────────────────────────────────────
  async getAdminAnalytics(): Promise<AdminAnalyticsData> {
    const res = await fetch(`${API_BASE}/admin/analytics`, {
      headers: this.getHeaders(),
    });
    if (!res.ok) {
      throw new Error('Failed to load admin analytics');
    }
    return (await res.json()) as AdminAnalyticsData;
  }

  async submitFeedback(messageId: string, rating: 1 | -1, comment?: string): Promise<void> {
    const res = await fetch(`${API_BASE}/admin/feedback`, {
      method: 'POST',
      headers: this.getHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ messageId, rating, comment }),
    });
    if (!res.ok) {
      throw new Error('Failed to submit message feedback');
    }
  }
}

export const api = new ApiClient();
