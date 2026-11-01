/**
 * DocSage Security Engine: Prompt Injection Defenses, Delimiter Sandboxing & Sanitization
 */

export const SYSTEM_PROMPT_CANARY = 'DOCSAGE_CANARY_SECRET_7A28F1';

// Regex patterns for heuristic prompt injection detection
const INJECTION_PATTERNS: RegExp[] = [
  /ignore\s+(all\s+)?(previous|prior|above)\s+instructions?/i,
  /disregard\s+(all\s+)?(previous|prior|above)\s+instructions?/i,
  /override\s+(the\s+)?system\s+instructions?/i,
  /you\s+are\s+now\s+(an?\s+unrestricted|in\s+developer\s+mode|dan)/i,
  /dan\s+(mode|jailbreak)/i,
  /jailbreak/i,
  /system\s+prompt\s+leak/i,
  /reveal\s+(your\s+)?(system\s+prompt|initial\s+instructions)/i,
  /repeat\s+(everything|all)\s+above/i,
  /print\s+the\s+system\s+prompt/i,
  /what\s+are\s+your\s+(secret\s+)?instructions/i,
  /bypass\s+(safety|content)\s+filters?/i,
];

export interface SanitizationResult {
  sanitizedText: string;
  injectionDetected: boolean;
  neutralizedPatterns: string[];
}

/**
 * Neutralizes and strips known prompt injection vectors from untrusted text.
 */
export function sanitizeUntrustedInput(text: string): SanitizationResult {
  let sanitized = text;
  const neutralized: string[] = [];

  for (const pattern of INJECTION_PATTERNS) {
    if (pattern.test(sanitized)) {
      neutralized.push(pattern.source);
      // Replace matching malicious instruction with neutralized placeholder
      sanitized = sanitized.replace(pattern, '[INSTRUCTION_DEFUSED]');
    }
  }

  // Prevent XML delimiter breakout
  sanitized = sanitized
    .replace(/<\/chunk>/gi, '&lt;/chunk&gt;')
    .replace(/<chunk(\s+[^>]*)?>/gi, '&lt;chunk$1&gt;')
    .replace(/<\/context>/gi, '&lt;/context&gt;')
    .replace(/<context>/gi, '&lt;context&gt;')
    .replace(/<\/system>/gi, '&lt;/system&gt;')
    .replace(/<system>/gi, '&lt;system&gt;');

  return {
    sanitizedText: sanitized,
    injectionDetected: neutralized.length > 0,
    neutralizedPatterns: neutralized,
  };
}

/**
 * Validates and filters model output for system prompt leaks or forbidden payload reflection.
 */
export function filterModelOutput(output: string): {
  filteredOutput: string;
  leakDetected: boolean;
} {
  // If the model recites the internal canary, leak is confirmed
  if (output.includes(SYSTEM_PROMPT_CANARY)) {
    return {
      filteredOutput: 'I am unable to display internal system instructions.',
      leakDetected: true,
    };
  }

  // Check if output attempts to parrot the system boundary
  if (/You are DocSage, a verified document intelligence engine/i.test(output)) {
    return {
      filteredOutput: 'I am unable to display internal system instructions.',
      leakDetected: true,
    };
  }

  return {
    filteredOutput: output,
    leakDetected: false,
  };
}

/**
 * PII and Secret Scrubber for logs and traces
 */
export function sanitizeLogData(data: Record<string, unknown>): Record<string, unknown> {
  const SENSITIVE_KEYS = ['password', 'password_hash', 'token', 'authorization', 'cookie', 'secret', 'key'];
  const sanitized: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(data)) {
    if (SENSITIVE_KEYS.some((s) => key.toLowerCase().includes(s))) {
      sanitized[key] = '[REDACTED]';
    } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      sanitized[key] = sanitizeLogData(value as Record<string, unknown>);
    } else if (typeof value === 'string') {
      // Mask email addresses
      const maskedEmail = value.replace(
        /([a-zA-Z0-9_\-.]+)@([a-zA-Z0-9_\-.]+)\.([a-zA-Z]{2,5})/g,
        '***@$2.$3',
      );
      // Mask bearer tokens
      const maskedBearer = maskedEmail.replace(/Bearer\s+[A-Za-z0-9._~+/-]+=*/g, 'Bearer [REDACTED]');
      sanitized[key] = maskedBearer;
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
}
