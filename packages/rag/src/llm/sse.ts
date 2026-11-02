export async function consumeSSEStream(
  stream: ReadableStream<Uint8Array>,
  onToken: (token: string) => void,
  extractToken: (data: unknown) => string | undefined,
  signal?: AbortSignal,
): Promise<void> {
  const reader = stream.getReader();
  const decoder = new TextDecoder('utf-8');
  let buffer = '';

  try {
    while (true) {
      if (signal?.aborted) {
        const abortErr = new Error('LLM generation aborted by client');
        abortErr.name = 'AbortError';
        throw abortErr;
      }

      const chunkResult = await reader.read();
      if (chunkResult.done) break;

      if (chunkResult.value) {
        buffer += decoder.decode(chunkResult.value, { stream: true });
      }
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith('data: ')) continue;
        const jsonStr = trimmed.slice(6);
        if (jsonStr === '[DONE]') break;

        try {
          const parsed = JSON.parse(jsonStr) as unknown;
          const token = extractToken(parsed);
          if (token) {
            onToken(token);
          }
        } catch {
          // Ignore partial or unparseable SSE line
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}
