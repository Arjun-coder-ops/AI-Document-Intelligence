# ADR 0008: Security Hardening, CSRF Protection, and Prompt Injection Defenses

## Status
Accepted

## Context
Enterprise RAG architectures are exposed to both standard web vulnerabilities (Cross-Site Request Forgery, Cross-Origin resource leaks, DoS via body flooding) and AI-specific threat vectors (Indirect Prompt Injection, Delimiter Breakout, System Prompt Exfiltration, and Jailbreaking via retrieved untrusted document chunks).

Production security requirements:
1. **Transport & Header Hardening:** Ensure defensive HTTP response headers (CSP, HSTS, X-Content-Type-Options, X-Frame-Options) and strict CORS origins.
2. **CSRF Protection on Ambient Cookies:** Prevent cross-origin attackers from triggering token rotation or logout using ambient `httpOnly` refresh tokens.
3. **LLM Untrusted Boundary Defense:** Prevent malicious text embedded in user documents or queries from hijacking model instructions, escaping delimiters, or exfiltrating the internal system prompt.
4. **Data Sanitization:** Scrub PII, bearer tokens, and password hashes before emitting structured logs.
5. **Fail-Fast Startup Validation:** Validate all critical environment variables with strict schemas at server startup.

## Decision

1. **HTTP Security Headers & CORS:**
   - Integrated `helmet` middleware across all routes.
   - Enforced strict origin matching in `cors` allowing only configured client origins (`CORS_ORIGIN`) with explicit credential support.
   - Constrained JSON body parser to `1mb` to prevent memory flooding.

2. **Custom Header Anti-CSRF Verification:**
   - Implemented `csrfProtection` middleware for all state-changing requests carrying ambient cookie credentials.
   - Mandates custom headers (`X-Requested-With` or `X-CSRF-Token`) or strict Origin matching. Because browsers forbid cross-origin scripts from setting custom headers without explicit CORS pre-flight authorization, simple cross-site requests are neutralized.

3. **Multi-Layer Prompt Injection Guardrails:**
   - **Instruction Stripping:** Heuristic regex scanner identifies and neutralizes malicious directive patterns (e.g. `ignore previous instructions`, `DAN mode`, `reveal system prompt`), replacing them with `[INSTRUCTION_DEFUSED]`.
   - **Delimiter Sandboxing:** XML delimiters (`<context>`, `<chunk>`, `<system>`) in user queries and document chunks are escaped (`&lt;...&gt;`) so adversarial inputs cannot inject fake system boundaries.
   - **Boundary Canary & Output Filtering:** The system prompt embeds an internal canary token (`SYSTEM_PROMPT_CANARY`). The output filter verifies model responses; any response reflecting the canary or echoing the system prompt is intercepted and replaced with a sanitized refusal.

4. **Startup Environment Validation:**
   - Configured `validateEnv()` in `apps/api/src/config/env.ts` with Zod, asserting valid database URLs, 32-character minimum JWT secrets, and valid numeric dimensions prior to server binding.

5. **PII and Secret Scrubber:**
   - Built recursive log sanitization redacting password hashes, bearer tokens, client secrets, and masking email addresses.

## Consequences
- Verified protection against both OWASP Top 10 web vulnerabilities and OWASP Top 10 for LLM Applications (LLM01: Prompt Injection, LLM06: Sensitive Information Disclosure).
- Zero high/critical findings in dependency security audits.
- Full trace of security mitigations documented in `docs/THREAT_MODEL.md`.
