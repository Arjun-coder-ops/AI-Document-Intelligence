# ADR 0006: Server-Sent Events (SSE) and End-to-End Abort Cancellation

## Status

Accepted

## Context

Document Q&A interactions require streaming output tokens from the upstream LLM (Groq / Gemini) to the browser in real time to minimize perceived latency (Time To First Token, TTFT).
Key production requirements:

1. **Unidirectional Transport:** Generative chat responses stream tokens downstream from server to client over a single HTTP connection.
2. **Cancellation on Disconnect:** Users frequently click "Stop generating", navigate away, or submit a new query mid-generation. Without upstream abort propagation, the backend continues consuming GPU cycles and token budget from the LLM provider, wasting cost.
3. **Proxy Timeouts:** Corporate reverse proxies (NGINX, Cloudflare, AWS ALB) terminate idle HTTP connections after 30–60 seconds if no bytes are transferred during long multi-hop retrieval or thinking phases.
4. **Backpressure:** Fast token streams from models generating 200+ tokens/sec can overwhelm slow client connections, causing unbounded buffer accumulation in Node.js memory.

## Decision

1. **Protocol Choice: Server-Sent Events (SSE) over HTTP/1.1 & HTTP/2:**
   - SSE uses standard HTTP (`text/event-stream`), traversing corporate firewalls, load balancers, and CDN caches without custom WebSocket handshake protocol upgrades.
   - Native browser reconnection handling and lightweight event formatting (`event:`, `data:`).
2. **End-to-End AbortController Propagation:**
   - Wire Node.js HTTP request lifecycle (`req.on('close')`) directly to an `AbortController`.
   - Pass `abortController.signal` into `fetch()` and LLM streaming readers.
   - When the client closes the TCP connection or triggers `controller.abort()`, the socket abort propagates upstream immediately, cutting off the provider call and recording partial usage.
3. **Heartbeat Pings (Every 15s):**
   - Emit SSE comments (`: heartbeat\n\n`) every 15 seconds to ensure intermediate proxies and browser connection managers do not time out during dense vector searches or initial model synthesis.
4. **Structured Event Stream Wire Protocol:**
   - `meta`: request ID, conversation ID, model name.
   - `token`: individual text deltas.
   - `citations`: verified array of grounded source chunks (document, page, snippet).
   - `error`: structured error payload emitted upon mid-stream failure.
   - `done`: terminal frame with latency, token usage, and cost estimates.
5. **Backpressure Safety:**
   - In `sendSSE()`, check `res.write(payload)`. If false (buffer full), wait for the `drain` event before writing subsequent tokens.

## Consequences

- Zero wasted upstream LLM tokens on abandoned queries.
- Clean error recovery mid-stream without crashing the HTTP server.
- High connection resilience across proxies and mobile networks.
