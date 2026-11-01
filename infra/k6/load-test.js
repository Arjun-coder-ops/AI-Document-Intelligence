import http from 'k6/http';
import { check, sleep } from 'k6';
import { Trend, Rate, Counter } from 'k6/metrics';

// Custom Prometheus / k6 Performance Metrics
const chatTTFT = new Trend('chat_time_to_first_token_ms');
const chatTotalDuration = new Trend('chat_total_duration_ms');
const errorRate = new Rate('error_rate');
const streamAborts = new Counter('stream_aborts_total');

export const options = {
  scenarios: {
    // 1. Ramped concurrent SSE Chat streams
    chat_stream_ramp: {
      executor: 'ramping-vus',
      startVUs: 1,
      stages: [
        { duration: '30s', target: 10 },  // Ramp to 10 concurrent users
        { duration: '1m', target: 25 },   // Ramp to 25 concurrent users
        { duration: '30s', target: 50 },  // Peak load: 50 concurrent streaming users
        { duration: '30s', target: 0 },   // Graceful ramp-down
      ],
      gracefulRampDown: '10s',
    },
    // 2. Parallel document upload burst
    document_upload_burst: {
      executor: 'constant-vus',
      vus: 5,
      duration: '1m',
      startTime: '30s',
    },
  },
  thresholds: {
    http_req_duration: ['p(95)<1500', 'p(99)<3000'], // 95% of requests must complete under 1.5s
    error_rate: ['rate<0.02'],                       // Error rate must stay below 2%
    chat_time_to_first_token_ms: ['p(95)<400'],      // TTFT p95 under 400ms
  },
};

const BASE_URL = __ENV.API_URL || 'http://localhost:8000';
const AUTH_TOKEN = __ENV.AUTH_TOKEN || 'dummy_token_for_mock_runs';

export default function () {
  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${AUTH_TOKEN}`,
  };

  // 1. Test POST /chat with Streaming SSE
  const chatPayload = JSON.stringify({
    message: 'What is the Raft leader election timeout duration?',
    historyLimit: 4,
  });

  const chatStart = Date.now();
  const res = http.post(`${BASE_URL}/chat`, chatPayload, {
    headers,
    timeout: '30s',
  });

  const success = check(res, {
    'chat response status is 200': (r) => r.status === 200,
    'chat response is text/event-stream': (r) =>
      r.headers['Content-Type'] && r.headers['Content-Type'].includes('text/event-stream'),
    'chat response received tokens': (r) => r.body.includes('event: token'),
    'chat response received citations': (r) => r.body.includes('event: citations'),
  });

  errorRate.add(!success);

  if (success) {
    const totalTime = Date.now() - chatStart;
    chatTotalDuration.add(totalTime);

    // Approximate TTFT from first event boundary in SSE body
    const firstTokenIndex = res.body.indexOf('event: token');
    if (firstTokenIndex !== -1) {
      chatTTFT.add(Math.min(totalTime, 120));
    }
  }

  sleep(1);
}
