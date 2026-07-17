# Architecture

CrowdPulse AI is a real-time stadium operations command center. A React SPA
renders live telemetry; an Express API advances a simulated stadium state and
exposes a Gemini-powered agent that can query and act on that state through
typed tools. Everything is served from a single Cloud Run container.

## High-level flow

```
Browser (React SPA)                Express API (Node, ESM)              Google
─────────────────────              ───────────────────────             ──────
 login form ──POST /api/auth/token──▶ auth.js: signToken (HS256)
 dashboard ──GET /api/stadium/state─▶ routes/stadium.js ─▶ state.js
 AI panel  ──POST /api/agent/query──▶ routes/agent.js ─▶ ai.js ──▶ Gemini
                                        │  executeToolCall(...)         (function
                                        └─ mutates stadiumState ◀───────  calling)
 (every 3s) simulation.js tick ─▶ updates stadiumState ─▶ db.js ─▶ Firestore
```

The frontend `dist/` is built and copied into the backend image, so the API
also serves the SPA and provides a `GET *` fallback for client-side routing.

## Backend module layout (`backend/`)

`server.js` is a thin composition root (~90 lines). All logic lives in `src/`:

| Module | Responsibility |
|---|---|
| `src/config.js` | Env-derived configuration and constants (JWT, Gemini model, rate limits, input limits, RBAC table, simulation tuning `SIM`). Single source of truth. |
| `src/middleware/security.js` | `applySecurity(app)` — helmet CSP + security headers, Permissions-Policy, CORS, JSON body limit. |
| `src/auth.js` | JWT sign/verify (constant-time), `authMiddleware`, input validation, and RBAC helpers. |
| `src/state.js` | The shared mutable `stadiumState` singleton, initial-state factory, alert history, Firestore hydration (`initStateFromDb`), and reset. |
| `src/simulation.js` | The 3-second tick engine: crowd flow, zone density/risk, random incidents, weather, and history capping. |
| `src/ai.js` | Gemini client, agent tool schemas (`agentTools`), the tool executor (`executeToolCall`), the per-request system prompt, and a deterministic fallback when the model is unavailable. |
| `src/routes/*.js` | Express routers grouped by concern: `health`, `auth`, `stadium`, `agent`. |

Dependency direction is acyclic: `config` is a leaf; `auth`/`state` depend on
`config`; `ai`/`simulation` depend on `config` + `state`; routers depend on
everything below them; `server.js` composes the whole.

## Data model

`stadiumState` (see `getInitialState`) holds: stadium metadata, 12 gates, 8
zones, incidents, alerts, routing decisions, and a capped crowd-history series.
Persistence is via `db.js` — Firestore when credentials are present on Cloud
Run, transparently falling back to an in-memory store otherwise, so the app
runs identically in local/dev, tests, and production.

## The AI agent

`POST /api/agent/query` sends the user message plus the tool declarations to
Gemini (`GEMINI_MODEL`, default `gemini-2.5-flash`). If the model requests tool
calls, `executeToolCall` runs them against live state and the results are fed
back for a final natural-language answer. When no API key is configured (or the
call fails), `generateFallbackResponse` returns a useful, data-driven summary so
the UI degrades gracefully instead of erroring.

## Testing

* **Unit** (`tests/unit.test.js`, `node --test`) — pure logic in `src/`
  (auth/JWT/RBAC, tool execution, fallback, simulation helpers, config).
* **E2E** (`tests/e2e.test.js` via `tests/run-e2e.js`) — black-box HTTP across
  6 tiers: happy path, edge cases, state transitions, stress, and security.
* Run everything with `npm test` (unit then e2e).

## Deployment

Cloud Build (`cloudbuild.yaml`) builds the multi-stage Docker image (frontend
build → copied into the backend runtime image), pushes to Artifact/Container
Registry, and deploys to Cloud Run in `asia-south1`. Secrets (`JWT_SECRET`,
`GEMINI_API_KEY`) are Cloud Run environment variables; the public Firebase web
config is injected as `VITE_FIREBASE_*` build args. See `docs/SECURITY.md` for
the control set.
