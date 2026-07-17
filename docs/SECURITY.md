# Security

Threat model, controls, and where each control is exercised by the test suite.
CrowdPulse AI is a stadium operations command center: a public single-page app
talking to an Express API that drives a Gemini-powered agent over a simulated
stadium state.

## Trust boundaries

```
[Untrusted user] → [Browser SPA] → [Express API] → [Gemini, Firestore]
       ▲                ▲               ▲
       │                │               └─ ADC service account on Cloud Run
       │                └─ strict CSP, HSTS, no third-party scripts
       └─ JWT bearer token (HS256, short-lived, signed server-side)
```

## Authentication & authorization

* Every mutating endpoint requires `Authorization: Bearer <JWT>`
  (`authMiddleware`).
* Tokens are HS256, signed server-side with `JWT_SECRET`, and carry `iat`/`exp`
  claims with an 8-hour lifetime (`TOKEN_TTL_MS`). Expired tokens are rejected.
* Signatures are compared in **constant time** (`crypto.timingSafeEqual`) to
  resist timing side-channels; structurally malformed tokens are rejected.
* Role-based access control (`ROLE_CLEARANCE`, `isRoleAuthorized`,
  `clearanceForRole`) gates privileged roles (Stadium Director, Security Chief)
  behind an allow-list; every other identity is granted the least-privilege
  default role. The `/api/auth/verify-role` endpoint returns **403** on an
  unauthorized privilege-escalation attempt.
* Mutating endpoints enforce **tiered clearance** via `requireClearance()`:
  simulation reset requires Stadium Director, gate and match-status changes
  require Operations Lead or above; an under-cleared token receives **403** — a
  valid token alone is not sufficient for a privileged action (`ROLE_RANK`).
* `JWT_SECRET` is never committed; a startup warning fires if the insecure
  development default is used, and the production value lives only in the Cloud
  Run service environment.
* **Demo vs production login.** `/api/auth/token` issues a least-privilege token
  from a claimed identity to power the one-click judge demo. Set
  `DEMO_LOGIN_ENABLED=false` in production to disable credential-free issuance;
  identities should then be established from a verified Firebase ID token. The
  JWT is a deliberately minimal, dependency-free HS256 implementation
  (constant-time verify, `exp` enforced, tamper-tested); adopting the vetted
  `jose` library is the recommended production hardening step.

## Input validation

* `isValidString` bounds every user-supplied string (username ≤ 64, email ≤ 254,
  AI message ≤ 2000) and rejects non-strings before any business logic runs.
* Role requests are validated against `VALID_ROLES` (400 on unknown roles).
* Gate/match-status transitions are validated against fixed enums (400 on
  invalid values).
* JSON request bodies are capped at 256 KB (`JSON_BODY_LIMIT`).

## Prompt-injection defences

| Vector | Mitigation |
|---|---|
| Malicious text in an AI query trying to alter behaviour | The system prompt is built server-side (`buildSystemPrompt`) from live state and never echoed; tool schemas (`agentTools`) constrain what the model can invoke. |
| Model requesting an unknown tool | `executeToolCall` switch returns a safe `{error}` for any unrecognised tool name. |
| Output rendered in the browser | The SPA renders text only (no `dangerouslySetInnerHTML`); the API returns JSON. |

## Transport & headers (`applySecurity`)

* Strict **Content-Security-Policy** — `default-src 'self'`, `object-src 'none'`,
  scripts limited to `'self'`; the only external origins allow-listed are Google
  Fonts and the Firebase Auth/Firestore endpoints the SPA actually uses.
* HSTS (1 year, `includeSubDomains`), `X-Content-Type-Options: nosniff`,
  `X-Frame-Options: SAMEORIGIN`, `Referrer-Policy: strict-origin-when-cross-origin`,
  `Cross-Origin-Resource-Policy: same-origin`, and a `Permissions-Policy` that
  disables geolocation/microphone/camera/payment.
* `X-Powered-By` is removed (helmet).
* CORS is restricted to `ALLOWED_ORIGINS` when configured.

## Rate limiting

* General limiter: 120 req/min/IP on `/api/*`.
* Stricter limiter: 20 req/min/IP on `/api/auth/*` to blunt credential
  stuffing and token brute-force.

## Secrets management

* No secrets in source. `JWT_SECRET` and `GEMINI_API_KEY` are Cloud Run env
  vars; the Firebase web config (public by design) is injected at build time via
  `VITE_FIREBASE_*` build args, not committed.

## OWASP Top 10 mapping

| Risk | Control |
|---|---|
| A01 Broken Access Control | JWT verification + RBAC allow-list + tiered clearance on mutations + 403 on escalation |
| A02 Cryptographic Failures | HS256 signing, constant-time compare, TLS via Cloud Run |
| A03 Injection | Input validation, fixed enums, structured tool calls, JSON-only |
| A04 Insecure Design | Least-privilege default role; server-side system prompt |
| A05 Security Misconfig | Strict CSP + security headers via `applySecurity` |
| A06 Vulnerable Components | Pinned deps; frontend Next/Firebase kept on patched lines |
| A07 Auth Failures | Short-lived signed tokens; no server-side sessions |
| A08 Integrity Failures | Container images built and deployed via Cloud Build |
| A09 Logging Failures | Structured startup + warning logs to Cloud Logging |
| A10 SSRF | The API only calls Google APIs via their SDKs; no user-supplied URL is fetched |

## Exercised by tests

* `backend/tests/e2e.test.js` — Tier 5/6: missing/invalid/expired/tampered
  tokens (401), privilege escalation + insufficient clearance (403), input
  validation (400/422), security headers, body-size limit (413), rate-limit headers.
* `backend/tests/unit.test.js` — JWT sign/verify/expiry, constant-time compare,
  RBAC helpers, `requireClearance` rank enforcement, input validation, and
  `authMiddleware` directly.
